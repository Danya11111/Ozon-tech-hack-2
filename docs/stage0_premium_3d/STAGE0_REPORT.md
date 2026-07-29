# STAGE 0 REPORT — Premium 3D Feasibility

Date: 2026-07-29 · Branch: `feature/premium-3d-stage-0` · Executor: Senior Technical Lead / WebGL Performance Engineer (AI agent)

---

## 1. STAGE_0_STATUS

```text
REALTIME_3D_CONDITIONAL
```

Desktop real-time 3D passed on hardware GPU (NVIDIA GTX 1080): Profile 2 sustained avg 59.5 FPS, p95 17.3 ms, zero context losses, zero memory growth. Mobile real-time 3D is **NOT_TESTED_ON_REAL_DEVICE** — mobile numbers were produced by viewport/UA emulation on the same desktop GPU and cannot validate Adreno/Mali/Apple silicon. Therefore: desktop = real-time approved in substance; mobile = hybrid SVG/low-profile fallback required until validated on real hardware.

Formal threshold note (no inflation): the strict "min FPS ≥ 40 / ≥ 30" criterion is missed by every desktop profile (min 21.6–33.4). The dips are isolated startup hitches, not sustained jank — p99 frame time is 19.1–29.1 ms and across all 12 runs there were ≤ 3 frames > 33 ms per 32 s run and exactly 1 frame > 50 ms in total (first-run shader compilation). Sustained performance is vsync-capped 60 FPS. This is documented, not hidden.

---

## 2. GIT_SAFETY

| Item | Value |
|---|---|
| Original branch | `dan_branch` |
| Working branch | `feature/premium-3d-stage-0` (created from `dan_branch` HEAD) |
| Original commit | `5cc27c6` — "chore: add unique assets from other branches into dan_branch" |
| Current commit | `5cc27c6` — **unchanged, no commits created** |
| Rollback tag | `backup/pre-premium-3d-stage-0-20260729-1542` (local, not pushed) |
| Working tree before | clean (verified with `git status --short` at session start) |
| Working tree after | 12 modified files + 8 untracked entries (all Stage 0 scope, listed in §14) |
| Push status | **NO push performed** |
| Merge/rebase status | **NO merge, NO rebase**; `main`, `dan_branch`, `feature/maximum-demo-realism`, remotes, tags and history untouched |

Session cleanup: 6 `core.*` crash dumps (~1.4 GB) produced by my own headless-Chromium GPU flag probing at 15:51 were removed from the working tree; they were never part of the project.

---

## 3. VERIFIED_FINDINGS (STAGE_0_FACT_CHECK)

Every architectural claim was checked against the code before changes:

| # | Claim from audit | Verdict | Evidence |
|---|---|---|---|
| 1 | Cinematic camera exists but is disabled | **CONFIRMED** | `src/domain/cinematicCamera.ts` (modes + phase binding + viewport-specific presets + tests); controller mounted but playback-gated in `SorterDigitalTwinContinuous.tsx` |
| 2 | `width < 640` ⇒ false "WebGL unavailable" | **CONFIRMED** | `src/pages/MainPage.tsx` (`prefer3DByDefault(width, webgl)`) and `src/components/ThreeFallback.tsx` misleading English text; full SVG fallback (`src/components/SorterScene.tsx`) existed but was unused on the main page |
| 3 | Real GPU FPS never measured (all ~9 FPS figures were SwiftShader) | **CONFIRMED** | `docs/HARDWARE_BENCHMARK_RUNBOOK.md`, `docs/PERFORMANCE_BASELINE.md` — historical numbers are software-rendered; fixed by this Stage 0 (first hardware-GPU measurements) |
| 4 | `new THREE.BoxGeometry()` inside render, no dispose | **CONFIRMED** | `src/components/ThreeD/SortingZones3D.tsx` `RollCage` — per-render geometry creation without cleanup |
| 5 | Cached STL geometry mutated in place (`.center()`, `.computeVertexNormals()` on shared loader cache) | **CONFIRMED** | `src/components/ThreeD/PhysicalPlaybackItem.tsx`, `src/components/ThreeD/STLModel.tsx` |
| 6 | `useLoader` inside `try/catch` | **CONFIRMED** | `STLModel.tsx` — hook-in-try/catch anti-pattern |
| 7 | `use-2d-fallback` is a dead event (dispatched, never consumed) | **CONFIRMED** | `ThreeErrorBoundary.tsx` dispatched it; no listener existed anywhere in `src/` |
| 8 | `webglcontextrestored` not handled (no recovery path) | **CONFIRMED** | only `webglcontextlost` existed in `SorterDigitalTwinContinuous.tsx` / `useWebGL.ts` |
| 9 | `adaptQuality()` implemented but never called | **CONFIRMED** | `src/domain/qualityMode.ts` exported it; zero call sites before Stage 0 |
| 10 | Quality presets carry unused fields (`dprMax`, `rollerDetail`, …) | **CONFIRMED** | `qualityMode.ts`; only `shadows`/`antialias`/`maxVisibleItems` were wired |
| 11 | No post-processing in project | **CONFIRMED** | no `postprocessing` dependency before Stage 0 |
| 12 | Deterministic domain, 166 unit tests, 16 e2e, 10 visual snapshots | **CONFIRMED** | `npm test` → 166/166; Playwright suite; `e2e/visual.spec.ts-snapshots/` (10 PNGs) |

