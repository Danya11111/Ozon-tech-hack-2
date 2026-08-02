#!/usr/bin/env python3
"""Геометрические тесты: прямоугольник → B, круг → D (без камеры)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))

from measure import (
    ObjectMeasurement,
    _fit_circle_arc,
    _section_score,
    measure_object,
    rin_rout,
    section_rin_rout,
    segment_object,
)
from stabilize import DecisionStabilizer


def _circle(n=64, r=40.0):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.column_stack([50 + r * np.cos(a), 50 + r * np.sin(a)]).astype(np.float32)


def _rect(w=150.0, h=90.0, n=20):
    pts = (
        [[x, 0] for x in np.linspace(0, w, n)]
        + [[w, y] for y in np.linspace(0, h, n)]
        + [[x, h] for x in np.linspace(w, 0, n)]
        + [[0, y] for y in np.linspace(h, 0, n)]
    )
    return np.array(pts, dtype=np.float32)


def _round_rect(w=150.0, h=90.0, rad=8.0, n=12, ne=15):
    pts = []
    pts += [[x, 0] for x in np.linspace(rad, w - rad, ne)]
    pts += [[w, y] for y in np.linspace(rad, h - rad, ne)]
    pts += [[x, h] for x in np.linspace(w - rad, rad, ne)]
    pts += [[0, y] for y in np.linspace(h - rad, rad, ne)]
    corners = [
        (rad, rad, np.pi, 1.5 * np.pi),
        (w - rad, rad, 1.5 * np.pi, 2 * np.pi),
        (w - rad, h - rad, 0, 0.5 * np.pi),
        (rad, h - rad, 0.5 * np.pi, np.pi),
    ]
    for cx, cy, a0, a1 in corners:
        for a in np.linspace(a0, a1, n):
            pts.append([cx + rad * np.cos(a), cy + rad * np.sin(a)])
    return np.array(pts, dtype=np.float32)


def _arc(span_deg=252.0, r=35.0, n=80):
    a0 = -np.deg2rad(span_deg) / 2
    a1 = np.deg2rad(span_deg) / 2
    a = np.linspace(a0, a1, n)
    return np.column_stack([50 + r * np.cos(a), 50 + r * np.sin(a)]).astype(np.float32)


def test_geometry_ratios():
    assert rin_rout(_circle()) >= 0.8, "круг сверху должен быть D"
    assert rin_rout(_rect()) < 0.8, "прямоугольник должен быть B"
    assert rin_rout(_round_rect()) < 0.8, "скруглённый прямоугольник — B"
    # квадрат < 0.8 (теоретически ~0.707)
    sq = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.float32)
    assert rin_rout(sq) < 0.8

    # дуга цилиндра: fit → 0.85
    arc = _arc()
    score = _section_score(arc)
    assert score >= 0.8, f"дуга цилиндра должна давать >=0.8, got {score}"
    assert _fit_circle_arc(_rect()) is None, "прямоугольник не должен проходить circle-fit"


def test_stabilizer_box_vs_cylinder():
    dummy = np.zeros((10, 1, 2), np.int32)
    mask = np.zeros((10, 10), np.uint8)

    # коробка с редкими ложными пиками → LOCK B
    s = DecisionStabilizer(window=8, confirm_frames=5, enter_circle=0.8)
    locked_zone = None
    seq = [0.55, 0.84, 0.56, 0.58, 0.57, 0.59, 0.55, 0.56, 0.58, 0.57, 0.55, 0.56, 0.57, 0.58]
    for r in seq:
        m = ObjectMeasurement(120, 80, 40, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=0.5)
        d = s.update(m)
        if d.locked and d.result:
            locked_zone = d.result.category.zone
    assert locked_zone == "B", f"коробка должна LOCK B, got {locked_zone}"

    # цилиндр → LOCK D
    s2 = DecisionStabilizer(window=8, confirm_frames=5, enter_circle=0.8)
    locked_zone = None
    for r in [0.90] * 16:
        m = ObjectMeasurement(100, 50, 50, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=0.88)
        d = s2.update(m)
        if d.locked and d.result:
            locked_zone = d.result.category.zone
    assert locked_zone == "D", f"цилиндр должен LOCK D, got {locked_zone}"

    # после LOCK D не прыгаем в B
    for r in [0.4] * 10:
        m = ObjectMeasurement(100, 50, 50, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=0.4)
        d = s2.update(m)
        assert d.locked and d.result and d.result.category.zone == "D"

    # early B, then устойчивый круг → апгрейд в D (те же габариты)
    s3 = DecisionStabilizer(window=8, confirm_frames=6, enter_circle=0.8)
    for r in [0.55] * 20:
        m = ObjectMeasurement(100, 50, 50, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=0.5)
        d = s3.update(m)
    assert d.locked and d.result.category.zone == "B"
    for r in [0.86] * 16:
        m = ObjectMeasurement(100, 50, 50, r, 1000, (1, 1), dummy, mask, top_ratio=0.72, section_ratio=0.86)
        d = s3.update(m)
    assert d.locked and d.result.category.zone == "D", f"ожидали апгрейд B→D, got {d.result.category.zone}"

    # смена объекта круг→коробка по габаритам → новый LOCK B
    saw_reset = False
    locked_b = False
    for r in [0.45] * 25:
        m = ObjectMeasurement(240, 120, 50, r, 1000, (1, 1), dummy, mask, top_ratio=0.45, section_ratio=0.27)
        d = s3.update(m)
        if d.present and not d.locked:
            saw_reset = True
        if d.locked and d.result and d.result.category.zone == "B":
            locked_b = True
    assert saw_reset, "при смене габаритов должен быть сброс LOCK"
    assert locked_b, "коробка после смены должна LOCK B"


def test_background_map_splits_object_from_platform():
    """Цилиндр на платформе: скалярная высота сливает их, фоновая карта — нет."""
    H, W = 480, 640
    belt = 600
    bg = np.full((H, W), belt, np.uint16)
    bg[100:340, 130:470] = belt - 80  # платформа 80 мм — часть фона

    depth = bg.copy()
    yy, xx = np.ogrid[:H, :W]
    circ = (yy - 220) ** 2 + (xx - 300) ** 2 <= 70**2
    depth[circ] = belt - 80 - 60  # круглый предмет 60 мм на платформе

    # старый способ: платформа+цилиндр в одном контуре (большая площадь)
    seg_old = segment_object(depth, belt_distance_mm=belt, min_area_px=400)
    assert seg_old is not None
    area_old = int((seg_old[0] > 0).sum())
    assert area_old > 240 * 340 * 0.8, "скалярный способ должен захватить платформу"

    # с фоновой картой: только цилиндр
    seg_bg = segment_object(depth, belt_distance_mm=belt, min_area_px=400, background_mm=bg)
    assert seg_bg is not None
    mask, contour = seg_bg
    area = int((mask > 0).sum())
    circle_area = np.pi * 70 * 70
    assert abs(area - circle_area) / circle_area < 0.15, f"площадь {area} vs круг {circle_area:.0f}"

    m = measure_object(
        depth, mask, contour,
        belt_distance_mm=belt, fx=670, fy=670, cx=320, cy=240,
        background_mm=bg,
    )
    assert m is not None
    assert abs(m.height_mm - 60) < 8, f"высота от платформы должна быть ~60, got {m.height_mm:.1f}"
    assert m.top_ratio >= 0.8, f"вид сверху круг, got {m.top_ratio:.3f}"


def test_uncertain_fallback_to_safe_zone():
    """Нет консенсуса (ratio скачет у порога) → «неуверенно» → безопасная зона C."""
    from classify import Category

    dummy = np.zeros((10, 1, 2), np.int32)
    mask = np.zeros((10, 10), np.uint8)

    s = DecisionStabilizer(window=8, confirm_frames=6, uncertain_after=25, fallback=Category.OVERSIZE)
    seq = ([0.70] * 6 + [0.90] * 6) * 5  # блоками вокруг порога 0.8
    final = None
    for i, r in enumerate(seq):
        m = ObjectMeasurement(100, 50, 50, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=r)
        d = s.update(m)
        if d.locked:
            final = (i + 1, d)
            break
    assert final is not None, "fallback должен сработать"
    n_frames, d = final
    assert d.uncertain, "LOCK должен быть помечен как неуверенный"
    assert d.result is not None and d.result.category.zone == "C"
    assert "НЕУВЕРЕННО" in d.result.reason
    assert n_frames <= 30, f"fallback должен сработать около 25 кадров, got {n_frames}"

    # уверенная коробка не должна помечаться «неуверенно»
    s2 = DecisionStabilizer(window=8, confirm_frames=6, uncertain_after=25)
    got = None
    for r in [0.5] * 20:
        m = ObjectMeasurement(120, 80, 40, r, 1000, (1, 1), dummy, mask, top_ratio=r, section_ratio=r)
        d2 = s2.update(m)
        if d2.locked:
            got = d2
            break
    assert got is not None and not got.uncertain
    assert got.result is not None and got.result.category.zone == "B"


def test_tracker_two_objects_ids_and_stats():
    """Коробка + цилиндр одновременно: два ID, статистика считает каждого один раз."""
    from tracker import MultiObjectTracker

    dummy = np.zeros((10, 1, 2), np.int32)
    mask = np.zeros((10, 10), np.uint8)

    def factory():
        return DecisionStabilizer(window=8, confirm_frames=5, enter_circle=0.8)

    t = MultiObjectTracker(factory, max_dist_px=120, lost_frames=8)
    all_events = []
    for _ in range(20):
        box = ObjectMeasurement(120, 80, 40, 0.55, 1000, (100, 100), dummy, mask,
                                top_ratio=0.55, section_ratio=0.5)
        cyl = ObjectMeasurement(100, 50, 50, 0.90, 900, (500, 300), dummy, mask,
                                top_ratio=0.90, section_ratio=0.88)
        tracks, events = t.update([box, cyl])
        all_events.extend(events)

    assert len(tracks) == 2, f"должно быть 2 трека, got {len(tracks)}"
    ids = sorted(tr.track_id for tr in tracks)
    assert ids == [1, 2], f"ID должны быть 1 и 2, got {ids}"
    zones = sorted(ev.decision.result.category.zone for ev in all_events)
    assert zones == ["B", "D"], f"события LOCK для B и D, got {zones}"
    assert t.stats["B"] == 1 and t.stats["D"] == 1 and t.stats["total"] == 2

    # объекты убрали → треки умирают (залоченные живут дольше), статистика остаётся
    for _ in range(40):
        tracks, _ = t.update([])
    assert not tracks
    assert t.stats["total"] == 2

    # тот же товар на том же месте вернулся → без нового LOCK и без роста счётчика
    events_back = []
    for _ in range(15):
        box = ObjectMeasurement(120, 80, 40, 0.55, 1000, (100, 100), dummy, mask,
                                top_ratio=0.55, section_ratio=0.5)
        tracks, events = t.update([box])
        events_back.extend(events)
    assert not events_back, "повторный захват уже учтённого товара не должен давать LOCK"
    assert tracks and tracks[0].track_id == 1
    assert tracks[0].frozen is not None and tracks[0].decision.locked
    assert t.stats["B"] == 1 and t.stats["total"] == 2

    # новый объект в другом месте получает следующий ID
    box2 = ObjectMeasurement(200, 100, 60, 0.5, 1200, (300, 200), dummy, mask,
                             top_ratio=0.5, section_ratio=0.4)
    for _ in range(20):
        tracks, events = t.update([box2])
    assert tracks and any(tr.track_id == 3 for tr in tracks)
    assert t.stats["B"] == 2 and t.stats["total"] == 3


def test_tracker_slot_dedup_same_object():
    """Тот же товар на том же месте с новым track_id — без повторного LOCK."""
    from tracker import MultiObjectTracker, slot_key

    dummy = np.zeros((10, 1, 2), np.int32)
    mask = np.zeros((10, 10), np.uint8)

    def factory():
        return DecisionStabilizer(window=8, confirm_frames=5, enter_circle=0.8)

    t = MultiObjectTracker(factory, max_dist_px=120, lost_frames=8)
    box = ObjectMeasurement(120, 80, 40, 0.55, 1000, (100, 100), dummy, mask,
                            top_ratio=0.55, section_ratio=0.5)
    all_events = []
    for _ in range(20):
        tracks, events = t.update([box])
        all_events.extend(events)
    assert all_events, "первый LOCK должен быть"
    sk = slot_key(100, 100, 120, 80, 40, "B")
    assert sk in t._seen_slots

    # новый track_id, та же позиция — события нет, счётчик не растёт
    for _ in range(40):
        tracks, _ = t.update([])
    box2 = ObjectMeasurement(118, 82, 41, 0.56, 1000, (102, 98), dummy, mask,
                             top_ratio=0.56, section_ratio=0.5)
    extra = []
    for _ in range(20):
        tracks, events = t.update([box2])
        extra.extend(events)
    assert not extra, "повтор того же слота не должен давать LOCK"
    assert t.stats["total"] == 1


def test_shadow_not_detected_as_object():
    """Тень на ленте (затемнение без смены цвета) не должна давать RGB-объект."""
    from measure import segment_rgb_objects

    H, W = 480, 640
    bg = np.full((H, W, 3), (90, 130, 160), np.uint8)  # коричневая лента BGR
    color = bg.copy()
    # мягкая тень: все каналы ×0.55 — типичная тень от коробки
    color[150:300, 200:420] = (bg[150:300, 200:420].astype(np.float32) * 0.55).astype(np.uint8)
    objs = segment_rgb_objects(color, bg, min_area_px=400, diff_threshold=35)
    assert not objs, f"тень не должна детектироваться, got {len(objs)}"


def test_merge_overlapping_halves():
    """Две половины одного объекта с пересечением ≥50% → один контур."""
    from measure import merge_overlapping_masks, mask_overlap_min

    H, W = 100, 100
    a = np.zeros((H, W), np.uint8)
    b = np.zeros((H, W), np.uint8)
    a[20:60, 20:60] = 255  # 40×40
    b[20:60, 35:75] = 255  # перекрытие 40×25 = 1000 / 1600 = 0.625
    assert mask_overlap_min(a, b) >= 0.5
    ca, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cb, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    merged = merge_overlapping_masks([(a, ca[0]), (b, cb[0])], overlap_thr=0.5)
    assert len(merged) == 1, f"ожидали 1 объект, got {len(merged)}"


def test_noise_measurement_rejected():
    """Шум 0×0×0 / мелкие RGB-пятна не должны классифицироваться как негабарит."""
    from measure import ObjectMeasurement, is_plausible_measurement

    dummy = np.zeros((10, 1, 2), np.int32)
    mask = np.zeros((10, 10), np.uint8)
    noise = ObjectMeasurement(0.0, 0.0, 0.0, 0.1, 80, (10, 10), dummy, mask, source="rgb")
    assert not is_plausible_measurement(noise)
    speckle = ObjectMeasurement(12.0, 8.0, 0.0, 0.2, 500, (50, 50), dummy, mask, source="rgb")
    assert not is_plausible_measurement(speckle)
    ok = ObjectMeasurement(110.0, 70.0, 28.0, 0.6, 1200, (100, 100), dummy, mask)
    assert is_plausible_measurement(ok)


def test_flat_phone_via_rgb():
    """Телефон 8 мм: depth не видит (порог 12 мм), RGB-фон находит → класс C."""
    from classify import Category, classify
    from measure import measure_flat_object, segment_rgb_objects

    H, W = 480, 640
    belt = 534
    bg_color = np.full((H, W, 3), 120, np.uint8)  # серая лента
    color = bg_color.copy()
    x0, y0, pw, ph = 250, 180, 172, 80  # ≈160×75 мм при fx=564, z=534
    color[y0 : y0 + ph, x0 : x0 + pw] = (30, 30, 30)  # тёмный телефон

    depth = np.full((H, W), belt, np.uint16)
    depth[y0 : y0 + ph, x0 : x0 + pw] = belt - 8  # всего 8 мм над лентой
    rng = np.random.default_rng(0)
    depth = (depth.astype(np.int32) + rng.integers(-3, 4, size=depth.shape)).astype(np.uint16)

    objs = segment_rgb_objects(color, bg_color, min_area_px=400)
    assert objs, "телефон должен найтись по RGB-фону"
    mask, contour = objs[0]
    m = measure_flat_object(
        depth, mask, contour,
        belt_distance_mm=belt, fx=564.0, fy=564.0, cx=320, cy=240,
        background_mm=np.full((H, W), belt, np.uint16),
    )
    assert m is not None and m.source == "rgb"
    assert abs(m.length_mm - 160) < 15, f"длина ~160, got {m.length_mm:.0f}"
    assert abs(m.width_mm - 75) < 12, f"ширина ~75, got {m.width_mm:.0f}"
    assert m.height_mm < 12, f"высота должна быть маленькой, got {m.height_mm:.0f}"
    r = classify(m)
    assert r.category == Category.OVERSIZE, "тоньше 10 мм → C по ТЗ (меньше минимума)"


if __name__ == "__main__":
    test_geometry_ratios()
    test_stabilizer_box_vs_cylinder()
    test_background_map_splits_object_from_platform()
    test_uncertain_fallback_to_safe_zone()
    test_tracker_two_objects_ids_and_stats()
    test_tracker_slot_dedup_same_object()
    test_noise_measurement_rejected()
    test_merge_overlapping_halves()
    test_shadow_not_detected_as_object()
    test_flat_phone_via_rgb()
    print("OK: geometry + stabilizer tests passed")
