"""JSONL-журнал решений классификатора — метрики для отчёта и защиты.

Каждая строка — одно зафиксированное решение (LOCK):
время, зона, габариты, circle_ratio, флаг «неуверенно», причина.

Анализ (корректность, доля неуверенных, распределение зон):
  .venv/bin/python -c "
  import json;
  rows=[json.loads(l) for l in open('logs/decisions.jsonl')];
  from collections import Counter;
  print(Counter(r['zone'] for r in rows));
  print('uncertain:', sum(r['uncertain'] for r in rows), '/', len(rows))"
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from classify import ClassificationResult


def append_decision(
    path: str | Path,
    result: ClassificationResult,
    uncertain: bool = False,
    source: str = "main",
    track_id: int | None = None,
) -> None:
    entry = {
        "track_id": track_id,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "ts_ms": int(time.time() * 1000),
        "zone": result.category.zone,
        "category": result.category.value,
        "label_ru": result.category.ru_label,
        "dims_mm": [round(float(x), 1) for x in result.dims_sorted_mm],
        "circle_ratio": round(float(result.circle_ratio), 4),
        "uncertain": bool(uncertain),
        "reason": result.reason,
        "source": source,
    }
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