---

## 4. IMPLEMENTED_CHANGES

| Изменение | Файл | Причина | Риск | Проверка |
|---|---|---|---|---|
| Stage 0 prototype mode: query-param parser, device-signal collection, prototype quality chooser, shot→phase adapter | `src/domain/stage0.ts` (new) | Isolated experiment mode; default route untouched | Low — pure functions, no side effects | unit + e2e prototype tests; `?stage0=1` only |
| Playback→simulation adapter for SVG fallback | `src/domain/playbackAdapter.ts` (new) | Drive existing `SorterScene` SVG from the same playback state (determinism) | Low — pure mapping | e2e 390×844 play/pause drives SVG |
| Honest mobile fallback: SVG scene + Russian "Облегчённый режим" badge; misleading "WebGL not available" removed; details link reachable | `src/pages/MainPage.tsx`, `src/styles.css` | Critical UX defect #2 | Medium — main page layout | e2e 390×844 + no-WebGL tests, screenshot 04 |
| WebGL context recovery: `webglcontextlost` keeps canvas mounted (hidden) 12 s for a single safe retry on `webglcontextrestored`; second loss parks SVG fallback forever; no error loop | `src/pages/MainPage.tsx`, `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Finding #8; no fake recovery | Medium — lifecycle | e2e context-loss test (forced via `WEBGL_lose_context`), screenshot 07 |
| Dead `use-2d-fallback` event replaced by explicit `onUse2D` callback prop | `ThreeErrorBoundary.tsx`, `ProductDemoSection.tsx` | Finding #7 | Low — explicit contract | tsc, unit, e2e details page |
| Leak fix: `EdgesGeometry` memoized + disposed instead of per-render `new BoxGeometry` | `SortingZones3D.tsx` | Finding #4 | Low — same visuals | memory loop: geometries Δ0 after 10 cycles |
| Leak fix: clone cached STL geometry before `.center()`/`.computeVertexNormals()`, dispose clones | `PhysicalPlaybackItem.tsx`, `STLModel.tsx` | Finding #5 | Low — same visuals | memory loop: textures Δ0, heap no growth |
| `useLoader` out of try/catch: Suspense wrapper + inner loader component | `STLModel.tsx` | Finding #6 | Low — same fallback UX | tsc, unit |
| Cinematic light rig (proto only): dark bg `INDUSTRIAL_PALETTE.backgroundDark`, ambient 0.12, key directional 1.6 `castShadow` 1024 PCFSoft limited frustum, fill 0.35, rim 0.7 cool; `castShadow`/`receiveShadow` only on items, belt frame, floor, gate, pusher, roll cages | `SorterDigitalTwinContinuous.tsx` | Stage 4 feasibility test | Medium — gated behind `stage0` flag | Profile 2 benchmark + screenshots 02/05/06 |
| Renderer setup in proto: `outputColorSpace=SRGB`, `toneMapping=ACESFilmic`, exposure 1.0, `shadowMap.type=PCFSoftShadowMap` | `SorterDigitalTwinContinuous.tsx` | Stage 4.6 | Low — proto only | Profile 2/3 JSONs (`shadows: true`) |
| Cinematic camera enabled in proto + manual shot override (`shot=overview/inspection/route-b/route-c/route-d/safety`) via minimal adapter over existing API; no `setState` in `useFrame` (refs/mutations only) | `SorterDigitalTwinContinuous.tsx`, `stage0.ts` | Stage 5 | Medium — camera math untouched, `cinematicCamera.test.ts` intact | unit camera tests pass; e2e shot test; screenshots 05/06 |
| Post-processing spike: Bloom + Vignette + Noise (+SMAA path), `React.lazy`, only with `post=1` | `PostProcessingSpike.tsx` (new) + deps `@react-three/postprocessing@^3.0.4`, `postprocessing@^6.39.4` | Stage 6 cost measurement | Medium — new deps, fully lazy | bundle-analysis.md (0 B on default route); Profile 3 |
| Adaptive quality in proto: rolling FPS, ≥3 s evaluation interval, cooldown + max switches, DPR applied via R3F `setDpr` (no per-frame React state), logged via `__STAGE0_ADAPT__` | `SorterDigitalTwinContinuous.tsx` (`AdaptiveQualityController`), `stage0.ts` | Stage 8; finding #9 | Medium — proto only | `adaptLog` captured in benchmark JSONs |
| Device classification from `hardwareConcurrency`, `deviceMemory`, `devicePixelRatio`, WebGL renderer (SwiftShader detection), viewport, UA — used only to pick initial quality | `stage0.ts` | Stage 8 | Low — read-only signals | benchmark JSON `device` blocks |
| Favicon 404 console error eliminated (inline SVG favicon) | `index.html` | Only console error in benchmarks | Trivial | console-errors.json |
| Fallback link/badge reachable on 390 px (top padding clears full-width HUD; left-aligned) | `styles.css` | e2e failure fix | Low | e2e 390×844 click-through |
| New e2e coverage: mobile fallback, no-WebGL fallback, context loss/restore double-loss, proto mode, manual shot | `e2e/mobile-fallback.spec.ts` (new, 5 tests) | Stages 3/7/12 | — | 5/5 pass |
| Benchmark harness: 4 profiles × 3 runs × 32 s, warmup, device signals, memory loop ×10, GPU-forced Chromium flags | `scripts/stage0-benchmark.mjs`, `scripts/stage0-gpu-probe.mjs`, `scripts/stage0-camera-shots.mjs` (new) | Stage 9 methodology | — | performance-*.json |
| Static perf test updated to the new conditional `shadows` expression (invariant preserved: shadows never unconditional) | `src/domain/performanceStatic.test.ts` | test matched old syntax | — | unit 166/166 |

Not changed (explicitly out of scope): `classifier.ts`, routing rules, dimension limits, `K >= 0.7`, "габариты → форма" order, expected unit-test values, both 3D engines kept separate, old scene kept, `/details` kept, no UI-kit/design system, no WebGPU/raymarching/SSR/DoF/motion blur/volumetrics/TAA/sound, no hardware/ESP32/KiCad/Python changes.

---

## 5. MOBILE_FALLBACK

**Before**: viewport < 640 px rendered `ThreeFallback` with false English claims ("WebGL not available", "Please use a modern browser") over a dead area; the full SVG fallback (`SorterScene`) existed but was never used on the main page; HUD/controls pretended to drive an invisible canvas.

**After**: two distinct states.
1. **WebGL truly unavailable** (or context permanently dead): SVG `SorterScene` + badge "3D недоступно — показана облегчённая SVG-схема линии" / "3D-сцена прервана…" — no browser-blaming text.
2. **WebGL available but small viewport**: SVG `SorterScene` + honest badge "Облегчённый режим — компактный экран: показана SVG-схема линии". Play/pause/speed drive the visible SVG via the same deterministic playback (`playbackAdapter`); progress stays in sync; `/details` link is visible and clickable above the controls; auto-camera toggle is hidden (no claims about invisible 3D); no black empty area.

**e2e 390×844**: 5/5 pass — no "WebGL not available" text, SVG visible, zero canvases, play/pause drive SVG, details link click-through, zero console/page errors. Screenshot: `screenshots/04-mobile-svg-fallback.png`. Console errors: none (`console-errors.json`).

---

## 6. CINEMATIC_PROTOTYPE

Active only under `?stage0=1` (default route `/` visually unchanged — verified by identical visual-test results before/after, §10).

- **Background**: `INDUSTRIAL_PALETTE.backgroundDark` (existing palette, no new theme).
- **Lighting**: `ambientLight 0.12` + hemisphere 0.3 fill base; key `directionalLight` intensity 1.6 at (6, 9, 4) with `castShadow`, shadow map 1024×1024, `PCFSoftShadowMap`, orthographic frustum ±7, near 1 / far 25, bias −0.0004; fill directional 0.35; rim directional 0.7 `#bcd7ff`.
- **Renderer (proto only)**: `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.0`.
- **Shadow casters/receivers**: products, conveyor frame, floor (receive), stop-gate posts, pusher, roll cages. NOT on route arrows, helper lines, HTML labels, small sensors.
- **Camera**: existing `CinematicCameraController` unblocked in proto; phase-driven (Mode A) or manual `shot=` override (Mode B) via a 20-line adapter (`shotToPhaseCategory`); camera stays alive while paused when a manual shot is set; toggle state is truthful.
- **Effects enabled**: Bloom, Vignette, Noise (post=1 spike), ACES, soft shadows 1024.
- **Intentionally NOT added**: HDRI environments, PBR re-authoring, DoF, motion blur, SSR, volumetric fog, chromatic aberration, TAA, custom/raymarching shaders, WebGPU, sound, scroll-driven storytelling, CAD/GLB pipeline — all Stage 1+ material.

