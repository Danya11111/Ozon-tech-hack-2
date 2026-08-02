#!/usr/bin/env python3
"""
Алгоритмическая часть трека 3: Intel RealSense D415 на Orange PI.

Пайплайн:
  depth+color → сегментация объекта на ленте → габариты L×W×H + circle_ratio
  → классификация (B/C/D) → MQTT → сервоприводы Arduino (без правок arduino_code).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import yaml

from camera import RealSenseV4L2, depth_colormap
from classify import Category, ClassificationResult
from journal import append_decision
from measure import measure_flat_object, measure_object, segment_objects, segment_rgb_objects, is_plausible_measurement
from mqtt_bridge import MqttBridge
from stabilize import DecisionStabilizer

ZONE_TO_CATEGORY = {
    "B": Category.SUITABLE,
    "C": Category.OVERSIZE,
    "D": Category.NEED_PACK,
}


def resolve_config_path(path: Path) -> Path:
    if path.exists():
        return path
    example = path.with_name("config.example.yaml")
    if example.exists():
        return example
    raise FileNotFoundError(f"Config not found: {path} (and no config.example.yaml)")


def load_config(path: Path) -> Dict[str, Any]:
    resolved = resolve_config_path(Path(path))
    with open(resolved, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def draw_overlay(
    color_bgr,
    depth_mm,
    measurement,
    result: Optional[ClassificationResult],
    belt_mm: float,
):
    vis = color_bgr.copy()
    depth_vis = depth_colormap(depth_mm)
    if measurement is not None:
        cv2.drawContours(vis, [measurement.contour], -1, (0, 255, 0), 2)
        cx, cy = measurement.centroid_px
        cv2.circle(vis, (cx, cy), 4, (0, 0, 255), -1)
        lines = [
            f"L={measurement.length_mm:.0f} W={measurement.width_mm:.0f} H={measurement.height_mm:.0f} mm",
            f"circle_ratio={measurement.circle_ratio:.3f}",
        ]
        if result is not None:
            lines.append(f"{result.category.zone}: {result.category.ru_label}")
        y = 24
        for line in lines:
            cv2.putText(vis, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 3, cv2.LINE_AA)
            cv2.putText(vis, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1, cv2.LINE_AA)
            y += 22
    cv2.putText(
        vis,
        f"belt={belt_mm:.0f}mm",
        (10, vis.shape[0] - 12),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (200, 200, 200),
        1,
        cv2.LINE_AA,
    )
    return vis, depth_vis


def main() -> int:
    parser = argparse.ArgumentParser(description="RealSense D415 classifier for hackathon track 3")
    parser.add_argument(
        "-c",
        "--config",
        default=str(Path(__file__).with_name("config.yaml")),
        help="Путь к config.yaml",
    )
    parser.add_argument("--once", action="store_true", help="Один кадр и выход")
    parser.add_argument("--no-mqtt", action="store_true", help="Не публиковать в MQTT")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Живое превью в debug_frames/live_*.jpg (без GTK-окон)",
    )
    parser.add_argument("--dry-route", action="store_true", help="Не двигать серво")
    parser.add_argument("--no-motor", action="store_true", help="Не включать шаговик ленты")
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    cam_cfg = cfg["camera"]
    cls_cfg = cfg["classification"]
    rt = cfg.get("runtime", {})
    mqtt_cfg = dict(cfg.get("mqtt", {}))
    routing_cfg = dict(cfg.get("routing", {}))
    motor_cfg = dict(cfg.get("motor", {}))
    if args.no_mqtt:
        mqtt_cfg["enabled"] = False
    if args.dry_route:
        routing_cfg["enabled"] = False
    if args.no_motor:
        motor_cfg["enabled"] = False
    mqtt_cfg["_routing"] = routing_cfg
    mqtt_cfg["_motor"] = motor_cfg

    show_preview = args.preview or bool(rt.get("show_preview", False))
    save_debug = bool(rt.get("save_debug_frames", False)) or show_preview
    debug_dir = Path(rt.get("debug_dir", "debug_frames"))
    if save_debug or show_preview:
        debug_dir.mkdir(parents=True, exist_ok=True)
    live_color = debug_dir / "live_color.jpg"
    live_depth = debug_dir / "live_depth.jpg"
    preview_every = max(1, int(rt.get("preview_every_n", 3)))

    print("[vision] открываю RealSense D415…")
    cam = RealSenseV4L2(
        depth_device=cam_cfg.get("depth_device", "/dev/video0"),
        color_device=cam_cfg.get("color_device", "/dev/video4"),
        width=int(cam_cfg.get("width", 640)),
        height=int(cam_cfg.get("height", 480)),
        fps=int(cam_cfg.get("fps", 30)),
        depth_scale_mm=float(cam_cfg.get("depth_scale_mm", 1.0)),
        use_color=bool(cfg.get("use_color", False)),
    )

    belt_mm = float(cfg.get("belt_distance_mm") or 0)
    if belt_mm <= 0:
        print("[vision] калибровка плоскости ленты (уберите объекты)…")
        belt_mm = cam.estimate_belt_distance_mm()
        print(f"[vision] belt_distance_mm ≈ {belt_mm:.1f}")
    else:
        print(f"[vision] belt_distance_mm из конфига: {belt_mm:.1f}")

    background = None
    color_background = None
    if bool(cfg.get("use_background_map", False)):
        print("[vision] снимаю фоновую карту сцены — лента должна быть ПУСТОЙ…")
        try:
            background = cam.capture_background(samples=15)
            print("[vision] фоновая карта активна (сегментация относительно фона)")
        except RuntimeError as exc:
            print(f"[vision] фоновая карта не снята ({exc}), работаю по скалярной высоте")
        color_background = cam.capture_background_rgb(samples=10)
        if color_background is not None:
            print("[vision] RGB-фон снят — плоские товары (телефон) будут детектироваться")

    bridge = MqttBridge(mqtt_cfg)
    print(f"[vision] MQTT: {'OK' if bridge.connected else 'offline/disabled'}")
    if bridge.connected:
        bridge.start_conveyor()
    if show_preview:
        print(f"[vision] превью → {live_color} и {live_depth} (обновляются на лету)")
        print("[vision] откройте файлы в IDE/файловом менеджере или: eog debug_frames/live_color.jpg")

    confirm_need = int(rt.get("confirm_frames", 8))
    process_every_n = max(1, int(rt.get("process_every_n", 1)))
    frame_i = 0
    thr = float(cls_cfg.get("circle_ratio_threshold", 0.8))
    fallback_zone = str(cls_cfg.get("uncertain_fallback_zone", "C")).upper()
    stabilizer = DecisionStabilizer(
        window=12,
        confirm_frames=confirm_need,
        lost_frames=12,
        enter_circle=thr,
        exit_circle=thr - 0.08,
        uncertain_after=int(cls_cfg.get("uncertain_after_frames", 45)),
        fallback=ZONE_TO_CATEGORY.get(fallback_zone, Category.OVERSIZE),
    )
    last_routed_zone: Optional[str] = None
    decisions_log = Path(rt.get("decisions_log", "logs/decisions.jsonl"))

    fx, fy = float(cam_cfg["fx"]), float(cam_cfg["fy"])
    cx, cy = float(cam_cfg["cx"]), float(cam_cfg["cy"])

    try:
        while True:
            pair = cam.read()
            if pair is None:
                print("[vision] нет кадра", file=sys.stderr)
                time.sleep(0.05)
                continue

            frame_i += 1
            measurement = None
            result = None

            if frame_i % process_every_n == 0:
                candidates = segment_objects(
                    pair.depth_mm,
                    belt_distance_mm=belt_mm,
                    belt_tolerance_mm=float(cfg.get("belt_tolerance_mm", 25)),
                    min_object_height_mm=float(cfg.get("min_object_height_mm", 5)),
                    min_area_px=int(cfg.get("min_object_area_px", 800)),
                    background_mm=background,
                    max_objects=int(cfg.get("max_objects_in_frame", 3)),
                    roi_margin=cfg.get("roi_margin"),
                )
                seg = None
                best = None  # (score, mask, contour, measurement)
                for mask, contour in candidates:
                    m_try = measure_object(
                        pair.depth_mm,
                        mask,
                        contour,
                        belt_distance_mm=belt_mm,
                        fx=fx,
                        fy=fy,
                        cx=cx,
                        cy=cy,
                        background_mm=background,
                        min_object_height_mm=float(cfg.get("min_object_height_mm", 8)),
                        roi_margin=cfg.get("roi_margin"),
                    )
                    if m_try is None or not is_plausible_measurement(m_try):
                        continue
                    # приоритет: круглый и более высокий товар над шумом ленты
                    score = float(m_try.circle_ratio) * 2.0 + min(float(m_try.height_mm), 200.0) / 100.0
                    if best is None or score > best[0]:
                        best = (score, mask, contour, m_try)
                if best is not None:
                    _, mask, contour, measurement = best
                    seg = (mask, contour)
                else:
                    measurement = None

                # depth ничего не видит → плоский товар (телефон) ищем по RGB
                if (
                    measurement is None
                    and bool(cfg.get("detect_flat_rgb", False))
                    and color_background is not None
                    and not pair.color_is_depth_preview
                ):
                    rgb_objs = segment_rgb_objects(
                        pair.color_bgr,
                        color_background,
                        min_area_px=int(cfg.get("min_object_area_px", 800)),
                        diff_threshold=int(cfg.get("rgb_diff_threshold", 35)),
                        max_objects=1,
                        exclude_mask=seg[0] if seg is not None else None,
                    )
                    if rgb_objs:
                        mask, contour = rgb_objs[0]
                        measurement = measure_flat_object(
                            pair.depth_mm,
                            mask,
                            contour,
                            belt_distance_mm=belt_mm,
                            fx=fx,
                            fy=fy,
                            cx=cx,
                            cy=cy,
                            background_mm=background,
                            color_bgr=pair.color_bgr,
                            color_bg_bgr=color_background,
                        )

                if measurement is not None and not is_plausible_measurement(measurement):
                    measurement = None

                decision = stabilizer.update(
                    measurement,
                    min_mm=cls_cfg.get("min_mm", [10, 10, 10]),
                    max_mm=cls_cfg.get("max_mm", [450, 320, 320]),
                )
                if decision.locked and decision.result is not None:
                    result = decision.result
                    zone = result.category.zone
                    if zone != last_routed_zone:
                        tag = "UNCERTAIN→" if decision.uncertain else "LOCK "
                        print(
                            f"[vision] {tag}{zone} | {result.category.ru_label} | "
                            f"dims={result.dims_sorted_mm} | ratio={result.circle_ratio:.3f} | {result.reason}"
                        )
                        append_decision(decisions_log, result, uncertain=decision.uncertain, source="main")
                        bridge.publish_result(result)
                        bridge.route(result.category)
                        last_routed_zone = zone
                elif not decision.present:
                    last_routed_zone = None

            if show_preview or save_debug:
                vis, depth_vis = draw_overlay(pair.color_bgr, pair.depth_mm, measurement, result, belt_mm)
                if save_debug and result is not None and not show_preview:
                    out = debug_dir / f"frame_{frame_i:06d}_{result.category.value}.jpg"
                    cv2.imwrite(str(out), vis)
                # headless OpenCV: пишем JPEG вместо cv2.imshow
                if show_preview and frame_i % preview_every == 0:
                    cv2.imwrite(str(live_color), vis)
                    cv2.imwrite(str(live_depth), depth_vis)

            if args.once:
                if result is not None:
                    print(result)
                if show_preview:
                    vis, depth_vis = draw_overlay(pair.color_bgr, pair.depth_mm, measurement, result, belt_mm)
                    cv2.imwrite(str(live_color), vis)
                    cv2.imwrite(str(live_depth), depth_vis)
                    print(f"[vision] кадр сохранён: {live_color}")
                break

    except KeyboardInterrupt:
        print("\n[vision] stop")
    finally:
        bridge.close()
        cam.release()

    return 0


if __name__ == "__main__":
    # Чтобы импорты работали и как пакет, и как скрипт
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
