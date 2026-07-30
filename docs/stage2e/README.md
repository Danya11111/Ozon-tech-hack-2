# Stage 2E — Runtime visual, physics p95, domain, phone

Artifacts for closing Stage 2D leftover evidence only.

## Status

**PARTIAL_SORTER_PUBLIC_RUNTIME**

Local product closed (physics p95, hardware FPS, runtime videos, hash parity, drop 7×10, production+rollback). Permanent HTTPS domain and real phones remain external blockers.

## Key results

| Gate | Result |
|------|--------|
| Physics p95 | **~0.20 ms** (budget ≤4 ms) PASS |
| Hardware FPS A/B/C | 60 / p95 ~16.8–17.5 ms PASS |
| Runtime videos | 7 routes + 4×0.25 slow WebMs PASS |
| Hash parity | `2ee3ad6fa2e90f4b` == PASS |
| Drop validation | 7/7 × 10/10 PASS |
| Permanent domain | BLOCKED (openresty / TLS unrecognized_name) |
| Real phone | NOT_TESTED |
| Production | `owl-web:stage2e-20260730-140024` on `:3100` |

## Files

See directory listing — JSON profiles, videos/, screenshots/, STAGE2E_REPORT.md.
