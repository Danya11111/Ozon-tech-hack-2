#!/usr/bin/env python3
"""
Калибровка камеры для точных габаритов (правила ТЗ: >10×10×10, <450×320×320 мм).

Два шага:
  1) пустая лента → высота belt_distance_mm;
  2) коробка известного размера в центре → фокусное fx=fy.

Запуск (пример для коробки 300×200 мм, высотой ≥ 30 мм):
  .venv/bin/python calibrate.py --length 300 --width 200

Результат пишется прямо в config.yaml (fx, fy, belt_distance_mm).
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
from measure import segment_object


def _wait_key(prompt: str) -> None:
    """Ждёт одиночное нажатие: 1 — продолжить, q — выйти (Enter не нужен)."""
    print(prompt + " [1 — продолжить, q — выйти]", flush=True)

    if not sys.stdin.isatty():
        # stdin не терминал (пайп/IDE) — читаем строку
        line = sys.stdin.readline().strip().lower()
        if line.startswith("q"):
            raise KeyboardInterrupt
        return

    import termios
    import tty

    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        while True:
            ch = sys.stdin.read(1)
            if ch in ("1", "\r", "\n"):  # Enter тоже принимаем на всякий случай
                return
            if ch in ("q", "Q", "\x03"):  # q или Ctrl+C
                raise KeyboardInterrupt
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def _collect_belt(cam: RealSenseV4L2, samples: int = 25) -> float:
    vals = []
    for _ in range(samples):
        pair = cam.read()
        if pair is None:
            time.sleep(0.05)
            continue
        d = pair.depth_mm
        h, w = d.shape
        roi = d[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
        valid = roi[(roi > 200) & (roi < 4000)]
        if valid.size > 100:
            vals.append(float(np.median(valid)))
        time.sleep(0.04)
    if not vals:
        raise RuntimeError("Не вижу ленту: проверьте, что камера на 0.5–1.5 м над поверхностью")
    return float(np.median(vals))


def _collect_focal(
    cam: RealSenseV4L2,
    belt_mm: float,
    known_length_mm: float,
    known_width_mm: float,
    samples: int = 40,
) -> float:
    """fx=fy по площади minAreaRect в пикселях: f = z * sqrt(S_px / S_mm)."""
    focals = []
    for _ in range(samples):
        pair = cam.read()
        if pair is None:
            time.sleep(0.05)
            continue
        seg = segment_object(pair.depth_mm, belt_distance_mm=belt_mm, min_area_px=400)
        if seg is None:
            time.sleep(0.04)
            continue
        mask, contour = seg
        ys, xs = np.where(mask > 0)
        z = pair.depth_mm[ys, xs].astype(np.float32)
        z = z[z > 0]
        if z.size < 100:
            continue
        z_med = float(np.median(z))

        rect = cv2.minAreaRect(contour)
        pw, ph = rect[1]
        if pw < 10 or ph < 10:
            continue
        f = z_med * float(np.sqrt((pw * ph) / (known_length_mm * known_width_mm)))
        focals.append(f)
        time.sleep(0.04)
    if len(focals) < 10:
        raise RuntimeError(
            f"Стабильно вижу коробку только в {len(focals)} кадрах из {samples}. "
            "Коробка должна быть высотой ≥ 30 мм и лежать в центре кадра."
        )
    return float(np.median(focals))


def _patch_config(path: Path, fx: float, belt_mm: float) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"(?m)^(\s*fx:\s*)[\d.]+", rf"\g<1>{fx:.1f}", text)
    text = re.sub(r"(?m)^(\s*fy:\s*)[\d.]+", rf"\g<1>{fx:.1f}", text)
    text = re.sub(r"(?m)^(belt_distance_mm:\s*)[\d.]+", rf"\g<1>{belt_mm:.0f}", text)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Калибровка fx/fy и высоты ленты")
    parser.add_argument("-c", "--config", default=str(Path(__file__).with_name("config.yaml")))
    parser.add_argument("--length", type=float, required=True, help="Длина коробки, мм (рулеткой)")
    parser.add_argument("--width", type=float, required=True, help="Ширина коробки, мм (рулеткой)")
    parser.add_argument("--yes", action="store_true", help="Не ждать Enter (сцена уже готова на каждом шаге)")
    args = parser.parse_args()

    cfg_path = Path(args.config)
    if not cfg_path.exists():
        example = cfg_path.with_name("config.example.yaml")
        if not example.exists():
            raise SystemExit(f"Config not found: {cfg_path}")
        cfg_path = example
        print(f"[calib] using {cfg_path.name} (copy to config.yaml before saving results)")
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    cam_cfg = cfg["camera"]

    print("[calib] открываю RealSense D415…")
    cam = RealSenseV4L2(
        depth_device=cam_cfg.get("depth_device", "/dev/video0"),
        color_device=cam_cfg.get("color_device", "/dev/video4"),
        width=int(cam_cfg.get("width", 640)),
        height=int(cam_cfg.get("height", 480)),
        fps=int(cam_cfg.get("fps", 30)),
        depth_scale_mm=float(cam_cfg.get("depth_scale_mm", 1.0)),
        use_color=False,
    )
    try:
        if not args.yes:
            _wait_key("[calib] Шаг 1/2: УБЕРИТЕ всё с ленты")
        belt_mm = _collect_belt(cam)
        print(f"[calib] высота до ленты: {belt_mm:.0f} мм")

        if not args.yes:
            _wait_key(
                f"[calib] Шаг 2/2: положите коробку {args.length:.0f}×{args.width:.0f} мм "
                "в центр кадра"
            )
            time.sleep(1.0)
        fx = _collect_focal(cam, belt_mm, args.length, args.width)
        old_fx = float(cam_cfg.get("fx", 0))
        print(f"[calib] фокусное fx=fy: {fx:.1f} (было {old_fx:.1f})")
        if old_fx > 0:
            k = fx / old_fx
            print(f"[calib] габариты со старым fx были завышены/занижены в {k:.2f} раза")

        _patch_config(cfg_path, fx, belt_mm)
        print(f"[calib] записано в {cfg_path}: fx=fy={fx:.1f}, belt_distance_mm={belt_mm:.0f}")
        print("[calib] проверьте: .venv/bin/python demo.py — размеры LWH должны совпадать с рулеткой")
    except KeyboardInterrupt:
        print("\n[calib] отменено, config.yaml не изменён")
        return 1
    finally:
        cam.release()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
