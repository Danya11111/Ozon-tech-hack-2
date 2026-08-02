# OZON Sorter Digital Twin

Complete Track 3 Ozon Tech solution in one repository: a web digital twin of the sorting line, plus a real RealSense/OpenCV CV prototype.

**Production:** https://arhipovdan.ru

## 1. Overview

This repository delivers a continuous web simulation of an Ozon conveyor sorter: CAD conveyor, product models, camera/measurement stage, B/C/D classification, diverters, and Rapier physics. The public demo runs on https://arhipovdan.ru with routes `/` (simulation) and `/documentation` (engineering status).

Separately, `cv/` contains a **working hardware prototype** that reads Intel RealSense D415 depth, measures parcels with OpenCV, classifies B/C/D, and can publish results over MQTT. It is **not** wired into the live website.

Both paths share the same Track 3 classification domain (exclusive 10×10×10 … 450×320×320 mm, roundness K > 0.8). The web twin uses a digital sensor simulation; the CV folder uses real depth frames.

`main` is the canonical complete solution. Developers do not need other branches to run the web app or inspect/run the CV prototype.

Large submission artifacts (presentation, video, optional CAD/model mirrors) belong in team cloud storage; runtime assets required by deploy stay in Git.

## 2. Submission components

| Component | Location | Notes |
|---|---|---|
| Web digital twin | `src/`, `public/` | Production-integrated |
| Real CV prototype | `cv/` | WORKING_PROTOTYPE, not live-integrated |
| Author CAD | `3d_models/conveer.FCStd` | FreeCAD source |
| Official materials | `input_info/`, `official_sources/` | PDFs/ZIPs cited by docs/code |
| Production domain | https://arhipovdan.ru | Docker + nginx |
| Presentation / video | cloud (owner) | Links TBD — see §17 |

## 3. Production demo

- **URL:** https://arhipovdan.ru
- **`/`** — continuous digital-twin simulation
- **`/documentation`** — canonical engineering status
- Unknown routes redirect to `/`

Device behavior on current baseline:

- **Desktop:** interactive WebGL 3D
- **Mobile:** lightweight **2D** fallback (not full WebGL 3D)

Build identity: `/version.json`.

## 4. Web capabilities

- Three-module CAD conveyor (clean → camera → sorter)
- Camera / measurement simulation and Track 3 classifier
- B / C / D routing with CAD diverters (−45° / +45°)
- Rapier product physics (contact sorting **not** fully validated)
- Continuous playback HUD + documentation page

## 5. Real CV prototype

| Field | Value |
|---|---|
| Path | `cv/` |
| Origin | `drho1y-mvp_1` / `vision_classifier/` |
| Technology | RealSense D415 + OpenCV (depth segmentation + metrics) |
| Status | WORKING_PROTOTYPE |
| Integration | **Not** connected to production web runtime |

See **[cv/README.md](cv/README.md)** for install, demo, live camera, and MQTT.

## 6. Architecture

```
Real device path:
  RealSense D415 → depth preprocess → segmentation → measurement
  → B/C/D → optional MQTT / hardware

Web path:
  Digital product → simulated sensor → classifier
  → physical digital twin → B/C/D receiver visualization
```

Shared: B/C/D semantics and official dimension/roundness rules.
Not shared today: live camera frames into the website.

## 7. Repository structure

```
.github/                 CI (build, unit, e2e)
3d_models/               Author CAD (conveer.FCStd)
cv/                      Real CV prototype (Python)
docs/                    Engineering notes
e2e/                     Playwright smoke/routes
input_info/              Official Ozon input packs
official_sources/        Classifier bounds PDF
public/                  Runtime static assets (GLB/STL/draco)
src/                     React/Three web twin
Dockerfile               Web production image
docker-compose.server.yml
nginx.conf
package.json / lock
vite / vitest / playwright / tsconfig
README.md
```

No other top-level product directories are required to run or understand the solution.

## 8. Requirements

**Web:** Node.js 20+, npm (`package-lock.json`).
**CV:** Python 3.10+, ffmpeg, V4L2; RealSense D415 for live mode (`cv/requirements.txt`).
**Hardware (CV live / MQTT):** D415 USB3; optional MQTT broker + servo/motor controllers on site network.

