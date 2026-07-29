# FreeCAD 1.0.2 headless export macro — conveer.FCStd -> per-object STL + manifest JSON.
# Run: /tmp/squashfs-root/usr/bin/freecadcmd tools/stage2-cad/freecad-export.py
#
# Toolchain: FreeCAD 1.0.2 (official AppImage, github.com/FreeCAD/FreeCAD releases).
# The document is opened by FreeCAD itself, so App::Link / group semantics and
# global placements are resolved by the CAD kernel, not by reimplemented logic.
import json
import os
import struct
import sys

import FreeCAD
import Mesh
import Part

DOC_PATH = "/home/coder/arhipovdan/app/3d_models/conveer.FCStd"
OUT_DIR = "/home/coder/arhipovdan/app/tools/stage2-cad/out"
os.makedirs(OUT_DIR, exist_ok=True)

doc = FreeCAD.openDocument(DOC_PATH)

inventory = []
renderables = []

for obj in doc.Objects:
    entry = {
        "name": obj.Name,
        "label": obj.Label,
        "typeId": obj.TypeId,
        "visibility": getattr(obj, "Visibility", None),
        "hasShape": hasattr(obj, "Shape"),
    }
    if hasattr(obj, "Shape"):
        try:
            bb = obj.Shape.BoundBox
            entry["shapeBboxMm"] = [bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax]
            entry["shapeIsNull"] = obj.Shape.isNull()
        except Exception as exc:  # noqa: BLE001
            entry["shapeError"] = str(exc)
    if obj.TypeId == "App::Link":
        try:
            linked = obj.LinkedObject
            entry["linkedObject"] = getattr(linked, "Name", str(linked))
        except Exception as exc:  # noqa: BLE001
            entry["linkedObject"] = f"ERROR:{exc}"
    inventory.append(entry)

# Renderable set = what the viewport shows: visible top-level geometry objects.
# PartDesign inner features (Pad/Pocket/Fillet/...) are not rendered separately —
# only their Body tip is. Groups and origins carry no geometry.
RENDERABLE_TYPES = {"PartDesign::Body", "App::Link", "Part::Feature"}
for obj in doc.Objects:
    if obj.TypeId not in RENDERABLE_TYPES:
        continue
    if not getattr(obj, "Visibility", False):
        continue
    if not hasattr(obj, "Shape"):
        continue
    try:
        shape = obj.Shape
        if shape.isNull():
            continue
        bb = shape.BoundBox
        if bb.XLength == 0 and bb.YLength == 0 and bb.ZLength == 0:
            continue
    except Exception:
        continue
    renderables.append(obj)

print(f"objects={len(inventory)} renderables={len(renderables)}")

manifest = []
for obj in renderables:
    shape = obj.Shape
    # Verified on this document (probe.py): obj.Shape is already in
    # document-global coordinates for both PartDesign::Body and App::Link —
    # placement is baked into the stored shape and must NOT be re-applied.
    # Tessellate as-is; no additional transform.
    try:
        verts, facets = shape.tessellate(0.25)  # 0.25 mm linear deflection
    except Exception as exc:  # noqa: BLE001
        print(f"SKIP tessellate failed: {obj.Name}: {exc}")
        continue
    if not facets:
        continue
    stl_name = f"{obj.Name}.stl"
    stl_path = os.path.join(OUT_DIR, stl_name)
    # binary STL, normals left zero (recomputed downstream)
    with open(stl_path, "wb") as fh:
        fh.write(b"\0" * 80)
        fh.write(struct.pack("<I", len(facets)))
        for tri in facets:
            fh.write(struct.pack("<3f", 0.0, 0.0, 0.0))
            for idx in tri:
                v = verts[idx]
                fh.write(struct.pack("<3f", float(v.x), float(v.y), float(v.z)))
            fh.write(struct.pack("<H", 0))
    bb = shape.BoundBox
    manifest.append({
        "name": obj.Name,
        "label": obj.Label,
        "typeId": obj.TypeId,
        "stl": stl_name,
        "triangles": len(facets),
        "globalBboxMm": [bb.XMin, bb.YMin, bb.ZMin, bb.XMax, bb.YMax, bb.ZMax],
        "linkedObject": next((e.get("linkedObject") for e in inventory if e["name"] == obj.Name), None),
    })
    safe_label = obj.Label.encode("ascii", "replace").decode("ascii")
    print(f"  {obj.Name:14s} {safe_label[:28]:28.28s} tris={len(facets):6d} bbox=({bb.XMin:.0f},{bb.YMin:.0f},{bb.ZMin:.0f})..({bb.XMax:.0f},{bb.YMax:.0f},{bb.ZMax:.0f})")

with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=1)
with open(os.path.join(OUT_DIR, "fcstd-inventory.json"), "w", encoding="utf-8") as fh:
    json.dump(inventory, fh, ensure_ascii=False, indent=1)
print(f"exported {len(manifest)} meshes -> {OUT_DIR}")
FreeCAD.closeDocument(doc.Name)
