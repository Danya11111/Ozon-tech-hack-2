# HEADED_GPU_PERFORMANCE_REPORT

Measured: 2026-07-15T17:48:54.064Z
Commit: `b5985f3`
Base URL: http://127.0.0.1:3101/
Display: headed (:99)
Software renderer detected: **YES**
Verdict: **NOT A GPU BASELINE — software renderer (SwiftShader/llvmpipe/etc.)**

## Server hardware WebGL re-check (2026-07-15 / 2026-07-16)

- `nvidia-smi`: GTX 1080 ×2 present; `/dev/nvidia*`, `/dev/dri` exist.
- Current user/groups: root; `video` group exists but no display server (`DISPLAY` empty, no `/tmp/.X11-unix`).
- Chromium probes (`--use-gl=egl`, `--use-angle=gl-egl`, `--use-angle=gl`, Vulkan ANGLE, `--ignore-gpu-blocklist`) all resolve to **SwiftShader**.
- No driver/display-server changes applied.

```text
BLOCKED_BY_DISPLAY_ENVIRONMENT
```

Portable path: `npm run perf:browser` / `docs/HARDWARE_BENCHMARK_RUNBOOK.md`.

## Mode table (after Play)

| Mode | Renderer | Avg FPS | Min FPS | p95 | Calls | Triangles | Heap |
| ---- | -------- | ------: | ------: | --: | ----: | --------: | ---: |
| low | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | 10.58 | 4.44 | 151.9 | 167 | 3546 | 16.26 |
| medium | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | 9.91 | 4.68 | 158.28 | 167 | 3546 | 16.38 |
| high | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | 8.69 | 4.03 | 182.2 | 167 | 3546 | 17.45 |
| demo | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | 8.88 | 4.17 | 181.81 | 167 | 3546 | 21.1 |

## Memory after 3 seek+replay (demo mode)

```
{
  "heapDeltaMb": 2.19,
  "geometriesDelta": 12,
  "texturesDelta": 0
}
```

## Prior software/headless WebGL diagnostic baseline (reference only)

```
Average FPS: 9.6
Minimum FPS: 3.3
p95 frame time: 200 ms
```

Do **not** treat the above as live-demo GPU characteristics.

## Chromium launch args

```
--use-gl=angle --use-angle=gl-egl --enable-webgl --enable-webgl2 --ignore-gpu-blocklist --enable-gpu-rasterization --enable-precise-memory-info --enable-unsafe-swiftshader
```

Raw JSON: `agent/reports/gpu-baseline.json`
