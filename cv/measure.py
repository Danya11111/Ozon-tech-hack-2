"""Сегментация и измерение по ТЗ трека 3 — без эвристик «подкрутки»."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np


@dataclass
class ObjectMeasurement:
    length_mm: float
    width_mm: float
    height_mm: float
    circle_ratio: float  # итог для классификатора: max устойчивых сечений
    area_px: int
    centroid_px: Tuple[int, int]
    contour: np.ndarray
    mask: np.ndarray
    top_ratio: float = 0.0  # rin/rout вида сверху
    section_ratio: float = 0.0  # лучший устойчивый 3D-срез
    source: str = "depth"  # "depth" | "rgb" (плоский товар, найден по RGB)
    clipped_by_frame: bool = False  # объект упирается в край кадра → габарит неполный


def is_plausible_measurement(
    m: ObjectMeasurement,
    min_footprint_mm: float = 15.0,
) -> bool:
    """Отсев шума depth/RGB до классификации (не путать с ТЗ-негабаритом).

    Мелкие пятна и «0×0×0 мм» не должны попадать в трекер — иначе
    check_size(<10 мм) даёт ложный класс C.
    """
    L, W, H = float(m.length_mm), float(m.width_mm), float(m.height_mm)
    if L <= 1.5 or W <= 1.5:
        return False
    if int(m.area_px) < 120:
        return False
    a, b, c = sorted((L, W, H), reverse=True)
    if a < min_footprint_mm:
        return False
    if c <= 0.5:
        return False
    # RGB-шум: нет высоты и крошечное пятно на ленте
    if getattr(m, "source", "depth") == "rgb" and H < 2.0 and a < 45.0:
        return False
    return True


def mask_iou(a: np.ndarray, b: np.ndarray) -> float:
    """Классический IoU масок."""
    inter = int(np.count_nonzero((a > 0) & (b > 0)))
    if inter == 0:
        return 0.0
    ua = int(np.count_nonzero(a > 0))
    ub = int(np.count_nonzero(b > 0))
    return inter / float(ua + ub - inter)


def mask_overlap_min(a: np.ndarray, b: np.ndarray) -> float:
    """Доля пересечения относительно меньшей маски (0..1).

    ≥0.5 ≈ «хотя бы половина одного объекта лежит на другом».
    Удобнее IoU, когда кусок намного меньше целого.
    """
    inter = int(np.count_nonzero((a > 0) & (b > 0)))
    if inter == 0:
        return 0.0
    ua = int(np.count_nonzero(a > 0))
    ub = int(np.count_nonzero(b > 0))
    return inter / float(max(1, min(ua, ub)))


def merge_overlapping_masks(
    items: List[Tuple[np.ndarray, np.ndarray]],
    overlap_thr: float = 0.5,
    near_gap_px: int = 14,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Склеить контуры при IoU/пересечении ≥ thr или узкой дыре depth (near_gap)."""
    if len(items) <= 1:
        return items
    items = sorted(items, key=lambda ic: cv2.contourArea(ic[1]), reverse=True)
    used = [False] * len(items)
    out: List[Tuple[np.ndarray, np.ndarray]] = []

    def _near(a: np.ndarray, b: np.ndarray) -> bool:
        xa, ya, wa, ha = cv2.boundingRect(a)
        xb, yb, wb, hb = cv2.boundingRect(b)
        g = int(near_gap_px)
        return not (
            xa + wa + g < xb or xb + wb + g < xa or ya + ha + g < yb or yb + hb + g < ya
        )

    for i, (mask_i, _) in enumerate(items):
        if used[i]:
            continue
        merged = mask_i.copy()
        used[i] = True
        changed = True
        while changed:
            changed = False
            for j, (mask_j, _) in enumerate(items):
                if used[j]:
                    continue
                hit = (
                    mask_overlap_min(merged, mask_j) >= overlap_thr
                    or mask_iou(merged, mask_j) >= overlap_thr
                    or _near(merged, mask_j)
                )
                if hit:
                    merged = cv2.bitwise_or(merged, mask_j)
                    used[j] = True
                    changed = True
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        merged = cv2.morphologyEx(merged, cv2.MORPH_CLOSE, k, iterations=1)
        contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        clean = np.zeros_like(merged)
        cv2.drawContours(clean, [contour], -1, 255, thickness=-1)
        out.append((clean, contour))
    return out


