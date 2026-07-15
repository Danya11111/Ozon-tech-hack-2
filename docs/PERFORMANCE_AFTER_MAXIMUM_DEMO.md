# PERFORMANCE_AFTER_MAXIMUM_DEMO

Measured: 2026-07-15
Commits referenced: `985f7c3` / tooling on current branch

## Bundle (production container, unchanged)

| Метрика | Значение |
| ------- | -------: |
| Main chunk | `index-ncgt6PBL.js` |
| Release | `20260715-1712` |

## software/headless WebGL diagnostic baseline

**Не является характеристикой живой демонстрации.**

```text
Average FPS: 9.6
Minimum FPS: 3.3
p95 frame time: 200 ms
```

Повторено под xvfb/SwiftShader (~8.9 FPS demo) — см. `HEADED_GPU_PERFORMANCE_REPORT.md`.

## Headed / GPU tooling

| Item | Status |
| ---- | ------ |
| `?perf=1` overlay | Implemented |
| `?quality=low\|medium\|high\|demo` | Implemented |
| `npm run perf:gpu` | Writes report + JSON |
| Hardware NVIDIA WebGL in coder | **Not available** (Chromium → SwiftShader) |
| True GPU baseline | Run on presentation laptop with DISPLAY + real GPU |

## Notes

- Demo quality keeps `shadows=false` for stable FPS.
- Do not quote SwiftShader FPS to jury as demo capability.
