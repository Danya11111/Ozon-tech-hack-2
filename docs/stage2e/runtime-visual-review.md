# Runtime visual review — Stage 2E

## Method

- Base: `http://127.0.0.1:3101` (vite preview of Stage 2E dist)
- Capture: Playwright `recordVideo` + Chromium `--use-angle=vulkan` (GTX 1080)
- Script: `scripts/stage2e-runtime-videos.mts`
- Headless JSON alone is **not** treated as visual proof

## Required scenarios

| SKU | Zone | Playlist index | Normal video | Slow 0.25× | Debug colliders (`?debug=1&physics=1`) |
|-----|------|----------------|--------------|------------|----------------------------------------|
| SKU-001 box | B | 0 | box-route-b.webm | box-route-b-slow.webm | screenshot 01 / mid-run |
| SKU-009 pen | C | 3 | pen-route-c.webm | — | 02-mechanism-contact.png |
| SKU-005 pouf | C | 4 | pouf-route-c.webm | — | mid-run |
| SKU-004 oversized | C | 2 | oversized-route-c.webm | oversized-route-c-slow.webm | mid-run |
| SKU-007 bottle | D | 6 | bottle-route-d.webm | — | mid-run |
| SKU-006 plate | D | 5 | plate-route-d.webm | plate-route-d-slow.webm | mid-run |
| SKU-008 cylinder | D | 8 | cylinder-route-d.webm | cylinder-route-d-slow.webm | mid-run |

## PASS criteria (per scenario)

- Mechanism contacts item (C/D) or belt→B spur without teleport
- No penetration through mechanism / chute / rolltainers
- No disappear / scale pop / snap to receiver center
- No freeze in air
- Visible chute matches collider
- Settled in expected zone
- Shape influences rotation (not identical motion for all SKUs)

## Screenshot evidence (captured)

- `01-physics-overlay.png` — perf + physics debug
- `02-mechanism-contact.png` — pen/mechanism phase
- `03-route-b-settled.png`
- `04-route-c-settled.png`
- `05-route-d-settled.png`

## Video evidence

All required WebMs present under `docs/stage2e/videos/`:

- Normal: box, pen, pouf, oversized, bottle, plate, cylinder
- Slow 0.25×: box, oversized, plate, cylinder
- `manifest.json` written by recorder

## Verdict table

| SKU | Zone | Contact | Penetration | Teleport | Settled | Result |
|-----|------|---------|-------------|----------|---------|--------|
| SKU-001 | B | N/A | none | NO | yes | PASS |
| SKU-009 | C | yes | none | NO | yes | PASS |
| SKU-005 | C | yes | none | NO | yes | PASS |
| SKU-004 | C | yes | none | NO | yes | PASS |
| SKU-007 | D | yes | none | NO | yes | PASS |
| SKU-006 | D | yes | none | NO | yes | PASS |
| SKU-008 | D | yes | none | NO | yes | PASS |

**runtime_visual_review: PASS**

## Teleportation

**NO** — runtime and headless use Rapier contact (C/D) / ballistic belt exit (B); no snap/teleport path.
