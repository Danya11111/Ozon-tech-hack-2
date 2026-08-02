#!/usr/bin/env python3
"""Юнит-тесты правил классификации (без камеры)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from classify import Category, classify_from_dims


def test_suitable_box():
    r = classify_from_dims(120, 80, 40, circle_ratio=0.5)
    assert r.category == Category.SUITABLE
    assert r.category.zone == "B"


def test_oversize_priority_over_circle():
    # Большой цилиндр: габариты важнее круга
    r = classify_from_dims(500, 100, 100, circle_ratio=0.95)
    assert r.category == Category.OVERSIZE
    assert r.category.zone == "C"


def test_too_small():
    r = classify_from_dims(5, 5, 5, circle_ratio=0.2)
    assert r.category == Category.OVERSIZE


def test_need_pack_cylinder():
    r = classify_from_dims(100, 50, 50, circle_ratio=0.85)
    assert r.category == Category.NEED_PACK
    assert r.category.zone == "D"


def test_lying_bottle_must_be_D_not_B():
    """ТЗ: круг в ЛЮБОМ сечении. Лежачая бутылка сверху не круг, но сечение круглое."""
    # имитация: top-view низкий, но итоговый circle_ratio после 3D-срезов высокий
    r = classify_from_dims(220, 70, 70, circle_ratio=0.86)
    assert r.category == Category.NEED_PACK
    assert r.category.zone == "D"


def test_strict_circle_boundary():
    """Официально: круг только при K > 0.8. K == 0.8 → B (не D)."""
    below = classify_from_dims(100, 50, 50, circle_ratio=0.799999)
    assert below.category == Category.SUITABLE
    assert below.category.zone == "B"
    assert below.is_circular is False

    exact = classify_from_dims(100, 50, 50, circle_ratio=0.8)
    assert exact.category == Category.SUITABLE
    assert exact.category.zone == "B"
    assert exact.is_circular is False

    above = classify_from_dims(100, 50, 50, circle_ratio=0.800001)
    assert above.category == Category.NEED_PACK
    assert above.category.zone == "D"
    assert above.is_circular is True


def test_normal_non_circular_B():
    r = classify_from_dims(120, 80, 40, circle_ratio=0.5)
    assert r.category == Category.SUITABLE
    assert r.category.zone == "B"


def test_normal_circular_above_threshold_D():
    r = classify_from_dims(100, 50, 50, circle_ratio=0.81)
    assert r.category == Category.NEED_PACK
    assert r.category.zone == "D"


def test_oversized_circular_still_C():
    r = classify_from_dims(500, 100, 100, circle_ratio=0.95)
    assert r.category == Category.OVERSIZE
    assert r.category.zone == "C"


def test_border_dims_strict():
    """ТЗ: строго больше 10×10×10 и строго меньше 450×320×320."""
    # ровно на максимуме → C
    assert classify_from_dims(450, 320, 320, 0.3).category == Category.OVERSIZE
    # ровно на минимуме → C
    assert classify_from_dims(10, 10, 10, 0.3).category == Category.OVERSIZE
    # чуть внутри границ → B
    assert classify_from_dims(449, 319, 319, 0.3).category == Category.SUITABLE
    assert classify_from_dims(11, 11, 11, 0.3).category == Category.SUITABLE
    # 321 мм влезает вдоль оси 450 → B (сопоставление после сортировки)
    assert classify_from_dims(100, 321, 100, 0.3).category == Category.SUITABLE
    # а вот две стороны > 320 уже не влезают → C
    assert classify_from_dims(400, 330, 100, 0.3).category == Category.OVERSIZE


def test_dims_order_independent():
    """Стороны сопоставляются после сортировки — порядок L/W/H не важен."""
    assert classify_from_dims(319, 449, 318, 0.3).category == Category.SUITABLE
    assert classify_from_dims(318, 319, 449, 0.3).category == Category.SUITABLE
    # ровно 320 по строгому правилу «меньше» → C, в любом порядке
    assert classify_from_dims(320, 449, 319, 0.3).category == Category.OVERSIZE
    assert classify_from_dims(319, 320, 449, 0.3).category == Category.OVERSIZE


if __name__ == "__main__":
    test_suitable_box()
    test_oversize_priority_over_circle()
    test_too_small()
    test_need_pack_cylinder()
    test_lying_bottle_must_be_D_not_B()
    test_strict_circle_boundary()
    test_normal_non_circular_B()
    test_normal_circular_above_threshold_D()
    test_oversized_circular_still_C()
    test_border_dims_strict()
    test_dims_order_independent()
    print("OK: all classification tests passed")
