# OZON Sorter Digital Twin

Web digital twin of an Ozon Tech Track 3 conveyor sorting line: continuous product playback, camera/classification stage, B/C/D routing, and author-CAD diverter motion.

**Production domain:** https://arhipovdan.ru

## Current solution

Final web simulation lives on **`main`** (same commit as `dan_branch`):

- continuous 3D conveyor digital twin (`/`);
- engineering documentation (`/documentation`);
- author CAD (`3d_models/conveer.FCStd`) + runtime GLB (`public/models/sorter/conveyor-clean.glb`);
- product STL assets (`public/models/*.stl`);
- camera / classification stage (digital twin rules, not live RealSense);
- B / C / D routing with CAD left/right diverters (−45° / +45°);
- Rapier-backed product physics (contact routing **not** fully validated).

Accepted release head: **`bb76963`** (content tree identical to stable baseline `13ce16b`). Later experimental junction/discharge commits were reverted by owner request and are **not** part of the submitted product.

### Main functions

1. Continuous SKU playback on a three-module CAD conveyor (clean → camera → sorter).
2. Measurement / classification stage with Track 3 B/C/D rules.
3. Diverter state machine and route visualization.
4. Desktop WebGL twin; mobile uses a lightweight presentation policy when WebGL budget requires it.
5. Canonical engineering status on `/documentation`.

## Technology stack

| Layer | Packages |
|---|---|
| UI | React, react-router-dom |
| 3D | three, @react-three/fiber, @react-three/drei, @react-three/postprocessing |
| Physics | @react-three/rapier, @dimforge/rapier3d-compat |
| Build | Vite, TypeScript, @vitejs/plugin-react |
| Tests | Vitest, Playwright |

Exact versions: `package.json` / `package-lock.json`.

## Dependencies / Node

- Node.js **20+**
- npm (locked via `package-lock.json`)

### Exact commands

```bash
npm ci                         # install
npm run dev                    # development → http://127.0.0.1:3100
npm test -- --run              # unit tests
npm run build                  # production build → dist/
npm run preview                # serve build → http://127.0.0.1:3100
npm run test:e2e               # Playwright (set PLAYWRIGHT_BASE_URL if needed)
```

## Active routes

| Route | Purpose |
|---|---|
| `/` | Continuous digital-twin simulation |
| `/documentation` | Canonical product / engineering status |
| `*` | Redirects to `/` |

Removed routes (`/details`, `/device-test`) are not part of the product.

## Project structure

```
src/                 React app, domain logic, 3D twin, pages
public/              Runtime static assets (models, draco)
  models/            Product STL + sorter/conveyor-clean.glb
3d_models/           Author CAD (conveer.FCStd)
docs/                Engineering notes (ENGINEERING.md)
e2e/                 Playwright smoke / routes
input_info/          Official Ozon input packs (PDFs/ZIPs)
official_sources/    Classifier bounds PDF cited by code
Dockerfile           Multi-stage Vite build + nginx
docker-compose.server.yml
nginx.conf
.github/workflows/ci.yml
```

## Environment variables

No runtime secrets are required for local demo or production static hosting.

Optional **build-time** identity (Docker / CI only; never commit secrets):

| Variable | Purpose |
|---|---|
| `VITE_BUILD_COMMIT` | Short git commit in `/version.json` |
| `VITE_BUILD_BRANCH` | Branch name in `/version.json` |
| `VITE_BUILD_RELEASE` | Release label in `/version.json` |

Do not commit `.env` files. Local `npm run build` derives identity from git when available.

## Active assets

| Path | Role |
|---|---|
| `3d_models/conveer.FCStd` | Author CAD (canonical source) |
| `public/models/sorter/conveyor-clean.glb` | Active runtime conveyor |
| `public/models/*.stl` | Product models |
| `input_info/*` | Official Ozon packs (PDFs/ZIPs) |
| `official_sources/doc-1783095831.pdf` | Official classifier bounds source cited by code |

### Frozen checksums (SHA-256)

```
3d_models/conveer.FCStd
90c1844a4ca05e26def783d6130fc4b993430dde14307534ef8fbb21c9fac2e6

public/models/sorter/conveyor-clean.glb
1dc7a8d7891bfe756e277ad5368df74cb73410156b2fe0f92845afb8a56f285a
```

## Classifier vs real CV

**Web twin (`main`):** rule-based classification in the digital twin (`src/domain/classifier.ts`) using Track 3 bounds and roundness. Camera overlay / measurement in the twin is a **simulation**, not live RealSense inference. This is **not** a neural network in production.

