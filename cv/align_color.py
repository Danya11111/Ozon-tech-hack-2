#!/usr/bin/env python3
"""
Автоподбор совмещения RGB↔depth для демо (сенсоры D415 разнесены).

Положите на ленту коробку с чёткими краями и запустите:
  .venv/bin/python align_color.py

Скрипт ищет сдвиг (dx, dy) и масштаб цветного кадра, при которых края
на RGB совпадают с краями на карте глубины, и пишет результат в config.yaml.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

from camera import RealSenseV4L2
from demo_hud import align_color


def _edges_depth(depth_mm: np.ndarray) -> np.ndarray:
    d = depth_mm.astype(np.float32)
    d = cv2.medianBlur(d.astype(np.uint16), 5).astype(np.float32)
    valid = d > 0
    if valid.sum() < 1000:
        return np.zeros(depth_mm.shape, np.uint8)
    lo, hi = np.percentile(d[valid], [2, 98])
    norm = np.clip((d - lo) / max(hi - lo, 1.0) * 255.0, 0, 255).astype(np.uint8)
    return cv2.Canny(norm, 30, 90)


def _edges_color(color_bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2GRAY)
    # тёмные сцены: выравниваем контраст перед Canny
    gray = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    return cv2.Canny(gray, 40, 120)


def _score(color_edges: np.ndarray, depth_band: np.ndarray, dx: float, dy: float, s: float) -> float:
    warped = align_color(color_edges[..., None].repeat(3, axis=2), dx, dy, s)[..., 0]
    return float(np.count_nonzero((warped > 0) & (depth_band > 0)))


def main() -> int:
    parser = argparse.ArgumentParser(description="Совмещение RGB и depth")
    parser.add_argument("-c", "--config", default=str(Path(__file__).with_name("config.yaml")))
    args = parser.parse_args()

    cfg_path = Path(args.config)
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    cam_cfg = cfg["camera"]

    print("[align] открываю камеру… на ленте должна лежать коробка с чёткими краями")
    cam = RealSenseV4L2(
        depth_device=cam_cfg.get("depth_device", "/dev/video0"),
        color_device=cam_cfg.get("color_device", "/dev/video4"),
        width=int(cam_cfg.get("width", 640)),
        height=int(cam_cfg.get("height", 480)),
        fps=int(cam_cfg.get("fps", 30)),
        use_color=True,
    )
    try:
        # прогрев RGB: первые кадры бывают пустыми, плюс автоэкспозиция
        for _ in range(30):
            cam.read()
            time.sleep(0.05)
        depth_acc, color_acc = [], []
        for _ in range(15):
            pair = cam.read()
            if pair is not None and not pair.color_is_depth_preview:
                depth_acc.append(pair.depth_mm.astype(np.float32))
                color_acc.append(pair.color_bgr.astype(np.float32))
            time.sleep(0.06)
        if len(color_acc) < 3:
            print("[align] RGB не читается — проверьте use_color/USB")
            return 1
        depth = np.median(np.stack(depth_acc), axis=0).astype(np.uint16)
        color = np.clip(np.mean(np.stack(color_acc), axis=0), 0, 255).astype(np.uint8)

        de = _edges_depth(depth)
        if np.count_nonzero(de) < 500:
            print("[align] мало краёв на depth — положите коробку в центр кадра")
            return 1
        band = cv2.dilate(de, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))
        ce = _edges_color(color)

        # грубый перебор → уточнение
        best = (0.0, 0.0, 1.0)
        best_s = -1.0
        for s in np.arange(0.90, 1.16, 0.05):
            for dx in range(-80, 81, 8):
                for dy in range(-60, 61, 8):
                    sc = _score(ce, band, dx, dy, float(s))
                    if sc > best_s:
                        best_s, best = sc, (float(dx), float(dy), float(s))
        bdx, bdy, bs = best
        for s in np.arange(bs - 0.04, bs + 0.045, 0.01):
            for dx in np.arange(bdx - 8, bdx + 9, 2):
                for dy in np.arange(bdy - 8, bdy + 9, 2):
                    sc = _score(ce, band, float(dx), float(dy), float(s))
                    if sc > best_s:
                        best_s, best = sc, (float(dx), float(dy), float(s))

        base = _score(ce, band, 0, 0, 1.0)
        dx, dy, s = best
        print(f"[align] лучшее совмещение: dx={dx:.0f} dy={dy:.0f} scale={s:.2f} "
              f"(совпадение краёв {best_s:.0f} против {base:.0f} без коррекции)")

        text = cfg_path.read_text(encoding="utf-8")
        text = re.sub(r"(?m)^(\s*color_dx:\s*)-?[\d.]+", rf"\g<1>{dx:.1f}", text)
        text = re.sub(r"(?m)^(\s*color_dy:\s*)-?[\d.]+", rf"\g<1>{dy:.1f}", text)
        text = re.sub(r"(?m)^(\s*color_scale:\s*)-?[\d.]+", rf"\g<1>{s:.3f}", text)
        cfg_path.write_text(text, encoding="utf-8")
        print(f"[align] записано в {cfg_path}")

        # контрольная картинка
        out = Path("debug_frames"); out.mkdir(exist_ok=True)
        from camera import depth_colormap
        aligned = align_color(color, dx, dy, s)
        vis = cv2.addWeighted(aligned, 0.6, depth_colormap(depth), 0.4, 0)
        cv2.imwrite(str(out / "align_check.jpg"), vis)
        print(f"[align] проверка: debug_frames/align_check.jpg")
    finally:
        cam.release()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