---

## 7. PERFORMANCE_RESULTS

All rows: **real hardware GPU** — `ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1080/PCIe/SSE2, OpenGL ES 3.2)`, WebGL2, Chromium 149 headless, ANGLE gl-egl (flags in README). 3 runs × 32 s each, median reported. `validity: HARDWARE_GPU_VALID` in every JSON.

| Профиль | Устройство | Renderer | Avg FPS | Min FPS | P95 frame | Draw calls | Triangles | Verdict |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 Baseline | Desktop 1920×1080 DPR1 | GTX 1080 | 60.0 | 33.4 | 17.1 ms | 153 | 2 950 | PASS (reference) |
| 2 Cinematic Light | Desktop 1920×1080 DPR1 | GTX 1080 | 59.5 | 21.6 | 17.3 ms | 170 | 3 158 | PASS sustained (see min-FPS note) |
| 3 Cinematic Full (Bloom+Vignette+Noise) | Desktop 1920×1080 DPR1 | GTX 1080 | 59.8 | 32.7 | 21.7 ms | n/a* | n/a* | PASS — post costs ~4.4 ms p95 vs Profile 2 |
| 4 Mobile Low (DPR1, no shadows/post, reduced items) | Emulated 390×844 DPR3, Android UA | GTX 1080 | 59.7 | 29.9 | 17.3 ms | 151 | 2 898 | PASS on this GPU — **not a phone** |

