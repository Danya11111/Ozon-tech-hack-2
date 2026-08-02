"""Трекинг нескольких объектов в кадре: ID + статистика зон за сессию.

Сопоставление кадр-к-кадру по ближайшему центроиду. На каждый трек —
свой DecisionStabilizer. LOCK в ленту/MQTT — один раз на товар: после
фиксации запоминаем «отпечаток» (центр+габариты); если depth кратковременно
пропал и объект нашёлся снова рядом — трек возрождается без нового LOCK.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from classify import ClassificationResult
from measure import ObjectMeasurement
from stabilize import DecisionStabilizer, StableDecision


@dataclass
class Track:
    track_id: int
    stabilizer: DecisionStabilizer
    centroid: Tuple[int, int]
    miss: int = 0
    counted_zone: Optional[str] = None
    counted_uncertain: bool = False
    measurement: Optional[ObjectMeasurement] = None
    decision: Optional[StableDecision] = None
    reported: bool = False  # уже ушёл в ленту — повторно не пишем
    frozen: Optional[StableDecision] = None  # снимок первого LOCK (для возрождения)


@dataclass
class LockEvent:
    track_id: int
    decision: StableDecision


@dataclass
class _Fingerprint:
    """Товар уже зафиксирован — не считаем повторно при перезахвате."""
    track_id: int
    cx: int
    cy: int
    length_mm: float
    width_mm: float
    height_mm: float
    zone: str
    uncertain: bool
    result: ClassificationResult
    age: int = 0  # кадров без детекции


def slot_key(cx: int, cy: int, L: float, W: float, H: float, zone: str) -> str:
    """Стабильный ключ товара на ленте — один физический предмет = одна запись."""
    a = sorted((L, W, H))
    return f"{cx // 35}_{cy // 35}_{int(a[0] // 12)}_{int(a[1] // 12)}_{int(a[2] // 8)}_{zone}"


class MultiObjectTracker:
    def __init__(
        self,
        stabilizer_factory: Callable[[], DecisionStabilizer],
        max_dist_px: int = 120,
        lost_frames: int = 12,
        fingerprint_ttl: int = 450,  # ~15–20 с помнить «уже учтён»
    ) -> None:
        self._factory = stabilizer_factory
        self.max_dist_px = int(max_dist_px)
        self.lost_frames = int(lost_frames)
        self.fingerprint_ttl = int(fingerprint_ttl)
        self._tracks: Dict[int, Track] = {}
        self._fps: List[_Fingerprint] = []
        self._seen_slots: Dict[str, _Fingerprint] = {}  # уже учтённые товары (позиция+габариты)
        self._next_id = 1
        self.stats: Dict[str, int] = {"B": 0, "C": 0, "D": 0, "total": 0, "uncertain": 0}

    def reset(self) -> None:
        self._tracks.clear()
        self._fps.clear()

    def update(
        self,
        measurements: List[ObjectMeasurement],
        min_mm: Sequence[float] = (10, 10, 10),
        max_mm: Sequence[float] = (450, 320, 320),
    ) -> Tuple[List[Track], List[LockEvent]]:
        free_meas = list(range(len(measurements)))
        assigned: Dict[int, int] = {}
        pairs = []
        for tid, tr in self._tracks.items():
            for mi in free_meas:
                m = measurements[mi]
                d2 = (tr.centroid[0] - m.centroid_px[0]) ** 2 + (tr.centroid[1] - m.centroid_px[1]) ** 2
                pairs.append((d2, tid, mi))
        for d2, tid, mi in sorted(pairs):
            if tid in assigned or mi not in free_meas:
                continue
            if d2 > self.max_dist_px**2:
                continue
            assigned[tid] = mi
            free_meas.remove(mi)

        events: List[LockEvent] = []

        for tid in list(self._tracks.keys()):
            tr = self._tracks[tid]
            # залоченный трек держим дольше — глянец даёт короткие выпадения depth
            kill_after = self.lost_frames * 3 if tr.counted_zone is not None else self.lost_frames
            if tid in assigned:
                m = measurements[assigned[tid]]
                tr.centroid = m.centroid_px
                tr.miss = 0
                tr.measurement = m
                tr.decision = tr.stabilizer.update(m, min_mm=min_mm, max_mm=max_mm)
                # после возрождения стабилизатор ещё «холодный» — держим прошлый LOCK на экране
                if tr.reported and tr.frozen is not None and not (tr.decision and tr.decision.locked):
                    tr.decision = tr.frozen
                self._account(tr, events)
                if tr.reported:
                    self._touch_fp(tr)
            else:
                tr.miss += 1
                tr.measurement = None
                tr.decision = tr.stabilizer.update(None, min_mm=min_mm, max_mm=max_mm)
                if tr.reported and tr.frozen is not None and not (tr.decision and tr.decision.locked):
                    tr.decision = tr.frozen
                if tr.miss >= kill_after:
                    if tr.reported and tr.frozen is not None and tr.frozen.result is not None:
                        self._remember(tr)
                    del self._tracks[tid]

        # старение отпечатков
        for fp in self._fps:
            fp.age += 1
        self._fps = [fp for fp in self._fps if fp.age < self.fingerprint_ttl]

        for mi in free_meas:
            m = measurements[mi]
            fp = self._match_fp(m)
            if fp is not None:
                # тот же товар вернулся после выпадения depth — без нового LOCK
                fp.age = 0
                fp.cx, fp.cy = m.centroid_px
                frozen = StableDecision(
                    fp.result, True, 100, fp.result.circle_ratio, True, uncertain=fp.uncertain,
                )
                tr = Track(
                    track_id=fp.track_id,
                    stabilizer=self._factory(),
                    centroid=m.centroid_px,
                    measurement=m,
                    counted_zone=fp.zone,
                    counted_uncertain=fp.uncertain,
                    reported=True,
                    frozen=frozen,
                    decision=frozen,
                )
                self._tracks[tr.track_id] = tr
                self._fps = [x for x in self._fps if x.track_id != fp.track_id]
                continue

            tr = Track(
                track_id=self._next_id,
                stabilizer=self._factory(),
                centroid=m.centroid_px,
                measurement=m,
            )
            self._next_id += 1
            tr.decision = tr.stabilizer.update(m, min_mm=min_mm, max_mm=max_mm)
            self._tracks[tr.track_id] = tr
            self._account(tr, events)

        alive = sorted(self._tracks.values(), key=lambda t: t.track_id)
        return [t for t in alive if t.measurement is not None or t.miss < (
            self.lost_frames * 3 if t.counted_zone else self.lost_frames
        )], events

    def _account(self, tr: Track, events: List[LockEvent]) -> None:
        d = tr.decision
        if d is None or not d.locked or d.result is None:
            return
        zone = d.result.category.zone
        L, W, H = d.result.dims_sorted_mm
        sk = slot_key(tr.centroid[0], tr.centroid[1], L, W, H, zone)
        if tr.counted_zone is None:
            if sk in self._seen_slots:
                # тот же товар уже был в ленте/статистике — только показываем на экране
                prev = self._seen_slots[sk]
                tr.counted_zone = prev.zone
                tr.counted_uncertain = prev.uncertain
                tr.frozen = StableDecision(
                    prev.result, True, 100, prev.result.circle_ratio, True, uncertain=prev.uncertain,
                )
                tr.reported = True
                tr.decision = tr.frozen
                return
            self.stats[zone] = self.stats.get(zone, 0) + 1
            self.stats["total"] += 1
            if d.uncertain:
                self.stats["uncertain"] += 1
            tr.counted_zone = zone
            tr.counted_uncertain = d.uncertain
            tr.frozen = StableDecision(
                d.result, True, 100, d.result.circle_ratio, True, uncertain=d.uncertain,
            )
            self._seen_slots[sk] = _Fingerprint(
                track_id=tr.track_id,
                cx=tr.centroid[0],
                cy=tr.centroid[1],
                length_mm=float(L),
                width_mm=float(W),
                height_mm=float(H),
                zone=zone,
                uncertain=d.uncertain,
                result=d.result,
            )
            if not tr.reported:
                tr.reported = True
                events.append(LockEvent(tr.track_id, tr.frozen))
        elif tr.counted_zone != zone:
            # смена зоны на экране/в счётчиках — в ленту повторно не пишем
            self.stats[tr.counted_zone] = max(0, self.stats.get(tr.counted_zone, 0) - 1)
            self.stats[zone] = self.stats.get(zone, 0) + 1
            if tr.counted_uncertain and not d.uncertain:
                self.stats["uncertain"] = max(0, self.stats["uncertain"] - 1)
                tr.counted_uncertain = d.uncertain
            tr.counted_zone = zone
            tr.frozen = StableDecision(
                d.result, True, 100, d.result.circle_ratio, True, uncertain=d.uncertain,
            )

    def _remember(self, tr: Track) -> None:
        assert tr.frozen is not None and tr.frozen.result is not None
        r = tr.frozen.result
        L, W, H = r.dims_sorted_mm
        self._fps = [fp for fp in self._fps if fp.track_id != tr.track_id]
        self._fps.append(
            _Fingerprint(
                track_id=tr.track_id,
                cx=tr.centroid[0],
                cy=tr.centroid[1],
                length_mm=float(L),
                width_mm=float(W),
                height_mm=float(H),
                zone=tr.counted_zone or r.category.zone,
                uncertain=tr.counted_uncertain,
                result=r,
                age=0,
            )
        )

    def _touch_fp(self, tr: Track) -> None:
        for fp in self._fps:
            if fp.track_id == tr.track_id:
                fp.age = 0
                fp.cx, fp.cy = tr.centroid

    def _match_fp(self, m: ObjectMeasurement) -> Optional[_Fingerprint]:
        best: Optional[_Fingerprint] = None
        best_d2 = self.max_dist_px**2
        for fp in self._fps:
            d2 = (fp.cx - m.centroid_px[0]) ** 2 + (fp.cy - m.centroid_px[1]) ** 2
            if d2 > best_d2:
                continue
            if not _dims_close(fp.length_mm, fp.width_mm, fp.height_mm, m.length_mm, m.width_mm, m.height_mm):
                continue
            best, best_d2 = fp, d2
        return best


def _dims_close(L0: float, W0: float, H0: float, L1: float, W1: float, H1: float, tol: float = 0.40) -> bool:
    """Габариты «похожи» (порядок осей уже отсортирован в classify, здесь — сырые L×W×H)."""
    a = sorted((L0, W0, H0))
    b = sorted((L1, W1, H1))
    for x, y in zip(a, b):
        if abs(x - y) / max(x, y, 1.0) > tol:
            return False
    return True
