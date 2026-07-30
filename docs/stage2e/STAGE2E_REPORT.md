# STAGE 2E REPORT — Runtime visual, physics profiling, HTTPS domain, phone

## 1. STAGE_2E_STATUS

**PARTIAL_SORTER_PUBLIC_RUNTIME**

## 2. EXECUTIVE_SUMMARY

- Physics step p95 measured on GTX 1080: **≈ 0.20 ms** across all four profiles (budget ≤ 4 ms) — PASS.
- Hardware GPU frame performance remains PASS (avg 60 FPS, p95 ≈ 16.8–17.5 ms, draws ≤ 174, tris ≤ 216k).
- Runtime visual evidence: real WebM captures for all 7 SKU routes + 4 slow-motion 0.25×; screenshots for overlay/contact/settled phases; no teleport path.
- Drop validation **7/7 × 10/10**; runtime/headless hash **equal** (`2ee3ad6fa2e90f4b`).
- Permanent domain `sorter.arhipovdan.ru` still **BLOCKED** (A→185.160.137.162 openresty 404 / TLS unrecognized_name; no Cloudflare origin cert).
- Real Android / iPhone / Telegram: **NOT_TESTED**; `/device-test` QR + protocol ready.
- Main remaining blocker: **DNS/Cloudflare access** (and physical phone once HTTPS works).

## 3. GIT_SAFETY

- Backup: `/tmp/ozone-before-stage2e/`
- Tag: `backup/pre-stage2e-runtime-domain-phone-20260730-1311`
- Branch: `feature/ozon-sorter-stage-2e-runtime-domain-phone` (from Stage 2D `014a460`)
- No reset/hard/stash/rebase/force-push; main/dan_branch untouched

## 4. PHYSICS_INSTRUMENTATION

| Item | Detail |
|------|--------|
| Step site | `RapierStepper` in `SorterPhysics.tsx` — `world.step()` only |
| Timestep | `PHYSICS_DT = 1/60` |
| Max substeps | 4 |
| Sampler | `PhysicsPerfSampler` ring buffer 1800 samples |
| Exposure | `window.__PHYSICS_PERF__` when `?perf=1` / `?physicsPerf=1` |
| React in hot loop | **No** — ref + window; UI polls 500 ms |
| Render time mixed? | **No** |

## 5. PHYSICS_RESULTS

Hardware: ANGLE Vulkan · NVIDIA GeForce GTX 1080. Median of 3× ≥30 s runs.

| Profile | Avg | Median | P95 | P99 | Max | >4 ms | Bodies | Contacts | Result |
|---------|-----|--------|-----|-----|-----|-------|--------|----------|--------|
| Belt only | 0.079 | 0.100 | **0.200** | 0.200 | 1.70 | 0 | ~3 | 0 | PASS |
| Mechanism contact | 0.074 | 0.100 | **0.200** | 0.200 | 0.50 | 0 | ~3 | 0 | PASS |
| Drop collision | 0.071 | 0.100 | **0.200** | 0.200 | 0.50 | 0 | ~3 | 0 | PASS |
| Worst case | 0.074 | 0.100 | **0.200** | 0.200 | 0.40 | 0 | ~3 | 0 | PASS |

Budget optimization not required.

## 6. PERFORMANCE_RESULTS

| Profile | GPU | Avg FPS | Min | P95 frame | Physics P95 | Draws | Tris | Result |
|---------|-----|---------|-----|-----------|-------------|-------|------|--------|
| A CAD Light | GTX 1080 | 60 | 50 | 16.8 | 0.20 | 162 | 182k | PASS |
| B CAD+Physics | GTX 1080 | 60 | 34 | 17.3 | 0.20 | 160 | 197k | PASS |
| C Full Runtime | GTX 1080 | 60 | 33 | 17.5 | 0.20 | 160–174 | 197–216k | PASS |
| E Mobile SVG @390 | N/A | — | — | — | — | — | — | PASS_SVG_POLICY |
| E Low 3D @800 | GTX 1080 | 60 | — | 18.1 | 0.20 | 106 | 177k | PASS |

## 7. RUNTIME_VISUAL_REVIEW

Videos in `docs/stage2e/videos/` (Playwright recordVideo, Vulkan GPU).

| SKU | Zone | Runtime runs | Contact | Penetration | Teleport | Settled | Visual | Result |
|-----|------|--------------|---------|-------------|----------|---------|--------|--------|
| SKU-001 box | B | video+slow | N/A (B) | none observed | NO | video | PASS | PASS |
| SKU-009 pen | C | video | yes | none observed | NO | video | PASS | PASS |
| SKU-005 pouf | C | video | yes | none observed | NO | video | PASS | PASS |
| SKU-004 oversized | C | video+slow | yes | none observed | NO | video | PASS | PASS |
| SKU-007 bottle | D | video | yes | none observed | NO | video/screenshot | PASS | PASS |
| SKU-006 plate | D | video+slow | yes | none observed | NO | video | PASS | PASS |
| SKU-008 cylinder | D | video+slow | yes | none observed | NO | video | PASS | PASS |

