"""Классификация строго по правилам ТЗ трека 3."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence, Tuple

from measure import ObjectMeasurement


class Category(str, Enum):
    SUITABLE = "suitable"      # Подходит для сортировки → B
    OVERSIZE = "oversize"      # Не подходит по габаритам → C
    NEED_PACK = "need_pack"    # Не подходит без доупаковки → D

    @property
    def zone(self) -> str:
        return {
            Category.SUITABLE: "B",
            Category.OVERSIZE: "C",
            Category.NEED_PACK: "D",
        }[self]

    @property
    def ru_label(self) -> str:
        return {
            Category.SUITABLE: "Подходит для сортировки",
            Category.OVERSIZE: "Не подходит для сортировки по габаритам",
            Category.NEED_PACK: "Не подходит для сортировки без доупаковки",
        }[self]

    @property
    def short_label(self) -> str:
        """Короткая метка для HUD и веб-статуса."""
        return {
            Category.SUITABLE: "ГОТОВ К СОРТИРОВКЕ",
            Category.OVERSIZE: "НЕГАБАРИТ",
            Category.NEED_PACK: "ТРЕБУЕТ ДОУПАКОВКИ",
        }[self]


@dataclass
class ClassificationResult:
    category: Category
    dims_sorted_mm: Tuple[float, float, float]
    circle_ratio: float
    passes_size: bool
    is_circular: bool
    reason: str


def _sorted_dims(length: float, width: float, height: float) -> Tuple[float, float, float]:
    a, b, c = sorted([float(length), float(width), float(height)], reverse=True)
    return a, b, c


def check_size(
    dims_sorted: Sequence[float],
    min_mm: Sequence[float],
    max_mm: Sequence[float],
) -> bool:
    """
    ТЗ: габариты строго больше минимума и строго меньше максимума
    по сопоставленным сторонам после сортировки.
    """
    min_s = sorted([float(x) for x in min_mm], reverse=True)
    max_s = sorted([float(x) for x in max_mm], reverse=True)
    d = [float(x) for x in dims_sorted]
    return all(d[i] > min_s[i] for i in range(3)) and all(d[i] < max_s[i] for i in range(3))


def classify(
    measurement: ObjectMeasurement,
    min_mm: Sequence[float] = (10, 10, 10),
    max_mm: Sequence[float] = (450, 320, 320),
    circle_ratio_threshold: float = 0.8,
) -> ClassificationResult:
    """
    Порядок ТЗ:
    1) габариты → иначе C (приоритет над кругом)
    2) если r_in/r_out >= 0.8 в любом сечении → D
    3) иначе → B
    """
    dims = _sorted_dims(measurement.length_mm, measurement.width_mm, measurement.height_mm)
    passes = check_size(dims, min_mm, max_mm)
    ratio = float(measurement.circle_ratio)
    circular = ratio >= float(circle_ratio_threshold)
    clipped = bool(getattr(measurement, "clipped_by_frame", False))

    if not passes or clipped:
        reason = (
            "объект обрезан краем кадра → габарит неполный, считаем негабаритом"
            if clipped and passes
            else "габариты вне допуска: нужно >10×10×10 и <450×320×320 мм"
        )
        if clipped and not passes:
            reason = "габариты вне допуска (в т.ч. обрезан кадром): нужно >10×10×10 и <450×320×320 мм"
        return ClassificationResult(
            category=Category.OVERSIZE,
            dims_sorted_mm=dims,
            circle_ratio=ratio,
            passes_size=False,
            is_circular=circular,
            reason=reason,
        )

    if circular:
        return ClassificationResult(
            category=Category.NEED_PACK,
            dims_sorted_mm=dims,
            circle_ratio=ratio,
            passes_size=True,
            is_circular=True,
            reason=f"круг в сечении: r_in/r_out={ratio:.3f} >= {circle_ratio_threshold}",
        )

    return ClassificationResult(
        category=Category.SUITABLE,
        dims_sorted_mm=dims,
        circle_ratio=ratio,
        passes_size=True,
        is_circular=False,
        reason=f"габариты OK, круга нет: r_in/r_out={ratio:.3f} < {circle_ratio_threshold}",
    )


def classify_from_dims(
    length_mm: float,
    width_mm: float,
    height_mm: float,
    circle_ratio: float,
    min_mm: Sequence[float] = (10, 10, 10),
    max_mm: Sequence[float] = (450, 320, 320),
    circle_ratio_threshold: float = 0.8,
) -> ClassificationResult:
    fake = ObjectMeasurement(
        length_mm=length_mm,
        width_mm=width_mm,
        height_mm=height_mm,
        circle_ratio=circle_ratio,
        area_px=0,
        centroid_px=(0, 0),
        contour=None,  # type: ignore
        mask=None,  # type: ignore
    )
    return classify(fake, min_mm, max_mm, circle_ratio_threshold)
