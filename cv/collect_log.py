#!/usr/bin/env python3
"""
Сбор логов классификации с камеры.
Кладите предметы по очереди — пишет CSV + печатает сводку.

  .venv/bin/python collect_log.py
  # Ctrl+C — стоп
"""

from __future__ import annotations

import csv
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

from camera import RealSenseV4L2
from measure import measure_object, segment_object
from stabilize import DecisionStabilizer


def main() -> int:
    cfg = yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8"))
    cam_cfg = cfg["camera"]
    cls = cfg["classification"]
    thr = float(cls.get("circle_ratio_threshold", 0.8))

    out_dir = Path("debug_frames")
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%H%M%S")
    csv_path = out_dir / f"log_{stamp}.csv"

    cam = RealSenseV4L2(
        depth_device=cam_cfg.get("depth_device", "/dev/video0"),
        color_device=cam_cfg.get("color_device", "/dev/video4"),
        width=int(cam_cfg.get("width", 640)),
        height=int(cam_cfg.get("height", 480)),
        fps=int(cam_cfg.get("fps", 30)),
        depth_scale_mm=float(cam_cfg.get("depth_scale_mm", 1.0)),
        use_color=False,
    )
    belt = float(cfg.get("belt_distance_mm") or 600)
    print(f"[log] belt={belt:.0f} mm  thr={thr}  → {csv_path}")
    print("[log] Кладите КРУГ / ПРЯМОУГОЛЬНИК. Ctrl+C — стоп.\n")

    stab = DecisionStabilizer(window=12, confirm_frames=8, lost_frames=12, enter_circle=thr)
    fx, fy = float(cam_cfg["fx"]), float(cam_cfg["fy"])
    cx, cy = float(cam_cfg["cx"]), float(cam_cfg["cy"])

    f = csv_path.open("w", newline="", encoding="utf-8")
    w = csv.writer(f)
    w.writerow(
        [
            "t",
            "present",
            "L",
            "W",
            "H",
            "top",
            "sec",
            "circle",
            "raw_zone",
            "lock",
            "lock_zone",
            "conf",
        ]
    )

    last_print = 0.0
    n = 0
    try:
        while True:
            pair = cam.read()
            if pair is None:
                time.sleep(0.02)
                continue
            n += 1
            seg = segment_object(
                pair.depth_mm,
                belt_distance_mm=belt,
                belt_tolerance_mm=float(cfg.get("belt_tolerance_mm", 25)),
                min_object_height_mm=float(cfg.get("min_object_height_mm", 5)),
                min_area_px=int(cfg.get("min_object_area_px", 400)),
            )
            m = None
            if seg is not None:
                mask, contour = seg
                m = measure_object(
                    pair.depth_mm, mask, contour, belt, fx, fy, cx, cy
                )

            d = stab.update(
                m,
                min_mm=cls.get("min_mm", [10, 10, 10]),
                max_mm=cls.get("max_mm", [450, 320, 320]),
            )

            if m is None:
                raw_zone = "-"
                row = [time.time(), 0, "", "", "", "", "", "", raw_zone, int(d.locked), "", d.confidence_pct]
            else:
                dims = sorted([m.length_mm, m.width_mm, m.height_mm], reverse=True)
                raw = "C"
                if all(dims[i] > 10 and dims[i] < [450, 320, 320][i] for i in range(3)):
                    raw = "D" if m.circle_ratio >= thr else "B"
                lz = d.result.category.zone if (d.locked and d.result) else ""
                row = [
                    time.time(),
                    1,
                    round(dims[0], 1),
                    round(dims[1], 1),
                    round(dims[2], 1),
                    round(m.top_ratio, 3),
                    round(m.section_ratio, 3),
                    round(m.circle_ratio, 3),
                    raw,
                    int(d.locked),
                    lz,
                    d.confidence_pct,
                ]
            w.writerow(row)
            if n % 5 == 0:
                f.flush()

            now = time.time()
            if now - last_print > 0.45:
                last_print = now
                if m is None:
                    print(f"[{n:05d}] пусто")
                else:
                    lz = d.result.category.zone if (d.locked and d.result) else "…"
                    print(
                        f"[{n:05d}] raw={row[8]} lock={lz or '—':1s} conf={d.confidence_pct:3d}% | "
                        f"LWH={row[2]:.0f}×{row[3]:.0f}×{row[4]:.0f} | "
                        f"top={m.top_ratio:.3f} sec={m.section_ratio:.3f} circ={m.circle_ratio:.3f}"
                    )
    except KeyboardInterrupt:
        print(f"\n[log] сохранено {csv_path}")
    finally:
        f.close()
        cam.release()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