**Real CV (parallel prototype, not in the web app):** preserved on branch **`drho1y-mvp_1`** under `vision_classifier/` — OpenCV + Intel RealSense D415 depth → L×W×H + circle_ratio → B/C/D → MQTT. No PyTorch/YOLO weight files are stored in git.

```bash
git fetch origin
git switch drho1y-mvp_1
cd vision_classifier
# see vision_classifier/README.md and START.md
./demo.sh
.venv/bin/python test_classify.py
./run.sh --preview          # hardware path (Orange PI + RealSense)
```

Integration status: **WORKING_PROTOTYPE on `drho1y-mvp_1`**, **not integrated** into https://arhipovdan.ru.

## Sorting logic

**CURRENT_IMPLEMENTATION_VERIFIED_IN_CODE** (`src/domain/classifier.ts`, `src/domain/pusherMotion.ts`, unit tests).

| Category | Physical route | Active CAD diverter |
|---|---|---|
| B | STRAIGHT | none |
| C | PHYSICAL_LEFT | LEFT, **−45°** |
| D | PHYSICAL_RIGHT | RIGHT, **+45°** |

Frozen diverter timing / planes (verified in code + tests):

- rotation duration: **0.50 s**
- opening safety margin: **0.15 s**
- contact plane S: **1.0538**
- clear plane S: **1.6000**

Classifier bounds (code + `official_sources/doc-1783095831.pdf` reference):

- dimensions strictly **> 10×10×10 mm** and **< 450×320×320 mm**
- circular when **K > 0.8**
- check order: dimensions → C, else circular → D, else B

## Physical simulation

- Belt target speed **1.0 m/s** (`CONVEYOR_SPEED_MPS`)
- Fixed physics timestep **1/60 s** (`PHYSICS_TIMESTEP_SEC`)
- CCD enabled for small/fast or thin product rigid bodies
- LEFT/RIGHT CAD diverters −45° / +45°
- Rapier world with gravity **[0, −9.81, 0]**
- Full contact-only junction sorting through CAD diverters is **not fully validated**

Details: `docs/ENGINEERING.md`, `/documentation`.

## Validation

```bash
npm ci
npm test -- --run          # currently 196 unit tests
npm run build
npx vite preview --host 127.0.0.1 --port 3101 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e -- e2e/routes.spec.ts e2e/smoke.spec.ts
```

## Production deploy (this host)

Nginx terminates TLS for `arhipovdan.ru` and proxies to Docker `owl-web-1` on `127.0.0.1:3100` (`docker-compose.server.yml` + `Dockerfile`).

```bash
cd /opt/arhipovdan/app
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
RELEASE=$(date -u +%Y%m%d-%H%M%S)
docker compose -p owl -f docker-compose.server.yml build \
  --build-arg "BUILD_COMMIT=${COMMIT}" \
  --build-arg "BUILD_BRANCH=${BRANCH}" \
  --build-arg "BUILD_RELEASE=${RELEASE}"
docker compose -p owl -f docker-compose.server.yml up -d --force-recreate
curl -s https://arhipovdan.ru/version.json
```

## Repository vs cloud materials

| Material | In git | Cloud expected |
|---|---|---|
| Source, README, docs, configs, tests | yes | — |
| Runtime GLB/STL used by deploy | yes (required) | recommended mirror |
| Author CAD `conveer.FCStd` (~5 MB) | yes | recommended upload |
| Official PDFs/ZIPs (`input_info/`, `official_sources/`) | yes | optional mirror |
| Presentation / video demonstration | **not in repo** | **required for platform field** |
| ML weights | none (CV is classical OpenCV depth) | N/A |

Confirmed public presentation / video / cloud-folder URLs are **not stored in this repository**. Owner must supply them in the platform submission field.

## Current limitations

- Web classifier is a digital twin simulation, not live RealSense inference.
- Full contact-only sorting through CAD diverters is not fully validated.
- Belt surface-velocity physics (true tangential drive) is planned, not complete.
- Per-SKU mass / COM / friction profiles still need calibration.
- Author CAD horn / transmission incomplete in active GLB (`AUTHOR_CAD_INCOMPLETE`).
- Official compliance limited by missing extracted task PDF / PDF re-parse policy.
- Generated screenshots, videos, and stage folders are not canonical.

## Repository policy

- Keep author CAD, active runtime assets, official sources, build configs, and tests.
- Real CV remains on `drho1y-mvp_1`; do not force-merge into `main` without validated web integration.
- Rollback / accepted product baseline content: `13ce16b` (current `main` tree via `bb76963`).

See also: `/documentation` in the running app, and `docs/ENGINEERING.md`.
