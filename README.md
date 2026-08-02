# OZON Sorter Digital Twin

Web digital twin of an Ozon Tech Track 3 conveyor sorting line: continuous product playback, camera/classification stage, B/C/D routing, and author-CAD diverter motion.

**Production domain:** https://arhipovdan.ru

## Current solution

This repository (`main`) contains the final web simulation:

- continuous 3D conveyor digital twin (`/`);
- engineering documentation page (`/documentation`);
- author CAD conveyor source (`3d_models/conveer.FCStd`);
- runtime conveyor GLB (`public/models/sorter/conveyor-clean.glb`);
- product STL assets (`public/models/*.stl`);
- camera-triggered measurement / rule-based classification (digital sensor simulation);
- B / C / D route mapping with CAD left/right diverters (−45° / +45°);
- Rapier physics: belt ≈ 1.0 m/s, fixed timestep 1/120 s, CCD on product profiles, discharge into receivers.

### Main functions

1. Continuous SKU playback on a three-module CAD conveyor (clean → camera → sorter).
2. Camera-volume triggered measurement and B/C/D classification.
3. Physical diverter routing and receiver settle detection.
4. Desktop WebGL twin + mobile-capable 3D policy.
5. Canonical engineering status on `/documentation`.

## Technology stack

| Layer | Packages |
|---|---|
| UI | React, react-router-dom |
| 3D | three, @react-three/fiber, @react-three/drei, @react-three/postprocessing |
| Physics | @react-three/rapier, @dimforge/rapier3d-compat |
| Build | Vite, TypeScript, @vitejs/plugin-react |
| Tests | Vitest, Playwright |

See `package.json` for exact versions. Do not treat transitive npm packages as first-class product dependencies.

## Dependencies / Node

- Node.js **20+**
- npm (lockfile: `package-lock.json`)

### Exact commands

```bash
npm ci
npm run dev          # development: http://127.0.0.1:3100
npm test -- --run    # unit tests
npm run build        # production build → dist/
npm run preview      # serve build: http://127.0.0.1:3100
npm run test:e2e     # Playwright (needs preview or PLAYWRIGHT_BASE_URL)
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

Optional **build-time** identity (Docker / CI only; never commit real secrets):

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

**Web twin (`main`):** classification is a **digital sensor simulation**. When a product enters the camera scan volume, dimensions / roundness are measured in the twin and routed with the same B/C/D rules as Track 3 (`src/domain/classifier.ts`, `src/domain/cameraClassification.ts`). This is **not** a neural network and is **not** wired to a live RealSense camera in production.

**Real CV (parallel prototype, not merged into the web app):** preserved on branch **`drho1y-mvp_1`** under `vision_classifier/` (OpenCV + RealSense D415 depth → L×W×H + circle_ratio → B/C/D → MQTT). No PyTorch/YOLO weights are stored in git.

```bash
git fetch origin
git switch drho1y-mvp_1
cd vision_classifier
# see vision_classifier/README.md and START.md
./demo.sh                  # browser HUD demo
.venv/bin/python test_classify.py
./run.sh --preview         # full pipeline on hardware (Orange PI + RealSense)
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
- contact plane S: **1.0538** (fallback hinge geometry ≈ 1.0536)
- clear plane S: **1.6000**

Classifier bounds (code + `official_sources/doc-1783095831.pdf` reference; PDF not re-parsed in this doc pass):

- dimensions strictly **> 10×10×10 mm** and **< 450×320×320 mm**
- circular when **K > 0.8**
- check order: dimensions → C, else circular → D, else B

## Physical simulation

- Fixed timestep **1/120 s**, max **4** substeps, gravity **[0, −9.81, 0]**
- Belt target speed **1.0 m/s** (supported-body velocity coupling)
- CCD enabled on active product physics profiles
- Single dynamic product rigid body through spawn → junction → receiver settle
- LEFT/RIGHT CAD diverters: `kinematicPositionBased` colliders synced to CAD yaw
- Discharge edge ends belt support; gravity fall into receivers
- Receiver volumes are sensors for completion

Details: `docs/ENGINEERING.md`, `/documentation`.

## Validation

```bash
npm ci
npm test -- --run          # currently 245 unit tests
npm run build
# focused E2E (with preview on :3101):
npx vite preview --host 127.0.0.1 --port 3101 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e -- e2e/routes.spec.ts e2e/smoke.spec.ts
```

- Two-page routing: `/` + `/documentation`
- CAD / GLB checksums: verified against values above
- Diverter frozen angles / duration: covered by unit tests
- Junction / discharge / camera classification: covered by domain tests (engineering-derived, not production-calibrated)

## Production deploy (this host)

Nginx terminates TLS for `arhipovdan.ru` and proxies to Docker `owl-web-1` on `127.0.0.1:3100` (`docker-compose.server.yml` + `Dockerfile`).

```bash
cd /opt/arhipovdan/app   # or your checkout
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
| Runtime GLB/STL used by the deployed app | yes (required for deploy) | recommended mirror |
| Author CAD `conveer.FCStd` (~5 MB) | yes | recommended upload |
| Official PDFs/ZIPs under `input_info/`, `official_sources/` | yes | optional mirror |
| Presentation / video demonstration | **not in repo** | **required for platform field** |
| ML weights | none (CV is classical OpenCV depth) | N/A |

Confirmed public presentation / video / cloud-folder URLs are **not stored in this repository**. Add them in the platform submission field when available.

Презентация / видеодемонстрация: links must be supplied by the owner (not invented here).

## Current limitations

- Web classifier is a digital sensor simulation, not live RealSense inference.
- Product profiles are engineering-derived, not production-calibrated.
- Author CAD horn / complete transmission is absent or incomplete in the active GLB (`AUTHOR_CAD_INCOMPLETE`).
- Official compliance claims are limited by the missing extracted task PDF and by not re-parsing PDFs in every doc pass.
- Generated screenshots, videos, Gate stage folders, and tool `out/` trees are not canonical.

## Repository policy

- Keep author CAD, active runtime assets, official sources, build configs, and tests that protect active behavior.
- Generated outputs and historical media are not product truth.
- Real CV remains on `drho1y-mvp_1`; do not force-merge it into `main` without a validated web integration.
- Rollback point for the pre-cleanup web baseline: git `4413f01` on `dan_branch` history.

See also: `/documentation` in the running app, and `docs/ENGINEERING.md`.