def merge_overlapping_measurements(
    measurements: List[ObjectMeasurement],
    overlap_thr: float = 0.5,
) -> List[ObjectMeasurement]:
    """Склеить измерения с пересекающимися масками (оставить более крупное)."""
    if len(measurements) <= 1:
        return measurements
    ms = sorted(measurements, key=lambda m: m.area_px, reverse=True)
    kept: List[ObjectMeasurement] = []
    for m in ms:
        drop = False
        for k in kept:
            if m.mask.shape != k.mask.shape:
                continue
            if mask_overlap_min(m.mask, k.mask) >= overlap_thr or mask_iou(m.mask, k.mask) >= overlap_thr:
                drop = True
                break
        if not drop:
            kept.append(m)
    return kept


def apply_roi_margin(
    mask: np.ndarray,
    margin: Optional[dict] = None,
) -> np.ndarray:
    """Обнулить края кадра (ролики, борта, плата), доли 0..1 от H/W."""
    if not margin:
        return mask
    h, w = mask.shape[:2]
    top = int(h * float(margin.get("top", 0)))
    bottom = int(h * float(margin.get("bottom", 0)))
    left = int(w * float(margin.get("left", 0)))
    right = int(w * float(margin.get("right", 0)))
    out = mask.copy()
    if top > 0:
        out[:top, :] = 0
    if bottom > 0:
        out[h - bottom :, :] = 0
    if left > 0:
        out[:, :left] = 0
    if right > 0:
        out[:, w - right :] = 0
    return out


def contour_touches_border(
    contour: np.ndarray,
    shape: Tuple[int, ...],
    margin_px: int = 3,
    roi_margin: Optional[dict] = None,
) -> bool:
    """True если контур упирается в край кадра/ROI — реальный размер может быть больше."""
    h, w = int(shape[0]), int(shape[1])
    top = int(h * float((roi_margin or {}).get("top", 0)))
    bottom = int(h * float((roi_margin or {}).get("bottom", 0)))
    left = int(w * float((roi_margin or {}).get("left", 0)))
    right = int(w * float((roi_margin or {}).get("right", 0)))
    y0, y1 = top + margin_px, h - bottom - 1 - margin_px
    x0, x1 = left + margin_px, w - right - 1 - margin_px
    pts = contour.reshape(-1, 2)
    xs, ys = pts[:, 0], pts[:, 1]
    return bool(
        (xs <= x0).any()
        or (xs >= x1).any()
        or (ys <= y0).any()
        or (ys >= y1).any()
    )


