#!/usr/bin/env python3
"""Assemble conveyor GLBs from FreeCAD-exported meshes.

Pipeline: manifest+STL (CAD-global mm, Z-up) -> mechanism grouping ->
dedupe (translation-invariant) -> decimation budget -> material slots ->
axis bake (-x, z, y+250)/1000 (proper rotation, det=+1) -> GLB.

Outputs:
  public/models/sorter/conveyor-source.glb  (full 0.25mm tessellation)
  public/models/sorter/conveyor-web.glb     (optimized, <=250k tris target)
  tools/stage2-cad/out/glb-stats.json
"""
import json
import os

import numpy as np
import trimesh

OUT = "/home/coder/arhipovdan/app/tools/stage2-cad/out"
DEST = "/home/coder/arhipovdan/app/public/models/sorter"
os.makedirs(DEST, exist_ok=True)

with open(os.path.join(OUT, "manifest.json"), encoding="utf-8") as fh:
    manifest = json.load(fh)

# --- mechanism grouping (documented in docs/stage2_real_sorter/mechanism-map.md) ---
def group_of(entry):
    label = entry["label"]
    name = entry["name"]
    if "Лента" in label:
        return "conveyor-belt"
    if "Барьер" in label:
        return "stop-gate"
    if "Крепление камеры" in label or "камера" in label or "Крепление камеры" in label:
        return "inspection-frame"
    if "Серво" in label or "серво" in label or "Держатель" in label:
        return "pusher-servo"
    if "Роликовый узел" in label:
        return "rollers"
    if "Ролик" in label or "Вал" in label or "Подшибник" in label:
        return "rollers"
    if "NEMA" in label or "Шкив" in label or "ремень" in label or "двигател" in label:
        return "motor-and-drive"
    if "Кронштейн" in label and name in ("Body009", "Link"):
        return "rollers"  # roller support bracket (roller assembly child)
    return "static-frame"

MATERIAL_SLOT = {
    "static-frame": "painted-metal",
    "conveyor-belt": "rubber-belt",
    "rollers": "brushed-metal",
    "motor-and-drive": "dark-mechanical",
    "inspection-frame": "painted-metal",
    "stop-gate": "safety-yellow",
    "pusher-servo": "dark-mechanical",
}

# Per-group decimation target for the web GLB (triangles per UNIQUE mesh).
DECIMATE_TARGET = {
    "conveyor-belt": 1200,
    "rollers": 9000,
    "motor-and-drive": 4000,
    "static-frame": 2500,
    "stop-gate": 7000,
    "pusher-servo": 9000,
    "inspection-frame": 12000,
}


def bake(mesh):
    """CAD mm Z-up -> GLB meters Y-up. (x,y,z) -> (-x, z, y+250)/1000, det=+1."""
    v = mesh.vertices
    x = -v[:, 0] / 1000.0
    y = v[:, 2] / 1000.0
    z = (v[:, 1] + 250.0) / 1000.0
    out = trimesh.Trimesh(vertices=np.column_stack([x, y, z]), faces=mesh.faces.copy(), process=False)
    out.fix_normals()
    return out


def dedupe_key(mesh):
    """Translation-invariant key: rounded vertices relative to bbox min + face count."""
    rel = mesh.vertices - mesh.vertices.min(axis=0)
    return (len(mesh.faces), hash(np.round(rel, 5).tobytes()))


def decimate(mesh, target):
    if len(mesh.faces) <= target:
        return mesh
    try:
        import fast_simplification
        pts = np.asarray(mesh.vertices, dtype=np.float32)
        fcs = np.asarray(mesh.faces, dtype=np.int64)
        r_pts, r_fcs = fast_simplification.simplify(pts, fcs, target_reduction=1.0 - target / len(mesh.faces))
        out = trimesh.Trimesh(vertices=r_pts, faces=r_fcs, process=False)
        out.fix_normals()
        return out
    except Exception as exc:  # noqa: BLE001
        print(f"  decimation failed ({exc}); keeping {len(mesh.faces)} tris")
        return mesh


def build(decimating, label):
    scene = trimesh.Scene()
    cache = {}
    stats = []
    for entry in manifest:
        grp = group_of(entry)
        mesh = trimesh.load(os.path.join(OUT, entry["stl"]), process=False)
        mesh = bake(mesh)
        before = len(mesh.faces)
        key = dedupe_key(mesh)
        if key in cache:
            geom_name, offset = cache[key]
            node_transform = np.eye(4)
            node_transform[:3, 3] = mesh.vertices.min(axis=0) - offset
            stats.append({"node": f"{grp}/{entry['label']}", "group": grp, "tris": 0, "instanced": True})
            scene.add_geometry(
                scene.geometry[geom_name],
                node_name=f"{grp}/{entry['label']}",
                geom_name=geom_name,
                transform=node_transform,
            )
            continue
        if decimating:
            mesh = decimate(mesh, DECIMATE_TARGET.get(grp, 4000))
        geom_name = f"g_{grp}_{entry['name']}"
        cache[key] = (geom_name, mesh.vertices.min(axis=0))
        mesh.metadata["material_slot"] = MATERIAL_SLOT.get(grp, "painted-metal")
        scene.add_geometry(mesh, node_name=f"{grp}/{entry['label']}", geom_name=geom_name)
        stats.append({
            "node": f"{grp}/{entry['label']}",
            "group": grp,
            "tris": len(mesh.faces),
            "trisBeforeDecimation": before,
            "instanced": False,
            "materialSlot": MATERIAL_SLOT.get(grp),
            "cadSource": entry["stl"],
        })
    path = os.path.join(DEST, f"conveyor-{label}.glb")
    scene.export(path)
    total = sum(s["tris"] for s in stats if not s["instanced"])
    print(f"{label}: nodes={len(stats)} unique-tris={total} file={os.path.getsize(path)} bytes")
    return path, stats, total


src_path, src_stats, src_tris = build(decimating=False, label="source")
web_path, web_stats, web_tris = build(decimating=True, label="web")

with open(os.path.join(OUT, "glb-stats.json"), "w", encoding="utf-8") as fh:
    json.dump({
        "source": {"path": src_path, "uniqueTriangles": src_tris, "bytes": os.path.getsize(src_path), "nodes": src_stats},
        "web": {"path": web_path, "uniqueTriangles": web_tris, "bytes": os.path.getsize(web_path), "nodes": web_stats},
    }, fh, ensure_ascii=False, indent=1)
print("done")
