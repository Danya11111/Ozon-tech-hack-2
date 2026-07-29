# Stage 1 — Conversion pipeline (reproducible)

Constraint honored: **no system packages were installed** (no `apt`/`snap`), nothing was
downloaded. All steps run with Node.js from the project's own toolchain.

## Pipeline per source type

| Source | Tool | Conversion | Runtime format | Reproducible | Status |
|---|---|---|---|---|---|
| Official STL (9 products) | `scripts/stage1-analyze-stl.mjs` (dependency-free Node) | measure: tris, bbox, size → manifest | binary STL (as authored, mm) | yes: `node scripts/stage1-analyze-stl.mjs <file.stl>` | DONE |
| Overweight STL (detergent, pen) | `scripts/stage1-decimate-stl.mjs` (vertex clustering, dependency-free) | weld+cluster on uniform grid, flat normals rebuilt | binary STL | yes: `node scripts/stage1-decimate-stl.mjs <in.stl> <out.stl> <cellMm>` | DONE |
| Runtime normalization | `src/components/ThreeD/RealItemModel.tsx` | rotation → mm→m (÷1000) → bottom-center pivot, baked into a cloned geometry; transforms come only from the manifest | three.js BufferGeometry | yes: manifest-driven, validated | DONE |
| Validation | `scripts/validate-real-models.mjs` | parses manifest (via project `typescript`), re-measures runtime STLs, compares to `worldExpectedMm` with tolerance max(2 mm, 1 %) | `real-models-validation.json` | yes: `node scripts/validate-real-models.mjs` (exit ≠0 on critical failure) | DONE |
| Official STEP | — | — | — | — | NOT USED (STL equivalents exist for every SKU; STEP needs CAD tooling) |
| Conveyor FCStd | — | — | — | — | **BLOCKED_BY_CAD_CONVERSION** |

## Why STL and not GLB

GLB was the preferred target, but producing a trustworthy GLB requires a mesh tool
(Blender/assimp/gltf-transform pipeline) that is not available in this environment and may not
be installed per stage constraints. The spec explicitly allows official STL with separate
normalization, explicit orientation/pivot transforms, automatic bbox verification and a
documented limitation. All four conditions are implemented (`RealItemModel.tsx`,
`validate-real-models.mjs`, this file). STL limitations: no materials/hierarchy — acceptable
for Stage 1 (geometry fidelity is the goal; materials are Stage 2).

## Decimation details (budget enforcement)

| Model | Before | After | Cell size | Shape check |
|---|---:|---:|---:|---|
| Моющее средство | 72 752 tris / 3 638 084 B | 29 458 tris / 1 472 984 B | 2 mm | bbox unchanged within 0.2 mm; validation PASS |
| Ручка | 40 926 tris / 2 046 584 B | 4 800 tris / 240 084 B | 1 mm | bbox unchanged within 0.5 mm; validation PASS |

Both results are committed runtime files; the command above reproduces them from the
extracted sources byte-for-byte given the same cell size.

## Conveyor: exact blocked status and how to continue

Facts:
- `3d_models/conveer.FCStd` is a FreeCAD document (ZIP container with `Document.xml`,
  b-rep geometry in `*.brp`/OCCT format). It contains **no tessellated mesh** — a CAD kernel
  is required to triangulate it.
- Environment check (executed, not assumed): `freecad`, `freecadcmd`, `blender`, `assimp`,
  `meshlabserver`, `openscad` — all absent; Python `trimesh`/`numpy`/`cadquery` — absent.
- Stage rules forbid installing system tools and forbid fake replacement models.

Decision (per spec §13.5): keep the existing **procedural conveyor**, mark the node
`BLOCKED_BY_CAD_CONVERSION`, finish the official products, and provide the exact continuation
command. Stage status therefore cannot be `REAL_MODELS_INTEGRATED`.

Owner-side continuation (any one of):

```bash
# Option A — FreeCAD CLI (official)
freecadcmd -c "import FreeCAD,Import,Mesh; \
doc=FreeCAD.open('3d_models/conveer.FCStd'); \
objs=[o for o in doc.Objects if hasattr(o,'Shape')]; \
Mesh.export(objs,'tools/stage1-assets/source/conveyor.stl')"
# then: node scripts/stage1-analyze-stl.mjs tools/stage1-assets/source/conveyor.stl

# Option B — FreeCAD STEP export + Blender GLB
freecadcmd -c "import FreeCAD,Import; \
doc=FreeCAD.open('3d_models/conveer.FCStd'); \
Import.export([o for o in doc.Objects if hasattr(o,'Shape')],'tools/stage1-assets/source/conveyor.step')"
blender -b -P tools/stage1-assets/convert-step-to-glb.py -- conveyor.step conveyor.glb
```

After conversion: split into `staticFrame / belt / inspectionRig / actuatorMounts`
(spec §13.4), register in `src/data/modelAssets.ts` as a conveyor node, and re-run
`node scripts/validate-real-models.mjs` and `node scripts/stage1-benchmark.mjs` (Profile C is
already wired and will execute once a conveyor runtime asset exists).

## Node dev tooling added

None. All scripts are dependency-free Node 22; `typescript` (already a project devDependency)
is used only by the validation script to load the TS manifest. Nothing lands in the runtime
bundle.
