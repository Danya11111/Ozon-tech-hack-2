# Real CV prototype — RealSense D415 + OpenCV

**Status:** WORKING_PROTOTYPE
**Production integrated:** NO (https://arhipovdan.ru does **not** consume this pipeline)
**Source:** consolidated from branch `drho1y-mvp_1` (`vision_classifier/`) into `cv/`

Same Track 3 B/C/D rules as the web twin; different input path (real depth camera vs simulated sensor).

## Purpose

Measure parcels on a conveyor with an Intel RealSense D415 (depth + color), estimate L×W×H and circularity, classify into zones **B / C / D**, optionally publish results over MQTT for hardware routing.

## Data flow

```
RealSense D415 (V4L2 depth + color)
  → OpenCV segmentation on depth (optional RGB flat detect)
  → measure L×W×H + circle_ratio
  → stabilize (median / vote → LOCK)
  → classify B/C/D
  → optional MQTT (category, dimensions, servo/motor topics)
```

## Entrypoints (start here)

| Command | Role |
|---|---|
| `./demo.sh` | Browser HUD demo on `:8080` (needs camera for live view) |
| `./run.sh --preview` | Live pipeline with JPEG preview frames |
| `./run.sh --once --no-mqtt --no-motor` | Single-shot / dry hardware |
| `.venv/bin/python test_classify.py` | Classifier unit checks **without camera** |
| `.venv/bin/python test_geometry.py` | Geometry helpers **without camera** |

Primary modules: `main.py` (live), `demo.py` (HUD), `classify.py` (rules), `measure.py` (depth metrics), `camera.py` (V4L2 RealSense).

## Classification rules (Track 3)

1. Dimensions must be strictly **> 10×10×10 mm** and **< 450×320×320 mm** → else **C**
2. Else if `circle_ratio ≥ 0.8` → **D**
3. Else → **B**

Stabilization: median window + vote → **LOCK**. Uncertain cases fall back to zone **C** after N frames.

## File structure

```
cv/
  main.py              # live pipeline entry
  demo.py / demo.sh    # browser demo
  run.sh               # venv bootstrap + main.py
  camera.py            # RealSense via V4L2 + ffmpeg depth
  measure.py           # segmentation + dimensions
  classify.py          # B/C/D rules
  stabilize.py         # temporal LOCK
  mqtt_bridge.py       # optional MQTT (disabled by default)
  calibrate.py         # fx/fy + belt height calibration
  align_color.py       # RGB↔depth alignment helper
  tracker.py           # multi-object tracking assist
  journal.py           # decisions JSONL writer
  demo_hud.py          # HUD rendering
  collect_log.py       # log helper
  test_classify.py     # no-camera tests
  test_geometry.py     # no-camera tests
  config.example.yaml  # safe defaults (commit)
  config.yaml          # local only (gitignored)
  requirements.txt
  Dockerfile / docker-compose.yml
```

## Dependencies

**Software**

- Python **3.10+** (3.11 recommended; Docker image uses 3.11)
- `opencv-python-headless`, `numpy`, `PyYAML`, `pillow`, `paho-mqtt` — see `requirements.txt`
- System: **ffmpeg**, V4L2 (`v4l-utils` useful)

**Hardware (live mode)**

- Intel **RealSense D415** on USB3
- Linux host with `/dev/video*` depth+color nodes (Orange PI / x86)

`npm` / Node packages are **not** used here.

## Installation

```bash
cd cv
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
cp config.example.yaml config.yaml   # optional; scripts auto-copy
```

Or simply:

```bash
cd cv
./demo.sh          # creates .venv and config.yaml on first run
```

## Demo / tests without claiming live camera

Classifier and geometry (no RealSense required):

```bash
cd cv
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python test_classify.py
.venv/bin/python test_geometry.py
python3 -m compileall .
```

Live HUD (requires D415):

```bash
./demo.sh
# open http://127.0.0.1:8080/
```

Live pipeline:

```bash
./run.sh --preview --no-mqtt --no-motor
# or full hardware once MQTT/routing configured in local config.yaml:
./run.sh --preview
```

## Configuration

| File | Role |
|---|---|
| `config.example.yaml` | Committed safe defaults; **MQTT/motor/routing disabled** |
| `config.yaml` | Local overrides — **gitignored**; never commit credentials |

Optional MQTT (enable only locally):

```yaml
mqtt:
  enabled: true
  broker: "127.0.0.1"
  port: 1883
  user: "<your-user>"
  password: "<your-password>"
```

CLI overrides: `--no-mqtt`, `--no-motor`, `--dry-route`, `--once`, `--preview`.

## Output schema (LOCK)

- Zone: `B` | `C` | `D`
- Dimensions mm: L×W×H
- `circle_ratio`
- Optional MQTT topics (when enabled): `vision/feedback/category`, `…/dimensions`, `…/circle_ratio`
- Optional JSONL: `logs/decisions.jsonl` (local, gitignored)

## Limitations

- Not connected to the web digital twin runtime.
- Requires calibrated intrinsics / belt height for accurate mm.
- Live demo needs a physical D415; CI hosts usually lack it.
- MQTT/servo/motor path is optional and site-specific.

## Troubleshooting

| Symptom | Check |
|---|---|
| No `/dev/video*` | USB3, `lsusb`, `v4l2-ctl --list-devices` |
| Depth empty | ffmpeg installed; correct `depth_device` |
| Wrong sizes | run `calibrate.py --length … --width …` |
| MQTT offline | expected when `mqtt.enabled: false` |

## Relation to web twin

Web (`src/domain/classifier.ts`) and CV (`classify.py`) implement the **same official bounds**. The public site uses a **digital sensor simulation**; this folder is the **hardware prototype** for future integration.