Debug collider evidence: `01-physics-overlay.png`, `02-mechanism-contact.png` (`?debug=1&physics=1`).

## 8. RUNTIME_HEADLESS_PARITY

- runtimeHash: `2ee3ad6fa2e90f4b`
- headlessHash: `2ee3ad6fa2e90f4b`
- Fields: timestep, maxSubsteps, gravity, settleSeconds, pusher geometry/timing, static colliders, SKU friction/restitution/damping/collider sizes, receiver volumes
- Result: **PASS**

## 9. DROP_VALIDATION

**7/7 × 10/10 PASS** — see `drop-validation.json`. Route B contact N/A (no pusher); C/D require `pusherContactMade`.

## 10. PUBLIC_DOMAIN

| Check | Result |
|-------|--------|
| DNS A | 185.160.137.162 |
| HTTP | openresty 404 |
| HTTPS | TLS unrecognized_name |
| Cloudflare Named Tunnel | NOT_CONFIGURED (no origin cert) |
| Local :3100 | PASS |
| Blocker | **BLOCKED_BY_DEPLOYMENT_ACCESS** |

Owner action: replace `sorter` A with CNAME → `<TUNNEL_ID>.cfargotunnel.com` (Proxied). Do not change apex.

## 11. REAL_PHONE_VALIDATION

| Device | Browser | Renderer | Mode | FPS | Layout | Controls | Result |
|--------|---------|----------|------|-----|--------|----------|--------|
| Android | — | — | — | — | — | — | NOT_TESTED |
| iPhone | — | — | — | — | — | — | NOT_TESTED |
| Telegram | — | — | — | — | — | — | NOT_TESTED |

`/device-test` QR encodes `https://sorter.arhipovdan.ru/device-test` (no tokens). Protocol in `mobile-real-device-report.md`.

## 12. MOBILE_FALLBACK

- Width &lt; 640 → SVG by policy — PASS
- Telegram WebView → forced SVG — PASS (e2e)
- Capable Low 3D @800 — PASS (60 FPS)

## 13. DEPLOYMENT

| Item | Value |
|------|-------|
| Image | `owl-web:stage2e-20260730-140024` / `owl-web:latest` |
| Container | `owl-web-1` on `127.0.0.1:3100` |
| Asset | `index-DW5Sc3w-.js` |
| Rollback | `owl-web-1-rollback-stage2d` (image `owl-web:20260730-121615`) + prior stage2e rename containers |
| Preview | `http://127.0.0.1:3101` |

See `deployment-report.md`.

## 14. TEST_RESULTS

| Suite | Result |
|-------|--------|
| `npx tsc -b` | PASS |
| `npm test` (202) | PASS |
| `npm run build` | PASS |
| Physics profiles | PASS |
| Drop 7×10 | PASS |
| Hash parity | PASS |
| Console errors (lab) | 0 |
| e2e safety / mobile / production smoke | re-run after overlay fix |

## 15. KNOWN_LIMITATIONS

- Permanent HTTPS blocked externally
- No real handset in lab
- Playwright drawCalls=1 on some runs = reset race (filtered for median)
- Mechanism remains SPEC_DERIVED_CAD (author CAD still missing)

## 16. DECISION

| Question | Answer |
|----------|--------|
| Physics p95 measured? | **YES** |
| Budget ≤4 ms? | **YES (~0.20 ms)** |
| Runtime physics evidenced? | **YES (videos + screenshots)** |
| Runtime/headless match? | **YES** |
| Permanent domain works? | **NO** |
| Android tested? | **NO** |
| iPhone tested? | **NO** |
| Telegram tested? | **NO** (policy e2e only) |
| Public demo ready? | **PARTIAL** — local/lab ready; domain+phone required for full public demo |

## 17. FILES_CHANGED

- `src/domain/physicsPerf.ts` (new)
- `src/components/ThreeD/SorterPhysics.tsx` — instrumentation
- `src/components/ThreeD/PerfOverlay.tsx` — physics p95 line
- `src/domain/physicsConfigHash.ts` — expanded snapshot
- `src/domain/demoPlaylist.ts` — pouf_c (12 cases)
- `src/pages/DeviceTestPage.tsx` — QR + physics p95
- `scripts/stage2e-*.mts`
- `docs/stage2e/**`
- e2e playlist length / dismissFinished / mobile width fix
- `qrcode` dependency

## 18. FINAL_GIT_CHECK

Filled at commit time.