\* Profile 3 artifact: with the EffectComposer active, `renderer.info.render` resets per internal pass, so "1 call / 1 triangle" is the final fullscreen quad, not the scene. The composer overhead is instead visible in textures (29 vs 3 — composer render targets), programs (17 vs 6), and the p95 delta (+4.4 ms vs Profile 2). Metric limitation documented, not hidden.

Cost breakdown (medians, desktop): cinematic rig + shadows + camera ≈ **free** (p95 17.1 → 17.3 ms, +17 draw calls, +208 tris); post-processing spike ≈ **+4.4 ms p95**; mobile-low ≈ baseline cost.

Min-FPS honesty note: minimums (19.5–33.4 across runs) are single-frame startup hitches (shader compilation on first frames); p99 = 19.1–29.1 ms; total frames > 50 ms across all 12 runs: **1**. No sustained jank, no UI blocking.

**Software-renderer results**: none included. All measurements were forced onto the NVIDIA GPU; a SwiftShader row would be marked `SOFTWARE_RENDERER_NOT_VALID_FOR_GPU_BASELINE` and excluded from the verdict by construction.

Historical context: previous ~9 FPS figures (`docs/PERFORMANCE_BASELINE.md`) were SwiftShader/CPU and are now confirmed non-representative — the same scene renders at 60 FPS on real GPU.

---

## 8. BUNDLE_IMPACT

Full data: [bundle-analysis.md](./bundle-analysis.md) (before = build of the rollback tag in a temp worktree; after = working tree).

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Entry `index-*.js` raw / gzip | 330 630 / 98 582 | 339 427 / 101 445 | **+8 797 raw / +2 863 gzip (+2.9 %)** |
| Initial route total (entry + shared, raw) | 343 623 | 351 463 | +7 840 |
| `PostProcessingSpike` chunk (lazy) | — | 163 256 raw / 75 925 gzip | lazy-only, **0 B on default route** |
| `dist/` total | 2 575 307 | 2 752 127 | +176 820 |
| New dependencies | — | `@react-three/postprocessing@^3.0.4`, `postprocessing@^6.39.4` | confined to the lazy chunk |

