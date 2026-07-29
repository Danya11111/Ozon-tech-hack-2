# Stage 1 — Source asset inventory

All sources are official OZON Tech archives already present in the repository.
Nothing was downloaded from the internet. Original ZIPs were not modified.

## Archives

| Archive | Role | Contents (relevant) |
|---|---|---|
| `input_info/doc-1782987733.zip` | Official STL set | `Stl/*.stl` — 11 product models |
| `input_info/doc-1782987706.zip` | Official STEP set | STEP versions of the same products |
| `3d_models/conveer.FCStd` | Conveyor CAD | FreeCAD document (b-rep, no tessellated mesh) |

## Product models (integrated)

| SKU | Model | Source file | Format | Runtime | Runtime SHA-256 (short) | Runtime bytes | Triangles | Status |
|---|---|---|---|---|---|---:|---:|---|
| SKU-001 | Короб 300×200×200 | `Stl/Короб 300х200х200.stl` | binary STL | `/models/box-300.stl` | `4ac9046b…` (source) | 29 684 | 592 | REAL |
| SKU-002 | ЛанчБокс | `Stl/ЛанчБокс.stl` | binary STL | `/models/lunchbox.stl` | — | 578 784 | 11 574 | REAL |
| SKU-003 | Моющее средство | `Stl/Моющее средство.stl` | binary STL | `/models/detergent.stl` | — | 1 472 984 | 29 458 | REAL (decimated 72 752→29 458 tris, 3.6 MB→1.47 MB, cell 2 mm) |
| SKU-004 | Короб 400×400×300 | `Stl/Короб 400х400х300.stl` | binary STL | `/models/box-400.stl` | — | 26 884 | 536 | REAL |
| SKU-005 | Пуфик | `Stl/Пуфик.stl` | binary STL | `/models/pouf.stl` | — | 644 084 | 12 880 | REAL |
| SKU-006 | Тарелка | `Stl/Тарелка.stl` | binary STL | `/models/plate.stl` | — | 125 284 | 2 504 | REAL |
| SKU-007 | Бутылка | `Stl/Бутылка.stl` | binary STL | `/models/bottle.stl` | — | 326 184 | 6 522 | REAL |
| SKU-008 | Цилиндр | `Stl/Цилиндр.stl` | binary STL | `/models/cylinder.stl` | — | 107 684 | 2 152 | REAL |
| SKU-009 | Ручка | `Stl/Ручка.stl` | binary STL | `/models/pen.stl` | — | 240 084 | 4 800 | REAL (decimated 40 926→4 800 tris, 2 MB→240 KB, cell 1 mm) |

Full SHA-256 values and per-axis measurements: `real-models-validation.json` +
`src/data/modelAssets.ts` (single source of truth).

## Honest fallbacks (no exact official model)

| SKU | Model | Status | Reason |
|---|---|---|---|
| SKU-010 | Boundary box 450×320×320 | `NO_EXACT_OFFICIAL_MODEL` | App-specific boundary-probe item, not in the official test set. Procedural box, marked in UI. |
| SKU-011 | Oversized round 500×300×300 | `NO_EXACT_OFFICIAL_MODEL` | App-specific C-priority probe. Procedural cylinder, marked in UI. Not silently substituted with Мешок/Шлем. |

## Archive-only models (present, no SKU in the app scenario set)

| Model | Source | Source SHA-256 (short) | Note |
|---|---|---|---|
| Мешок | `doc-1782987733.zip → Stl/Мешок.stl` | `74b31186…` | ASCII STL, ~183×175×199 mm |
| Шлем | `doc-1782987733.zip → Stl/Шлем.stl` | `660429b2…` | ~280×297×356 mm |

These are registered in `ARCHIVE_ONLY_MODELS` in the manifest so future stages can wire them
without re-inventorying.

## Conveyor

| Object | Source | Format | Status |
|---|---|---|---|
| Conveyor | `3d_models/conveer.FCStd` | FreeCAD b-rep | **BLOCKED_BY_CAD_CONVERSION** — no FreeCAD/Blender/assimp in the environment; FCStd contains no tessellated mesh. Procedural conveyor remains. Reproducible conversion instructions: `conversion-pipeline.md`. |
