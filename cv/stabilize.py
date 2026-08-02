"""
Стабильный консенсус по кадрам.

Из логов RealSense: круг даёт sec≈0.82–0.87, но early LOCK на B
залипал навсегда. Поэтому:
  • классификация по медиане окна;
  • LOCK после прогрева;
  • апгрейд B→D при устойчивом круге (≥ confirm кадров подряд);
  • D→B и смена зоны после LOCK запрещены (пока объект не исчез).
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
from typing import Deque, Optional, Sequence

from classify import Category, ClassificationResult, check_size
from measure import ObjectMeasurement


@dataclass
class StableDecision:
    result: Optional[ClassificationResult]
    locked: bool
    confidence_pct: int
    ratio_smooth: float
    present: bool
    uncertain: bool = False  # LOCK по правилу «нет консенсуса → безопасная зона»


class DecisionStabilizer:
    def __init__(
        self,
        window: int = 12,
        confirm_frames: int = 8,
        lost_frames: int = 12,
        enter_circle: float = 0.80,
        exit_circle: float = 0.72,
        uncertain_after: int = 45,
        fallback: Category = Category.OVERSIZE,
    ) -> None:
        self.window = max(5, int(window))
        self.confirm_frames = max(3, int(confirm_frames))
        self.lost_frames = max(3, int(lost_frames))
        self.enter_circle = float(enter_circle)
        self.exit_circle = float(exit_circle)
        # нет консенсуса за uncertain_after кадров → безопасная зона (ТЗ:
        # неоднозначные товары не должны идти в основной поток)
        self.uncertain_after = max(self.window + 5, int(uncertain_after))
        self.fallback = fallback

        self._ratios: Deque[float] = deque(maxlen=self.window)
        self._tops: Deque[float] = deque(maxlen=self.window)
        self._secs: Deque[float] = deque(maxlen=self.window)
        self._Ls: Deque[float] = deque(maxlen=self.window)
        self._Ws: Deque[float] = deque(maxlen=self.window)
        self._Hs: Deque[float] = deque(maxlen=self.window)
        self._zones: Deque[str] = deque(maxlen=self.window)

        self._pending_zone: Optional[str] = None
        self._pending_count: int = 0
        self._upgrade_count: int = 0
        self._locked: Optional[ClassificationResult] = None
        self._miss: int = 0
        self._frames_seen: int = 0
        self._uncertain_locked: bool = False

    def reset(self) -> None:
        self._ratios.clear()
        self._tops.clear()
        self._secs.clear()
        self._Ls.clear()
        self._Ws.clear()
        self._Hs.clear()
        self._zones.clear()
        self._pending_zone = None
        self._pending_count = 0
        self._upgrade_count = 0
        self._locked = None
        self._miss = 0
        self._frames_seen = 0
        self._uncertain_locked = False

    def update(
        self,
        measurement: Optional[ObjectMeasurement],
        min_mm: Sequence[float] = (10, 10, 10),
        max_mm: Sequence[float] = (450, 320, 320),
    ) -> StableDecision:
        if measurement is None:
            self._miss += 1
            if self._miss >= self.lost_frames:
                self.reset()
                return StableDecision(None, False, 0, 0.0, False)
            if self._locked is not None:
                return StableDecision(
                    self._locked, True, 100, self._locked.circle_ratio, True,
                    uncertain=self._uncertain_locked,
                )
            return StableDecision(None, False, 0, 0.0, False)

        self._miss = 0
        self._frames_seen += 1
        self._ratios.append(float(measurement.circle_ratio))
        self._tops.append(float(getattr(measurement, "top_ratio", measurement.circle_ratio)))
        self._secs.append(float(getattr(measurement, "section_ratio", 0.0)))
        self._Ls.append(float(measurement.length_mm))
        self._Ws.append(float(measurement.width_mm))
        self._Hs.append(float(measurement.height_mm))

        ratio = _median(self._ratios)
        top_m = _median(self._tops)
        sec_m = _median(self._secs)
        ratio_p75 = _percentile(self._ratios, 75)
        # устойчивый круг: медиана >= 0.8 ИЛИ (медиана сечений >= 0.8 и ≥ половины окна сильные)
        sec_strong = (
            sum(1 for x in self._secs if x >= self.enter_circle) / max(1, len(self._secs))
        )
        circular = ratio >= self.enter_circle or (
            sec_m >= self.enter_circle and sec_strong >= 0.55
        )
        ratio_show = max(ratio, sec_m) if circular else ratio

        L, W, H = _median(self._Ls), _median(self._Ws), _median(self._Hs)
        dims = tuple(sorted([L, W, H], reverse=True))
        passes = check_size(dims, min_mm, max_mm)
        clipped = bool(getattr(measurement, "clipped_by_frame", False))
        if clipped:
            # неполный габарит из-за края кадра → безопасный негабарит
            passes = False

        if not passes:
            instant = ClassificationResult(
                category=Category.OVERSIZE,
                dims_sorted_mm=(dims[0], dims[1], dims[2]),
                circle_ratio=ratio_show,
                passes_size=False,
                is_circular=circular,
                reason=(
                    "объект обрезан краем кадра → габарит неполный, считаем негабаритом"
                    if clipped
                    else "габариты вне допуска: нужно >10×10×10 и <450×320×320 мм"
                ),
            )
        elif circular:
            instant = ClassificationResult(
                category=Category.NEED_PACK,
                dims_sorted_mm=(dims[0], dims[1], dims[2]),
                circle_ratio=ratio_show,
                passes_size=True,
                is_circular=True,
                reason=(
                    f"круг: med={ratio:.3f} p75={ratio_p75:.3f} "
                    f"top={top_m:.3f} sec={sec_m:.3f} strong={sec_strong:.0%} "
                    f">= {self.enter_circle}"
                ),
            )
        else:
            instant = ClassificationResult(
                category=Category.SUITABLE,
                dims_sorted_mm=(dims[0], dims[1], dims[2]),
                circle_ratio=ratio_show,
                passes_size=True,
                is_circular=False,
                reason=(
                    f"не круг: med={ratio:.3f} sec={sec_m:.3f} "
                    f"strong={sec_strong:.0%} < {self.enter_circle}"
                ),
            )

        zone = instant.category.zone
        self._zones.append(zone)

        # --- уже есть LOCK ---
        if self._locked is not None:
            prev = self._locked.category
            cur = instant.category
            locked_dims = self._locked.dims_sorted_mm

            # новый объект (габариты сильно сменились) — сброс LOCK и набор заново
            if _dims_changed(locked_dims, dims, rel=0.28):
                self._locked = None
                self._uncertain_locked = False
                self._pending_zone = zone
                self._pending_count = 1
                self._upgrade_count = 0
                self._frames_seen = 1
                conf = int(min(99, round(100.0 * 1 / max(1, self.confirm_frames))))
                return StableDecision(instant, False, conf, ratio_show, True)

            can_upgrade = (
                (prev == Category.OVERSIZE and cur in (Category.SUITABLE, Category.NEED_PACK))
                or (prev == Category.SUITABLE and cur == Category.NEED_PACK)
            )
            if can_upgrade:
                self._upgrade_count += 1
                need_up = max(5, self.confirm_frames // 2)
                if self._upgrade_count >= need_up:
                    self._locked = instant
                    self._upgrade_count = 0
                    self._uncertain_locked = False  # появился консенсус
            else:
                self._upgrade_count = 0
            return StableDecision(
                self._locked, True, 100, ratio_show, True,
                uncertain=self._uncertain_locked,
            )

        # нет консенсуса слишком долго → «неуверенно», безопасная зона
        if self._frames_seen >= self.uncertain_after:
            fallback_result = ClassificationResult(
                category=self.fallback,
                dims_sorted_mm=(dims[0], dims[1], dims[2]),
                circle_ratio=ratio_show,
                passes_size=passes,
                is_circular=circular,
                reason="НЕУВЕРЕННО → безопасная зона: " + self._uncertain_reason(
                    ratio, dims, min_mm, max_mm
                ),
            )
            self._locked = fallback_result
            self._uncertain_locked = True
            return StableDecision(fallback_result, True, 100, ratio_show, True, uncertain=True)

        # прогрев окна
        if len(self._ratios) < self.window:
            conf = int(min(99, round(100.0 * len(self._ratios) / self.window)))
            return StableDecision(instant, False, conf, ratio_show, True)

        votes = Counter(self._zones)
        winner, win_n = votes.most_common(1)[0]
        if winner != zone:
            self._pending_zone = None
            self._pending_count = 0
            conf = int(round(100.0 * win_n / len(self._zones)))
            return StableDecision(instant, False, conf, ratio_show, True)

        need = max(self.confirm_frames, (self.window * 2 + 2) // 3)
        if zone == self._pending_zone:
            self._pending_count += 1
        else:
            self._pending_zone = zone
            self._pending_count = 1

        conf = int(min(100, round(100.0 * max(self._pending_count, win_n) / need)))
        if self._pending_count >= need and win_n >= need:
            self._locked = instant
            self._uncertain_locked = False
            return StableDecision(instant, True, 100, ratio_show, True)

        return StableDecision(instant, False, conf, ratio_show, True)

    def _uncertain_reason(
        self,
        ratio: float,
        dims: Sequence[float],
        min_mm: Sequence[float],
        max_mm: Sequence[float],
    ) -> str:
        votes = Counter(self._zones)
        parts = [
            f"нет консенсуса {self._frames_seen} кадров",
            "голоса " + " ".join(f"{z}:{n}" for z, n in votes.most_common()),
        ]
        if abs(ratio - self.enter_circle) <= 0.06:
            parts.append(f"ratio {ratio:.3f} у порога {self.enter_circle}")
        max_s = sorted([float(x) for x in max_mm], reverse=True)
        min_s = sorted([float(x) for x in min_mm], reverse=True)
        for d, mx, mn in zip(dims, max_s, min_s):
            if abs(d - mx) <= 0.05 * mx:
                parts.append(f"сторона {d:.0f} мм у лимита {mx:.0f}")
            elif mn > 0 and abs(d - mn) <= max(3.0, 0.3 * mn):
                parts.append(f"сторона {d:.0f} мм у минимума {mn:.0f}")
        return "; ".join(parts)


def _median(vals: Deque[float]) -> float:
    return _percentile(vals, 50)


def _dims_changed(
    a: Sequence[float], b: Sequence[float], rel: float = 0.28
) -> bool:
    """True если хотя бы одна сторона изменилась больше чем на rel (новый объект)."""
    if len(a) < 3 or len(b) < 3:
        return False
    for x, y in zip(a[:3], b[:3]):
        base = max(abs(float(x)), abs(float(y)), 1.0)
        if abs(float(x) - float(y)) / base > rel:
            return True
    return False


def _percentile(vals: Deque[float], q: float) -> float:
    arr = sorted(vals)
    n = len(arr)
    if n == 0:
        return 0.0
    if n == 1:
        return float(arr[0])
    pos = (q / 100.0) * (n - 1)
    lo = int(pos)
    hi = min(lo + 1, n - 1)
    frac = pos - lo
    return float(arr[lo] * (1 - frac) + arr[hi] * frac)