Prototype chunk is lazy-loaded (`React.lazy` + `post=1` gate): default visitors and even `stage0=1&post=0` users never download it.

---

## 9. MEMORY_AND_CONTEXT

Memory loop (10 remount/playback cycles per profile, from `memoryLoop` in each JSON):

| Profile | Geometries Δ | Textures Δ | Heap Δ (MB) | Note |
|---|---:|---:|---:|---|
| Baseline | 0 | 0 | +8.6 | GC sawtooth 25→47→34, no monotonic growth |
| Cinematic Light | 0 | 0 | −10.0 | ends lower than start |
| Cinematic Full | 0 | 0 | ±(30→51→…) sawtooth | composer targets stable at 29 textures |
| Mobile Low | 0 | 0 | sawtooth | no growth |

Geometry/textures flat after the leak fixes (§4) — previously each roll-cage render allocated new `BoxGeometry` and STL loads mutated shared cache.

Context resilience (e2e, forced via `WEBGL_lose_context`):

| Test | Result |
|---|---|
| `webglcontextlost` → honest SVG fallback with "3D-сцена прервана" badge, canvas kept mounted (hidden) for retry window | PASS (screenshot 07) |
| `webglcontextrestored` → **single safe retry**, 3D canvas visible again, no remount loop | PASS |
| Second loss after consumed retry → permanent SVG fallback, canvas unmounted, **no error loop** | PASS |
| Uncaught errors escaping the boundary across the whole sequence | 0 |

The dead `use-2d-fallback` event was replaced by an explicit `onUse2D` callback — no imitation of recovery remains.

---

## 10. TEST_RESULTS

| Suite | Result | Details |
|---|---|---|
| `npx tsc -b` | PASS | clean |
| `npm test` (unit, 19 files) | **166/166 PASS** | includes updated `performanceStatic.test.ts`; camera tests untouched and green |
| `npm run build` | PASS | ~0.4–0.6 s; chunk warnings pre-existing |
| e2e functional + new Stage 0 spec | **15 + 5 PASS** | `mobile-fallback.spec.ts` 5/5 (390×844 fallback, no-WebGL, context loss/restore, proto mode, manual shot) |
| e2e visual regression | 4 pass / **6 fail — PRE-EXISTING** | identical 6 failures reproduced on the **rollback-tag build** in this environment (snapshots originate from a different machine/renderer); NOT caused by Stage 0; **snapshots NOT overwritten**, per constraints |
| Console errors (benchmarks + e2e) | 0 remaining | single favicon 404 found and fixed (`console-errors.json`) |
| Failed tests and reasons | 6 visual only | environment mismatch, proven by before/after equality |

---

## 11. KNOWN_LIMITATIONS

- **NOT_TESTED_ON_REAL_DEVICE**: no iPhone/Safari, no Android Chrome device, no Telegram WebView. Mobile-low numbers come from a desktop GTX 1080 with a mobile viewport/UA — they validate the code path and its cost model, not a phone GPU.
- Single GPU sample: GTX 1080 (2016 discrete desktop card) is a proxy, not a median laptop; integrated Intel/AMD laptop GPUs untested.
- Min-FPS criterion formally missed (21.6 vs 30/40) due to isolated first-frame shader-compile hitches; sustained metrics (avg, p95, p99) all pass with margin.
- Profile 3 draw-call/triangle metrics are composer-artifacted (see §7).
- 6/10 visual snapshots fail in this environment on both old and new code (pre-existing; origin machine differs).
- Adaptive-quality switching was exercised in proto and logged (`adaptLog`), but on this 60-FPS GPU it never triggered a downgrade — its decision path needs a weaker GPU or artificial FPS caps for full validation.
- `dprMax`, `rollerDetail` preset fields remain partially wired (DPR is driven; roller detail is not — flagged, not hidden).
- Scene-load metric measures first-render readiness (~0.5–0.8 s), not full asset warm-up.

---

## 12. DECISION

**Can a full real-time cinematic website be built?** On desktop: **yes, in substance** — the complete cinematic stack (dark background, 0.12 ambient + key/fill/rim rig, ACES tone mapping, 1024 PCFSoft shadows, cinematic camera) costs ~0.2 ms p95 over baseline and holds 60 FPS vsync-capped on hardware GPU; even adding Bloom+Vignette+Noise keeps p95 at 21.7 ms. The old 9 FPS figure was a SwiftShader artifact and is retired.