## 9. Web quick start

```bash
npm ci
npm run dev          # http://127.0.0.1:3100
npm test -- --run
npm run build
npm run preview      # http://127.0.0.1:3100
```

## 10. CV quick start

```bash
cd cv
./demo.sh            # venv + deps; HUD on :8080 (needs D415 for live view)
# without camera:
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python test_classify.py
.venv/bin/python test_geometry.py
# live pipeline (hardware):
./run.sh --preview --no-mqtt --no-motor
```

`npm install` does **not** install CV dependencies.

## 11. Configuration

**Web (build-time, optional):** `VITE_BUILD_COMMIT`, `VITE_BUILD_BRANCH`, `VITE_BUILD_RELEASE` → `/version.json`. No runtime secrets.

**CV:** copy `cv/config.example.yaml` → `cv/config.yaml` (gitignored). MQTT/motor/routing **disabled by default**. Never commit real passwords or broker credentials.

## 12. Classification rules

Verified in web (`src/domain/classifier.ts`) and CV (`cv/classify.py`):

- dimensions strictly **> 10×10×10 mm** and **< 450×320×320 mm**
- circular when **K > 0.8** (web) / `circle_ratio ≥ 0.8` (CV)
- order: dimensions fail → **C**; else circular → **D**; else **B**

Official citation: `official_sources/doc-1783095831.pdf` (present; not re-parsed on every doc pass). Missing extracted brief PDF is not claimed.

## 13. Physics (accepted `main`)

From current source (not superseded experimental branches):

- belt speed **1.0 m/s** (`CONVEYOR_SPEED_MPS`)
- fixed timestep **1/60 s** (`PHYSICS_TIMESTEP_SEC`)
- CCD for light/thin product bodies
- diverters LEFT **−45°**, RIGHT **+45°**
- full contact-only junction sorting through CAD: **not fully validated**

## 14. CAD and assets

| Asset | Path |
|---|---|
| Author CAD | `3d_models/conveer.FCStd` |
| Runtime GLB | `public/models/sorter/conveyor-clean.glb` |
| Products | `public/models/*.stl` |

Keep runtime assets in Git for deploy. Mirror large CAD/models/presentation/video to cloud for submission.

SHA-256 (frozen):

```
3d_models/conveer.FCStd
90c1844a4ca05e26def783d6130fc4b993430dde14307534ef8fbb21c9fac2e6

public/models/sorter/conveyor-clean.glb
1dc7a8d7891bfe756e277ad5368df74cb73410156b2fe0f92845afb8a56f285a
```

## 15. Testing

```bash
npm test -- --run
# current release result: 196/196
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e -- e2e/routes.spec.ts e2e/smoke.spec.ts

cd cv && .venv/bin/python test_classify.py && .venv/bin/python test_geometry.py
```

## 16. Deployment

Nginx terminates TLS for `arhipovdan.ru` and proxies to Docker `owl-web-1` (`docker-compose.server.yml` + `Dockerfile`) on `127.0.0.1:3100`. Deploy from `main` with build-args for `/version.json`. CV is **not** part of the web container.

## 17. Submission materials

| Material | Status |
|---|---|
| Presentation URL | REQUIRED_FROM_OWNER |
| Video demo URL | REQUIRED_FROM_OWNER |
| Cloud folder URL | REQUIRED_FROM_OWNER |

Do not invent links. Runtime site assets remain in Git even when mirrored to cloud.

## 18. Known limitations

- Mobile uses 2D lite fallback on current baseline
- CV is a prototype and is not live-integrated into arhipovdan.ru
- Simulation physics is engineering-derived; hardware calibration still required
- Contact routing through CAD diverters not fully validated
- Large presentation/video must be uploaded to cloud by owner

## 19. Branch history policy

**`main` is the canonical complete solution** (web + cleaned CV under `cv/`). Historical branches (`dan_branch`, `drho1y-mvp_1`, …) may remain for audit but are not required to run the product.