def segment_objects(
    depth_mm: np.ndarray,
    belt_distance_mm: float,
    belt_tolerance_mm: float = 25.0,
    min_object_height_mm: float = 5.0,
    min_area_px: int = 800,
    background_mm: Optional[np.ndarray] = None,
    max_objects: int = 3,
    roi_margin: Optional[dict] = None,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Все объекты в кадре (крупнейшие первыми), до max_objects штук.

    Порог высоты — как раньше (строгий): мягкий «ореол» раздувал маску на ленту
    и ломал габариты/круг → путаница B/C/D.
    """
    valid = (depth_mm > 50) & (depth_mm < 5000)
    hmin = float(min_object_height_mm)
    if background_mm is not None:
        bg = background_mm.astype(np.float32)
        d = depth_mm.astype(np.float32)
        raised = valid & (bg > 50) & (d < bg - hmin)
        near_belt_band = d > (bg - 520.0)
    else:
        raised = valid & (depth_mm < (belt_distance_mm - hmin))
        near_belt_band = depth_mm > (belt_distance_mm - 450)
    mask = (raised & near_belt_band).astype(np.uint8) * 255
    mask = apply_roi_margin(mask, roi_margin)

    k_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k_open, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_close, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    frame_area = mask.shape[0] * mask.shape[1]
    raw: List[Tuple[np.ndarray, np.ndarray]] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        # крупные товары могут занимать почти весь кадр — не отсекать как шум
        if area < min_area_px or area > frame_area * 0.92:
            continue
        clean = np.zeros_like(mask)
        cv2.drawContours(clean, [contour], -1, 255, thickness=-1)
        raw.append((clean, contour))

    # только явное пересечение / узкая щель — не склеивать соседние товары
    merged = merge_overlapping_masks(raw, overlap_thr=0.5, near_gap_px=14)
    return merged[:max_objects]


def segment_object(
    depth_mm: np.ndarray,
    belt_distance_mm: float,
    belt_tolerance_mm: float = 25.0,
    min_object_height_mm: float = 5.0,
    min_area_px: int = 800,
    background_mm: Optional[np.ndarray] = None,
    roi_margin: Optional[dict] = None,
) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Крупнейший объект (для main.py/calibrate.py — один товар в накопителе)."""
    objs = segment_objects(
        depth_mm,
        belt_distance_mm,
        belt_tolerance_mm=belt_tolerance_mm,
        min_object_height_mm=min_object_height_mm,
        min_area_px=min_area_px,
        background_mm=background_mm,
        max_objects=1,
        roi_margin=roi_margin,
    )
    return objs[0] if objs else None


def _pixel_to_xy_mm(
    u: float, v: float, z_mm: float, fx: float, fy: float, cx: float, cy: float
) -> Tuple[float, float]:
    return (u - cx) * z_mm / fx, (v - cy) * z_mm / fy


def measure_object(
    depth_mm: np.ndarray,
    mask: np.ndarray,
    contour: np.ndarray,
    belt_distance_mm: float,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
    background_mm: Optional[np.ndarray] = None,
    min_object_height_mm: float = 5.0,
    roi_margin: Optional[dict] = None,
) -> Optional[ObjectMeasurement]:
    ys, xs = np.where(mask > 0)
    if xs.size < 50:
        return None

    z_vals = depth_mm[ys, xs].astype(np.float32)
    z_vals = z_vals[z_vals > 0]
    if z_vals.size < 50:
        return None

    z_med = float(np.median(z_vals))
    # высота относительно локального фона (платформа/лента под объектом)
    belt_local = belt_distance_mm
    if background_mm is not None:
        bg_vals = background_mm[ys, xs].astype(np.float32)
        bg_vals = bg_vals[bg_vals > 50]
        if bg_vals.size >= 50:
            belt_local = float(np.median(bg_vals))
    height_mm = max(0.0, belt_local - z_med)

    pts_mm = []
    for p in contour.reshape(-1, 2):
        u, v = float(p[0]), float(p[1])
        x, y = _pixel_to_xy_mm(u, v, z_med, fx, fy, cx, cy)
        pts_mm.append([x, y])
    pts_mm = np.asarray(pts_mm, dtype=np.float32)
    if pts_mm.shape[0] < 5:
        return None

    rect = cv2.minAreaRect(pts_mm.reshape(-1, 1, 2))
    rw, rh = rect[1]
    length_mm = float(max(rw, rh))
    width_mm = float(min(rw, rh))

    touches_edge = contour_touches_border(contour, mask.shape, roi_margin=roi_margin)
    # Негабарит «не влезает в кадр» только если реально занимает большую долю FOV.
    # Лежачая бутылка может чуть касаться ROI — это не повод форсировать 500 мм.
    span_x = float(xs.max() - xs.min())
    span_y = float(ys.max() - ys.min())
    mh = float((roi_margin or {}).get("top", 0.0)) + float((roi_margin or {}).get("bottom", 0.0))
    mw = float((roi_margin or {}).get("left", 0.0)) + float((roi_margin or {}).get("right", 0.0))
    usable_w = mask.shape[1] * max(0.5, 1.0 - mw)
    usable_h = mask.shape[0] * max(0.5, 1.0 - mh)
    spans_frame = (span_x >= 0.72 * usable_w) or (span_y >= 0.72 * usable_h)
    clipped = bool(touches_edge and spans_frame)

    # отсев шума ленты / руки на краю (низкий «холм» большой площади → не товар)
    # но не отсекаем крупные обрезанные объекты — они уйдут в C
    if not clipped and height_mm < 30.0 and max(length_mm, width_mm) > 150.0:
        return None
    # жёсткий пол — иначе складки ленты дают ложный C
    if height_mm < max(20.0, float(min_object_height_mm)):
        return None
    # раньше >520 отбрасывали → ложный B на негабарите в FOV;
    # оставляем измерение: classify отправит в C (>450)
    if max(length_mm, width_mm) > 2000.0 and not clipped:
        return None

    # объект не помещается в кадр → габарит занижен; форсируем > max ТЗ
    if clipped:
        length_mm = max(length_mm, 500.0)

    top_ratio = rin_rout(pts_mm)
    section_ratio = 0.0
    cloud = _point_cloud(depth_mm, mask, fx, fy, cx, cy)
    if cloud is not None:
        section_ratio = robust_section_ratio(cloud)

    # ТЗ: круг в любом сечении. Один шумный 3D-срез не считаем:
    # D только если top>=0.8 ИЛИ ≥2 среза >=0.8 (внутри robust_section_ratio).
    circle_ratio = max(top_ratio, section_ratio)
    if clipped:
        # обрезанный негабарит не классифицируем по кругу
        circle_ratio = min(circle_ratio, 0.5)

    m = cv2.moments(contour)
    if m["m00"] > 0:
        cx_px = int(m["m10"] / m["m00"])
        cy_px = int(m["m01"] / m["m00"])
    else:
        cx_px, cy_px = int(xs.mean()), int(ys.mean())

    return ObjectMeasurement(
        length_mm=length_mm,
        width_mm=width_mm,
        height_mm=height_mm,
        circle_ratio=float(circle_ratio),
        area_px=int(xs.size),
        centroid_px=(cx_px, cy_px),
        contour=contour,
        mask=mask,
        top_ratio=float(top_ratio),
        section_ratio=float(section_ratio),
        clipped_by_frame=bool(clipped),
    )


def segment_rgb_objects(
    color_bgr: np.ndarray,
    color_bg_bgr: np.ndarray,
    min_area_px: int = 800,
    diff_threshold: int = 35,
    max_objects: int = 3,
    exclude_mask: Optional[np.ndarray] = None,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Плоские товары (телефон и т.п.) по разнице с RGB-фоном пустой ленты.

    exclude_mask — зоны, уже найденные по depth (не дублируем объекты).
    Тени (пропорциональное затемнение каналов) отбрасываются.
    """
    if color_bgr.shape != color_bg_bgr.shape:
        return []
    fg = color_bgr.astype(np.float32)
    bg = color_bg_bgr.astype(np.float32)
    gray = np.max(np.abs(fg - bg), axis=2).astype(np.uint8)
    _, m = cv2.threshold(gray, int(diff_threshold), 255, cv2.THRESH_BINARY)

    ratio = (fg + 8.0) / (bg + 8.0)
    r_med = np.median(ratio, axis=2)
    r_spread = np.max(ratio, axis=2) - np.min(ratio, axis=2)
    is_shadow = (r_med < 0.93) & (r_med > 0.38) & (r_spread < 0.14)
    m[is_shadow] = 0

    k = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k, iterations=1)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, iterations=2)

    if exclude_mask is not None:
        excl = cv2.dilate(exclude_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (31, 31)))
        m[excl > 0] = 0

    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: List[Tuple[np.ndarray, np.ndarray]] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(contour) < min_area_px or len(out) >= max_objects:
            break
        clean = np.zeros_like(m)
        cv2.drawContours(clean, [contour], -1, 255, thickness=-1)
        out.append((clean, contour))
    return out


def measure_flat_object(
    depth_mm: np.ndarray,
    mask: np.ndarray,
    contour: np.ndarray,
    belt_distance_mm: float,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
    background_mm: Optional[np.ndarray] = None,
    color_bgr: Optional[np.ndarray] = None,
    color_bg_bgr: Optional[np.ndarray] = None,
) -> Optional[ObjectMeasurement]:
    """Измерение товара, найденного по RGB: без отсева по минимальной высоте."""
    ys, xs = np.where(mask > 0)
    if xs.size < 50:
        return None

    z_plane = belt_distance_mm
    if background_mm is not None:
        bg_vals = background_mm[ys, xs].astype(np.float32)
        bg_vals = bg_vals[bg_vals > 50]
        if bg_vals.size >= 50:
            z_plane = float(np.median(bg_vals))

    z_vals = depth_mm[ys, xs].astype(np.float32)
    z_vals = z_vals[z_vals > 0]
    height_mm = max(0.0, z_plane - float(np.median(z_vals))) if z_vals.size >= 50 else 0.0

    pts_mm = []
    for p in contour.reshape(-1, 2):
        x, y = _pixel_to_xy_mm(float(p[0]), float(p[1]), z_plane, fx, fy, cx, cy)
        pts_mm.append([x, y])
    pts_mm = np.asarray(pts_mm, dtype=np.float32)
    if pts_mm.shape[0] < 3:
        return None

    rect = cv2.minAreaRect(pts_mm.reshape(-1, 1, 2))
    rw, rh = rect[1]
    length_mm = float(max(rw, rh))
    width_mm = float(min(rw, rh))
    if max(length_mm, width_mm) > 520.0 or max(length_mm, width_mm) < 5.0:
        return None

    top_ratio = rin_rout(pts_mm)

    m = cv2.moments(contour)
    if m["m00"] > 0:
        cx_px, cy_px = int(m["m10"] / m["m00"]), int(m["m01"] / m["m00"])
    else:
        cx_px, cy_px = int(xs.mean()), int(ys.mean())

    return ObjectMeasurement(
        length_mm=length_mm,
        width_mm=width_mm,
        height_mm=float(height_mm),
        circle_ratio=float(top_ratio),
        area_px=int(xs.size),
        centroid_px=(cx_px, cy_px),
        contour=contour,
        mask=mask,
        top_ratio=float(top_ratio),
        section_ratio=0.0,
        source="rgb",
    )


def rin_rout(pts_xy: np.ndarray) -> float:
    """ТЗ: r_in / r_out по выпуклой оболочке сечения."""
    pts = np.asarray(pts_xy, dtype=np.float32).reshape(-1, 2)
    if pts.shape[0] < 3:
        return 0.0

    hull = cv2.convexHull(pts.reshape(-1, 1, 2))
    hull_pts = hull.reshape(-1, 2)
    if hull_pts.shape[0] < 3:
        return 0.0

    (_center, r_out) = cv2.minEnclosingCircle(hull)
    r_out = float(r_out)
    if r_out < 1e-6:
        return 0.0

    r_in = _inscribed_radius_mm(hull_pts)
    if r_in <= 0:
        return 0.0
    return float(np.clip(r_in / r_out, 0.0, 1.0))


def robust_section_ratio(cloud: np.ndarray, thr: float = 0.8) -> float:
    """
    Поперечные срезы. Из логов: у круга часто 1–2 среза ≥0.85, иногда медиана падает.
    - ≥1 срез с score≥0.85 → принимаем (уверенный круг/дуга);
    - иначе ≥2 среза ≥0.8 → max;
    - иначе медиана (антишум для коробки).
    """
    ratios = _section_ratios_3d(cloud)
    if not ratios:
        return 0.0
    very = [r for r in ratios if r >= 0.85]
    if very:
        return float(max(very))
    strong = [r for r in ratios if r >= thr]
    if len(strong) >= 2:
        return float(max(strong))
    return float(np.median(ratios))


def _point_cloud(
    depth_mm: np.ndarray,
    mask: np.ndarray,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
) -> Optional[np.ndarray]:
    ys, xs = np.where(mask > 0)
    if xs.size < 150:
        return None
    z = depth_mm[ys, xs].astype(np.float32)
    ok = (z > 50) & (z < 5000)
    xs, ys, z = xs[ok], ys[ok], z[ok]
    if xs.size < 150:
        return None
    # детерминированный даунсэмпл (без random)
    if xs.size > 4000:
        step = int(np.ceil(xs.size / 4000))
        xs, ys, z = xs[::step], ys[::step], z[::step]
    X = (xs.astype(np.float32) - cx) * z / fx
    Y = (ys.astype(np.float32) - cy) * z / fy
    return np.column_stack([X, Y, z]).astype(np.float32)


def _section_ratios_3d(cloud: np.ndarray) -> List[float]:
    mean = cloud.mean(axis=0)
    centered = cloud - mean
    try:
        _u, s, vt = np.linalg.svd(centered, full_matrices=False)
    except np.linalg.LinAlgError:
        return []

    out: List[float] = []
    # только вдоль самой длинной оси — поперечные сечения цилиндра/коробки
    for axis_i in range(min(1, vt.shape[0])):
        if float(s[axis_i]) < 1e-6:
            continue
        axis = vt[axis_i]
        axis = axis / (np.linalg.norm(axis) + 1e-9)
        along = centered @ axis

        ref = np.array([0.0, 0.0, 1.0], dtype=np.float32)
        if abs(float(np.dot(axis, ref))) > 0.9:
            ref = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        u = np.cross(axis, ref)
        u /= np.linalg.norm(u) + 1e-9
        v = np.cross(axis, u)

        a0, a1 = float(np.percentile(along, 15)), float(np.percentile(along, 85))
        if a1 - a0 < 10.0:
            continue

        for t in (0.2, 0.35, 0.5, 0.65, 0.8):
            ca = a0 + t * (a1 - a0)
            half = max(4.0, 0.06 * (a1 - a0))
            band = np.abs(along - ca) <= half
            if int(band.sum()) < 40:
                continue
            pts = centered[band]
            sec = np.column_stack([pts @ u, pts @ v]).astype(np.float32)
            out.append(_section_score(sec))
    return out


def _section_score(sec: np.ndarray) -> float:
    """
    Чистый rin/rout. Для дуги лежачего цилиндра (depth видит полкруга)
    допускаем score 0.85 только при жёстком circle-fit:
    малый residual, почти равные радиусы, покрытие ≥200°, bbox не «палка».
    Прямоугольное сечение fit не проходит → остаётся rin/rout < 0.8.
    """
    direct = rin_rout(sec)
    if direct >= 0.8:
        return float(direct)

    fit = _fit_circle_arc(sec)
    if fit is None:
        return float(direct)
    return float(max(direct, 0.85))


def _fit_circle_arc(pts: np.ndarray) -> Optional[Tuple[np.ndarray, float]]:
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    if pts.shape[0] < 35:
        return None

    c0 = pts.mean(axis=0)
    x0 = pts - c0
    try:
        _u, s, _vt = np.linalg.svd(x0, full_matrices=False)
    except np.linalg.LinAlgError:
        return None
    if s.shape[0] < 2 or float(s[0]) < 1e-6:
        return None
    # сечение не должно быть линией
    if float(s[1] / (s[0] + 1e-9)) < 0.45:
        return None

    x, y = pts[:, 0], pts[:, 1]
    A = np.column_stack([2 * x, 2 * y, np.ones_like(x)])
    b = x * x + y * y
    try:
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    except np.linalg.LinAlgError:
        return None
    cx_, cy_, c = sol
    r2 = c + cx_ * cx_ + cy_ * cy_
    if r2 <= 1.0:
        return None
    r = float(np.sqrt(r2))
    rad = np.sqrt((x - cx_) ** 2 + (y - cy_) ** 2)
    rel = float(np.sqrt(np.mean((rad - r) ** 2)) / (r + 1e-9))
    rad_cv = float(rad.std() / (rad.mean() + 1e-9))
    if rel > 0.04 or rad_cv > 0.04:
        return None

    bw = float(x.max() - x.min())
    bh = float(y.max() - y.min())
    aspect = max(bw, bh) / max(min(bw, bh), 1e-6)
    # у круга/полукруга bbox близок к квадрату; у прямоугольника 2:1 — нет
    if aspect > 1.45:
        return None
    if r < 0.40 * max(bw, bh) or r > 0.70 * max(bw, bh):
        return None

    ang = np.arctan2(y - cy_, x - cx_)
    ang = np.sort(ang)
    gaps = np.diff(ang)
    gaps = np.append(gaps, ang[0] + 2 * np.pi - ang[-1])
    coverage = float(2 * np.pi - gaps.max())
    if coverage < np.deg2rad(200.0):
        return None

    return np.array([cx_, cy_], dtype=np.float32), r


def _inscribed_radius_mm(pts_xy_mm: np.ndarray, grid: int = 192) -> float:
    x_min, y_min = pts_xy_mm.min(axis=0)
    x_max, y_max = pts_xy_mm.max(axis=0)
    span = max(float(x_max - x_min), float(y_max - y_min), 1.0)
    pad = 8
    inner = grid - 2 * pad
    if inner < 16:
        return 0.0
    scale = inner / span

    img = np.zeros((grid, grid), dtype=np.uint8)
    pts_px = ((pts_xy_mm - np.array([x_min, y_min], dtype=np.float32)) * scale).astype(np.int32)
    pts_px[:, 0] = np.clip(pts_px[:, 0] + pad, 0, grid - 1)
    pts_px[:, 1] = np.clip(pts_px[:, 1] + pad, 0, grid - 1)
    cv2.fillPoly(img, [pts_px], 255)
    if img.max() == 0 or float((img > 0).mean()) > 0.98:
        return 0.0
    dist = cv2.distanceTransform(img, cv2.DIST_L2, 5)
    return float(dist.max()) / scale


def circularity_ratio(pts_xy_mm: np.ndarray) -> float:
    return rin_rout(pts_xy_mm)


# совместимость со старыми вызовами
def max_section_circle_ratio(
    depth_mm: np.ndarray,
    mask: np.ndarray,
    top_pts_mm: np.ndarray,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
) -> float:
    top = rin_rout(top_pts_mm)
    cloud = _point_cloud(depth_mm, mask, fx, fy, cx, cy)
    sec = robust_section_ratio(cloud) if cloud is not None else 0.0
    return float(max(top, sec))


def section_rin_rout(sec: np.ndarray) -> float:
    return rin_rout(sec)
