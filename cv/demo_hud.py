"""HUD демо: RGB-подложка + depth, несколько объектов с ID, кириллица через PIL."""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ZONE_COLOR = {  # BGR
    "B": (40, 180, 40),
    "C": (40, 40, 220),
    "D": (0, 165, 255),
}
UNCERTAIN_COLOR = (0, 130, 250)  # оранжевый
PENDING_COLOR = (0, 255, 255)    # жёлтый — идёт накопление

_FONT_CANDIDATES = [
    "/usr/share/fonts/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


@lru_cache(maxsize=8)
def _font(size: int) -> ImageFont.FreeTypeFont:
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_texts(
    img_bgr: np.ndarray,
    texts: List[Tuple[int, int, str, Tuple[int, int, int], int]],
) -> np.ndarray:
    """texts: (x, y, строка, цвет BGR, размер). Кириллица через PIL."""
    if not texts:
        return img_bgr
    pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil)
    for x, y, s, bgr, size in texts:
        rgb = (bgr[2], bgr[1], bgr[0])
        draw.text((x, y), s, font=_font(size), fill=rgb, stroke_width=2, stroke_fill=(0, 0, 0))
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


class DepthSmoother:
    """Временное сглаживание depth только для отображения (не для измерений)."""

    def __init__(self, alpha: float = 0.25) -> None:
        self.alpha = float(alpha)
        self._acc: Optional[np.ndarray] = None

    def update(self, depth_mm: np.ndarray) -> np.ndarray:
        d = depth_mm.astype(np.float32)
        if self._acc is None or self._acc.shape != d.shape:
            self._acc = d.copy()
        valid = d > 0
        self._acc[valid] = (1.0 - self.alpha) * self._acc[valid] + self.alpha * d[valid]
        out = self._acc.astype(np.uint16)
        out[~valid & (self._acc <= 0)] = 0
        return out


