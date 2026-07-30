# Real phone validation — Stage 2E

## Status: NOT_TESTED_ON_REAL_PHONE

No physical Android or iPhone was available in this environment. Emulation is **not** counted as PASS.

## Prepared protocol (reproducible)

1. Ensure permanent HTTPS `https://sorter.arhipovdan.ru` OR temporary Quick Tunnel HTTPS URL.
2. Open `/device-test` on desktop; scan the **Public HTTPS QR** (no tokens).
3. On phone Chrome/Safari, confirm diagnostics:
   - device model / OS / browser version (from UA — do not store IMEI/IP)
   - WebGL renderer
   - mobile tier / quality mode
   - Page FPS
   - Telegram WebView flag
   - orientation + safe-area layout (`100dvh`)
4. Open simulation → continuous scan → portrait + landscape.
5. Force low: `/?quality=low` — confirm SVG or approved low 3D.
6. Save:
   - screenshot of `/device-test`
   - screenshot of simulator
   - diagnostic JSON export (no PII)
7. Telegram: open HTTPS URL in in-app browser; confirm forced SVG / approved low; no GLB load in SVG mode.

## Local readiness (this machine)

| Check | Result |
|-------|--------|
| `/device-test` route | PASS (local 3101) |
| QR generated (qrcode) | PASS — encodes `https://sorter.arhipovdan.ru/device-test` when opened on loopback |
| Mobile low / SVG policy | PASS (e2e + Stage 2D/2E screenshots) |
| Permanent HTTPS for phone | BLOCKED (DNS → openresty 404 / TLS unrecognized_name) |

## Device results table

| Device | Browser | Renderer | Mode | FPS | Layout | Controls | Result |
|--------|---------|----------|------|-----|--------|----------|--------|
| Android (real) | — | — | — | — | — | — | NOT_TESTED |
| iPhone (real) | — | — | — | — | — | — | NOT_TESTED |
| Telegram WebView | — | — | — | — | — | — | NOT_TESTED |
| Desktop Chromium (lab) | Chromium | GTX 1080 ANGLE Vulkan | demo | ~60 | full-height | PASS | LAB_ONLY |

Screenshots `06-device-test-android.png` / `07-device-test-iphone.png` are **local device-test UI captures**, not real handset proofs.
