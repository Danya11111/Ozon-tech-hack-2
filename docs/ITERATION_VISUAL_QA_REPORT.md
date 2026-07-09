# Iteration Visual QA Report

Date: 2026-07-09
Branch: `dan_branch`
Scope: one limited 3D demo improvement cycle for `https://arhipovdan.ru/`.

## Before / After Screenshots

Screenshots saved in `docs/visual_qa_screenshots/`:

- `before_initial_production.png` — production initial state before playback.
- `after_running_item_on_belt.png` — production after deploy, item moving on belt.
- `after_cv_overlay_no_overlap.png` — production after deploy, CV overlay visible without HUD overlap.
- `after_demo_complete_8_cases.png` — production after deploy, all 8 cases completed.
- `after_details_page.png` — `/details` production check.

## Top 3 Issues Fixed

1. Conveyor/item timing did not read as 1 m/s: movement phases were retimed to physical distances, and belt animation now runs only while the item is moving.
2. Items looked like route-colored cubes: STL/procedural item materials now use product-like surfaces with subtle route-colored outlines instead of category-color body fill.
3. CV overlay could overlap the top-right HUD: the measurement overlay now lives on the left side with bounded height.

## Verification

- `npm run build` — passed.
- `npm run test` — passed, 11 test files / 113 tests.
- `docker compose -p owl -f docker-compose.server.yml up -d --build` — passed, `owl-web-1` recreated and started.
- Playwright production QA — passed with `NO_CONSOLE_ERRORS`.

## Acceptance Checklist

- [x] No console errors.
- [x] Item does not fly.
- [x] Item does not fall through the belt.
- [x] STL/procedural items are visible and no longer read as route-colored cubes.
- [x] Belt and item movement are synchronized during movement phases.
- [x] HUD and CV overlay do not overlap.
- [x] Play starts the demo.
- [x] `/details` works.
- [x] Before/after screenshots exist.

## Notes

- No changes were made to `/details`, nginx, Dockerfile, classifier logic, or scenarios.
- No physics engine was added.
- No commit or push was made.
