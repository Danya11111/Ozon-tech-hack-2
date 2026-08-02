# OZON Sorter Digital Twin

Web digital twin of an Ozon Tech Track 3 conveyor sorting line: continuous product playback, camera/classification stage, B/C/D routing, and author-CAD diverter motion.

## Current product

This repository contains:

- web-based conveyor sorting simulation (`/`);
- engineering documentation page (`/documentation`);
- author CAD conveyor source (`3d_models/conveer.FCStd`);
- runtime conveyor GLB (`public/models/sorter/conveyor-clean.glb`);
- product STL assets (`public/models/*.stl`);
- camera / classification stage;
- B / C / D route mapping with CAD left/right diverters;
- Rapier-backed product physics (contact routing **not** fully validated).

## Quick start

```bash
npm ci
npm run dev          # http://127.0.0.1:3100
npm test -- --run
npm run build
npm run preview      # http://127.0.0.1:3100
```

## Active routes

| Route | Purpose |
|---|---|
| `/` | Continuous digital-twin simulation |
| `/documentation` | Canonical product / engineering status |
| `*` | Redirects to `/` |

Removed routes (`/details`, `/device-test`) are not part of the product.

## Runtime architecture

```
index.html
→ src/main.tsx
→ src/App.tsx
→ MainPage (/) | DocumentationPage (/documentation)
→ SorterDigitalTwinContinuous
→ ConveyorCadModel (conveyor-clean.glb)
→ product visuals / physics (STL + Rapier)
→ classifier (domain)
→ diverter product state machine (READY→ARMED→OPENING→HOLDING→CLOSING)
```

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

Missing primary brief (do not cite as present): `input_info/extracted/Постановка_Задача_3_сжато_2.pdf`.

## Validation

- Unit tests: **221/221** (`npm test -- --run`)
- Production build: **PASS** (`npm run build`)
- Two-page routing: `/` + `/documentation`
- CAD / GLB checksums: verified against values above
- Diverter frozen angles / duration: covered by unit tests
- Physical junction contact matrix: **45/45** — **ENGINEERING-DERIVED PHYSICAL VALIDATION** (not production-certified)

## Physics (junction contact)

- Same dynamic product rigid body through spawn → junction → receiver settle
- LEFT/RIGHT CAD diverters use `kinematicPositionBased` colliders synced to the accepted CAD yaw
- B: physical straight corridor; C/D: contact-only redirection; receiver sensors detect only
- Temporary scripted junction handoff removed from the active product path

## Current limitations

- Product profiles are **engineering-derived**, not production-calibrated.
- Author CAD horn / complete transmission is absent or incomplete in the active GLB (`AUTHOR_CAD_INCOMPLETE`).
- Official compliance claims are limited by the **missing** extracted task PDF and by not re-parsing PDFs in every doc pass.
- Generated screenshots, videos, Gate stage folders, and tool `out/` trees are **not** canonical.

## Repository policy

- Keep author CAD, active runtime assets, official sources, build configs, and tests that protect active behavior.
- Generated outputs and historical media are not product truth.
- Rollback point: git baseline `4413f01` on `dan_branch`.

See also: `/documentation` in the running app, and `docs/ENGINEERING.md`.