class ContourSmoother:
    """Стабильная окантовка: EMA маски по каждому треку + аппроксимация контура,
    плюс «примагничивание» контура к краям объекта на RGB (снимает остаточный
    параллакс depth↔color и распухание depth-маски).

    Только для отрисовки — измерения идут по сырому контуру.
    """

    def __init__(self, alpha: float = 0.3, snap_alpha: float = 0.35) -> None:
        self.alpha = float(alpha)
        self.snap_alpha = float(snap_alpha)
        self._acc: Dict[int, np.ndarray] = {}
        self._snap: Dict[int, Tuple[float, float, float]] = {}  # tid -> (dx, dy, shrink)

    def smooth(
        self, track_id: int, mask: np.ndarray, edge_img: Optional[np.ndarray] = None
    ) -> Optional[np.ndarray]:
        m = mask.astype(np.float32) / 255.0
        acc = self._acc.get(track_id)
        if acc is None or acc.shape != m.shape:
            acc = m.copy()
        else:
            acc = (1.0 - self.alpha) * acc + self.alpha * m
        self._acc[track_id] = acc

        soft = cv2.GaussianBlur((acc * 255.0).astype(np.uint8), (11, 11), 0)
        _, binm = cv2.threshold(soft, 127, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(binm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        contour = max(contours, key=cv2.contourArea)

        pts = contour.reshape(-1, 2).astype(np.float32)
        if edge_img is not None and pts.shape[0] >= 8:
            pts = self._snap_to_edges(track_id, pts, edge_img)

        contour = pts.reshape(-1, 1, 2).astype(np.int32)
        eps = 0.008 * cv2.arcLength(contour, True)
        return cv2.approxPolyDP(contour, eps, True)

    def _snap_to_edges(
        self, track_id: int, pts: np.ndarray, edge: np.ndarray
    ) -> np.ndarray:
        """Локальный поиск сдвига (±14 px) и поджатия контура, при которых под
        контуром максимум RGB-краёв. Найденная поправка сглаживается по времени."""
        H, W = edge.shape[:2]
        xs, ys = pts[:, 0], pts[:, 1]

        def score(dx: float, dy: float, f: float, c: np.ndarray) -> float:
            x = np.clip((c[0] + f * (xs - c[0]) + dx).astype(np.int32), 0, W - 1)
            y = np.clip((c[1] + f * (ys - c[1]) + dy).astype(np.int32), 0, H - 1)
            return float(edge[y, x].mean()) - 0.6 * float(np.hypot(dx, dy))

        c = pts.mean(axis=0)
        best_dx, best_dy, best_s = 0.0, 0.0, score(0, 0, 1.0, c)
        for dy in range(-14, 15, 2):
            for dx in range(-14, 15, 2):
                s = score(dx, dy, 1.0, c)
                if s > best_s:
                    best_s, best_dx, best_dy = s, float(dx), float(dy)
        best_f = 1.0
        # только сдвиг и лёгкое РАСШИРЕНИЕ — поджатие (f<1) отрезало часть объекта
        for f in (1.0, 1.04, 1.08):
            s = score(best_dx, best_dy, f, c)
            if s > best_s:
                best_s, best_f = s, f

        prev = self._snap.get(track_id, (0.0, 0.0, 1.0))
        a = self.snap_alpha
        sm = (
            (1 - a) * prev[0] + a * best_dx,
            (1 - a) * prev[1] + a * best_dy,
            max(1.0, (1 - a) * prev[2] + a * best_f),
        )
        self._snap[track_id] = sm
        out = pts.copy()
        out[:, 0] = c[0] + sm[2] * (xs - c[0]) + sm[0]
        out[:, 1] = c[1] + sm[2] * (ys - c[1]) + sm[1]
        return out

    def drop_missing(self, alive_ids: set) -> None:
        for tid in list(self._acc.keys()):
            if tid not in alive_ids:
                del self._acc[tid]
                self._snap.pop(tid, None)


def align_color(color_bgr: np.ndarray, dx: float, dy: float, scale: float) -> np.ndarray:
    """Совмещение RGB с depth: сдвиг+масштаб (у D415 сенсоры разнесены)."""
    if abs(dx) < 0.5 and abs(dy) < 0.5 and abs(scale - 1.0) < 1e-3:
        return color_bgr
    h, w = color_bgr.shape[:2]
    M = np.float32([
        [scale, 0, dx + (1.0 - scale) * w / 2.0],
        [0, scale, dy + (1.0 - scale) * h / 2.0],
    ])
    return cv2.warpAffine(color_bgr, M, (w, h), flags=cv2.INTER_LINEAR)


def build_demo_frame(
    color_bgr: np.ndarray,
    depth_mm: np.ndarray,
    tracks: list,  # List[tracker.Track]
    belt_mm: float,
    stats: Optional[Dict[str, int]] = None,
    confidence_pct: int = 75,
    rgb_available: bool = False,
    background_active: bool = False,
    color_align: Tuple[float, float, float] = (0.0, 0.0, 1.0),
    contour_smoother: Optional[ContourSmoother] = None,
) -> np.ndarray:
    from camera import depth_colormap

    # RGB для веба; если цвет недоступен — colorize(depth), НЕ чёрный экран
    if rgb_available and color_bgr is not None and float(np.std(color_bgr)) > 4.0:
        base = color_bgr
        if base.shape[:2] != depth_mm.shape[:2]:
            base = cv2.resize(base, (depth_mm.shape[1], depth_mm.shape[0]))
        base = align_color(base, color_align[0], color_align[1], color_align[2])
        view = base.copy()
        rgb_ok = True
    else:
        view = depth_colormap(depth_mm)
        view = cv2.medianBlur(view, 3)
        base = view
        rgb_ok = False
    h, w = view.shape[:2]

    # мягкое поле RGB-краёв для «примагничивания» контуров
    edge_field: Optional[np.ndarray] = None
    if rgb_ok and contour_smoother is not None and tracks:
        gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
        gray = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
        edge_field = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 120)
        edge_field = cv2.GaussianBlur(edge_field, (13, 13), 0)

    texts: List[Tuple[int, int, str, Tuple[int, int, int], int]] = []
    max_conf_pending = 0
    all_locked = bool(tracks)
    alive_ids = set()

    for tr in tracks:
        m = tr.measurement
        d = tr.decision
        if m is None or d is None:
            continue
        alive_ids.add(tr.track_id)
        locked = d.locked and d.result is not None
        if locked:
            color = UNCERTAIN_COLOR if d.uncertain else ZONE_COLOR.get(d.result.category.zone, PENDING_COLOR)
        else:
            color = PENDING_COLOR
            all_locked = False
            max_conf_pending = max(max_conf_pending, d.confidence_pct)

        # bbox / класс — по сырому контуру измерения; сглаживание только для окантовки «анализ»
        raw_contour = m.contour
        draw_contour = raw_contour
        if not locked and contour_smoother is not None:
            sm = contour_smoother.smooth(tr.track_id, m.mask, edge_img=edge_field)
            if sm is not None:
                draw_contour = sm
        if locked:
            bx, by, bw, bh = cv2.boundingRect(raw_contour)
            # небольшой запас, чтобы рамка не обрезала края
            pad = 4
            bx, by = max(0, bx - pad), max(0, by - pad)
            bw = min(w - bx, bw + 2 * pad)
            bh = min(h - by, bh + 2 * pad)
            cv2.rectangle(view, (bx, by), (bx + bw, by + bh), color, 2, lineType=cv2.LINE_AA)
            cl = max(8, min(bw, bh) // 5)
            for px, py, sx, sy in ((bx, by, 1, 1), (bx + bw, by, -1, 1),
                                   (bx, by + bh, 1, -1), (bx + bw, by + bh, -1, -1)):
                cv2.line(view, (px, py), (px + sx * cl, py), color, 4, lineType=cv2.LINE_AA)
                cv2.line(view, (px, py), (px, py + sy * cl), color, 4, lineType=cv2.LINE_AA)
            contour = raw_contour
        else:
            cv2.drawContours(view, [draw_contour], -1, color, 2, lineType=cv2.LINE_AA)
            contour = draw_contour
        ccx, ccy = contour.reshape(-1, 2).mean(axis=0)
        cv2.circle(view, (int(ccx), int(ccy)), 4, (0, 0, 255), -1, lineType=cv2.LINE_AA)

        x0, y0, _, _ = cv2.boundingRect(contour)
        tx = int(np.clip(x0, 4, w - 220))
        ty = int(np.clip(y0 - 46, 4, h - 46))
        if locked:
            label = d.result.category.short_label
            if d.uncertain:
                label = "НЕУВЕРЕННО → " + label
            texts.append((tx, ty, f"#{tr.track_id} {label}", color, 20))
        else:
            texts.append((tx, ty, f"#{tr.track_id} анализ… {d.confidence_pct}%", color, 20))
        dims = d.result.dims_sorted_mm if (locked and d.result) else (m.length_mm, m.width_mm, m.height_mm)
        ratio = d.result.circle_ratio if (locked and d.result) else m.circle_ratio
        src = " · RGB" if getattr(m, "source", "depth") == "rgb" else ""
        texts.append(
            (tx, ty + 24, f"{dims[0]:.0f}×{dims[1]:.0f}×{dims[2]:.0f} мм · круг {ratio:.2f}{src}", (235, 235, 235), 15)
        )

    if contour_smoother is not None:
        contour_smoother.drop_missing(alive_ids)

    view = _draw_texts(view, texts)

    # надписи — в отдельной полосе НАД кадром, чтобы не закрывать камеру
    top_bar = np.full((36, w, 3), 18, np.uint8)
    st = stats or {}
    stats_line = (
        f"ГОТОВ {st.get('B', 0)} · НЕГАБАРИТ {st.get('C', 0)} · ДОУПАК {st.get('D', 0)}"
        + (f" · неувер. {st['uncertain']}" if st.get("uncertain") else "")
    )
    bg_tag = " · фон:карта" if background_active else ""
    left = "объектов нет" if not tracks else f"объектов: {len(alive_ids)}"
    top_texts = [
        (10, 6, left, (150, 150, 255) if not tracks else (200, 230, 200), 17),
        (max(200, w - 440), 8, f"{stats_line} | h={belt_mm:.0f}мм{bg_tag}", (200, 230, 200), 14),
    ]
    top_bar = _draw_texts(top_bar, top_texts)
    view = np.vstack([top_bar, view])
    h = view.shape[0]

    # прогресс уверенности внизу
    bar_y = h - 8
    cv2.rectangle(view, (0, bar_y), (w, h), (40, 40, 40), -1)
    conf_show = 100 if (all_locked and tracks) else max_conf_pending
    fill = int(w * min(1.0, conf_show / 100.0))
    col = (40, 200, 40) if (all_locked and tracks) else (0, 200, 255)
    cv2.rectangle(view, (0, bar_y), (fill, h), col, -1)
    thr = int(w * confidence_pct / 100.0)
    cv2.line(view, (thr, bar_y), (thr, h), (255, 255, 255), 1)

    return view