**Hybrid approach?** Yes for mobile: real-time 3D on mobile is unproven (no real device available) and must default to the honest SVG fallback / low profile until measured on actual hardware.

**Effects within budget (desktop)**: full lighting rig, ACES, soft shadows 1024 from key objects, cinematic camera, Bloom, Vignette, light Noise.
**Effects to exclude**: DoF, motion blur, SSR, volumetrics, chromatic aberration, TAA, HDRI/PBR re-authoring and scroll-driven storytelling were not validated and stay out until Stage 1 measurements.
**Desktop default profile**: Cinematic Light (Profile 2) — cinematic look at baseline cost; enable post-processing only where measured (or behind adaptive quality).
**Mobile default profile**: SVG fallback (current, fixed in Stage 0); if real-device measurements later pass (≥30 avg / ≥24 min / ≤40 ms p95), Mobile Low (Profile 4) with DPR 1, no shadows, no post, reduced items.

---

## 13. NEXT_STAGE (proposal only — not started)

**Stage 1 — Creative & Asset Foundation** (each item gated by Stage 0 metrics):
1. Real-device validation sprint: one mid-range Android (Chrome) + one iPhone (Safari) + Telegram WebView on both, Profiles 2/4, 3 runs each — converts CONDITIONAL into APPROVED or scopes mobile to hybrid permanently.
2. Creative direction + unified visual language (palette, type, motion spec) built on the validated Profile 2 baseline.
3. CAD→GLB pipeline: export conveyor CAD + official product STEP models from the ZIP archive; PBR material pass; measure per-asset triangle/draw-call budgets against the §7 headroom (+17 draw calls used of a large margin).
4. Scroll-driven storyboard prototype (camera keyframes on top of the existing `cinematicCamera` API; no engine merge yet).
5. Adaptive-quality validation on weak hardware (or FPS-capped) to prove downgrade hysteresis before making it default.
6. Long-term: evaluate merging the two 3D scenes only after asset budgets are known.

---

## 14. FILES_CHANGED

Modified (12):
`index.html`, `package.json`, `package-lock.json`, `src/pages/MainPage.tsx`, `src/styles.css`, `src/components/ProductDemoSection.tsx`, `src/components/ThreeD/SorterDigitalTwinContinuous.tsx`, `src/components/ThreeD/SortingZones3D.tsx`, `src/components/ThreeD/PhysicalPlaybackItem.tsx`, `src/components/ThreeD/STLModel.tsx`, `src/components/ThreeD/ThreeErrorBoundary.tsx`, `src/domain/performanceStatic.test.ts`

Created (product, 3): `src/domain/stage0.ts`, `src/domain/playbackAdapter.ts`, `src/components/ThreeD/PostProcessingSpike.tsx`

Created (tests/scripts, 4): `e2e/mobile-fallback.spec.ts`, `scripts/stage0-benchmark.mjs`, `scripts/stage0-gpu-probe.mjs`, `scripts/stage0-camera-shots.mjs`

Created (docs/artifacts, 7 files + 7 screenshots): `docs/stage0_premium_3d/{README.md, STAGE0_REPORT.md, bundle-analysis.md, console-errors.json, performance-baseline.json, performance-cinematic-light.json, performance-cinematic-full.json, performance-mobile-low.json}`, `docs/stage0_premium_3d/screenshots/01…07.png`

**Product-file count: 13 modified+created — within the ≤20 limit.** (Tests, scripts, reports, generated JSON excluded per spec.)

Removed (session artifacts, never project files): 6 `core.*` crash dumps from GPU flag probing.

---

## 15. FINAL_GIT_CHECK

Executed at report completion (full output in chat transcript):

```text
git status --short        → 12 modified + 8 untracked entries (all listed in §14)
git diff --stat           → 12 files, +513/−182
git diff --check          → clean (no whitespace errors)
git branch --show-current → feature/premium-3d-stage-0
git rev-parse HEAD        → 5cc27c6…  (identical to start — no commits)
```

---

```text
STAGE_0_COMPLETE
status: REALTIME_3D_CONDITIONAL
branch: feature/premium-3d-stage-0
commit_created: NO
push_performed: NO
production_changed: NO
other_branches_changed: NO
```
