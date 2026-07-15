# HARDWARE_BENCHMARK_RUNBOOK

## Server status (OwlPrime / coder)

```text
GPU devices: NVIDIA GTX 1080 ×2 present (/dev/nvidia*, /dev/dri)
DISPLAY: unset (unless xvfb)
Chromium WebGL in this env: SwiftShader / software
Hardware acceleration for demo metrics: BLOCKED_BY_DISPLAY_ENVIRONMENT
```

Do **not** install a display server or change NVIDIA drivers for benchmark.

## Portable benchmark (presentation laptop)

On the machine that will show the demo to the jury:

```bash
cd /path/to/app
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 3100
# or point at production / Quick Tunnel:
# export PLAYWRIGHT_BASE_URL=https://<working-url>/

npm run perf:browser
# writes agent/reports/browser-benchmark.json
# and docs/HARDWARE_BROWSER_BENCHMARK_LATEST.md (gitignored)

npm run perf:browser:export   # same
```

Requirements:

* Real headed Chrome/Chromium (`DISPLAY` / macOS / Windows)
* **No** forced GPU flags (measures the jury machine as-is)
* Modes: low / medium / high / demo
* Includes playlist seeks + 3 replay cycles

### Manual export from UI

Open `/?perf=1` → button **Export benchmark** downloads JSON locally.

## Acceptance (Demo mode)

| Grade | Avg FPS | Min FPS | p95 |
| ----- | ------: | ------: | --: |
| Excellent | ≥55 | ≥40 | ≤20 ms |
| Acceptable | ≥30 | ≥24 | ≤33 ms |
| Not for live demo | <30 or p95 >40 ms |

Hardware run is valid only if renderer string does **not** contain SwiftShader / llvmpipe / Software.

## Server diagnostic (optional)

```bash
npm run perf:gpu   # may re-exec under xvfb; labels software renderers
```
