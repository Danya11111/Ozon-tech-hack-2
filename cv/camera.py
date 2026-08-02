"""Захват Depth (+опционально Color) с Intel RealSense D415 через V4L2/ffmpeg.

Классификация по ТЗ опирается на depth (габариты + круг в сечении).
RGB у D415 через сырой V4L2 часто пустой без librealsense —
тогда для превью используется colorize(depth).
"""

from __future__ import annotations

import shutil
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Optional, Union

import cv2
import numpy as np


@dataclass
class FramePair:
    color_bgr: np.ndarray
    depth_mm: np.ndarray  # uint16, миллиметры
    timestamp_ms: float
    color_is_depth_preview: bool = False


def _device_path(device: Union[str, int]) -> str:
    if isinstance(device, int) or str(device).isdigit():
        return f"/dev/video{int(device)}"
    return str(device)


def _v4l2_index(device: Union[str, int]) -> int:
    if isinstance(device, int):
        return device
    s = str(device).strip()
    if s.isdigit():
        return int(s)
    if "video" in s:
        return int(s.rsplit("video", 1)[-1])
    raise ValueError(f"Некорректный V4L2 device: {device}")


def find_realsense_color_device(preferred: Union[str, int, None] = None) -> Optional[str]:
    """Найти RGB-ноду D415 (YUYV). Номера /dev/videoN плавают после переподключения."""
    import glob
    import os

    def _formats(path: str) -> str:
        try:
            return subprocess.check_output(
                ["v4l2-ctl", "-d", path, "--list-formats-ext"],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=2,
            )
        except (OSError, subprocess.SubprocessError):
            return ""

    preferred_path = _device_path(preferred) if preferred is not None else ""
    scored: list[tuple[int, str]] = []
    for path in sorted(glob.glob("/dev/video*")):
        if not os.path.exists(path):
            continue
        fmt = _formats(path)
        if "Z16" in fmt or "'GREY'" in fmt or "Greyscale" in fmt:
            continue
        score = 2 if ("YUYV" in fmt or "MJPG" in fmt or "Motion-JPEG" in fmt) else 0
        if path == preferred_path:
            score += 5
        scored.append((score, path))
    scored.sort(key=lambda x: (-x[0], x[1]))

    for _, path in scored:
        try:
            idx = _v4l2_index(path)
        except ValueError:
            continue
        cap = cv2.VideoCapture(idx, cv2.CAP_V4L2)
        if not cap.isOpened():
            continue
        ok_frame = None
        for _ in range(12):
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            if frame.ndim == 2:
                break
            if frame.ndim == 3 and frame.shape[2] == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_YUV2BGR_YUY2)
            if frame.ndim == 3 and float(np.mean(frame)) > 8.0 and float(np.std(frame)) > 5.0:
                ok_frame = frame
                break
        cap.release()
        if ok_frame is not None:
            return path
    return None


def fill_depth_holes(depth_mm: np.ndarray, ksize: int = 5) -> np.ndarray:
    """Простое заполнение дыр в depth."""
    d = depth_mm.copy()
    mask = (d > 0).astype(np.uint8) * 255
    if mask.mean() < 1:
        return d
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    holes = ((closed > 0) & (d == 0)).astype(np.uint8) * 255
    if holes.any():
        scale = max(float(d.max()), 1.0)
        img8 = np.clip(d.astype(np.float32) / scale * 255.0, 0, 255).astype(np.uint8)
        filled8 = cv2.inpaint(img8, holes, 3, cv2.INPAINT_TELEA)
        filled = (filled8.astype(np.float32) / 255.0 * scale).astype(np.uint16)
        d[holes > 0] = filled[holes > 0]
    med = cv2.medianBlur(d, 3)
    valid = d > 0
    d[valid] = med[valid]
    return d


def depth_colormap(depth_mm: np.ndarray, max_mm: Optional[int] = None) -> np.ndarray:
    valid = depth_mm[(depth_mm > 0) & (depth_mm < 10000)]
    if max_mm is None:
        max_mm = int(np.percentile(valid, 95)) if valid.size else 2000
        max_mm = max(max_mm, 500)
    clipped = np.clip(depth_mm.astype(np.float32), 0, max_mm)
    norm = np.zeros_like(clipped, dtype=np.uint8)
    mask = depth_mm > 0
    norm[mask] = (clipped[mask] / max_mm * 255.0).astype(np.uint8)
    return cv2.applyColorMap(norm, cv2.COLORMAP_JET)


class RealSenseV4L2:
    """D415: depth=/dev/video0 (Z16 gray16le). Color опционален."""

    def __init__(
        self,
        depth_device: Union[str, int] = "/dev/video0",
        color_device: Union[str, int] = "/dev/video4",
        width: int = 640,
        height: int = 480,
        fps: int = 30,
        depth_scale_mm: float = 1.0,
        use_color: bool = True,
    ) -> None:
        if shutil.which("ffmpeg") is None:
            raise RuntimeError("Нужен ffmpeg для чтения depth Z16 с RealSense")

        self.depth_scale_mm = float(depth_scale_mm)
        self.width = int(width)
        self.height = int(height)
        self.fps = int(fps)
        self.use_color = bool(use_color)
        self._frame_bytes = self.width * self.height * 2
        self.color_cap = None
        self._depth_path = _device_path(depth_device)
        self._lock = threading.Lock()
        self._latest: Optional[np.ndarray] = None
        self._stop = threading.Event()
        self._ff: Optional[subprocess.Popen] = None
        self._thread: Optional[threading.Thread] = None

        self._start_depth_worker()

        if self.use_color:
            found = find_realsense_color_device(color_device)
            if found is None:
                print(f"[camera] RGB не найден (искали {color_device}) — в вебе будет colorize(depth)")
                self.color_cap = None
            else:
                if _device_path(found) != _device_path(color_device):
                    print(f"[camera] RGB: {found} (в конфиге было {color_device})")
                else:
                    print(f"[camera] RGB: {found}")
                color_idx = _v4l2_index(found)
                self.color_cap = cv2.VideoCapture(color_idx, cv2.CAP_V4L2)
                if self.color_cap.isOpened():
                    self.color_cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                    self.color_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                    self.color_cap.set(cv2.CAP_PROP_FPS, self.fps)
                    self.color_cap.set(cv2.CAP_PROP_CONVERT_RGB, 1)
                    # прогрев автоэкспозиции — иначе первые кадры чёрные/зелёные
                    for _ in range(20):
                        self.color_cap.read()
                else:
                    print("[camera] RGB VideoCapture не открылся")
                    self.color_cap = None

        # Ждём первый кадр
        deadline = time.time() + 5.0
        while time.time() < deadline:
            with self._lock:
                if self._latest is not None:
                    break
            time.sleep(0.05)
        else:
            self.release()
            raise RuntimeError(
                f"Не удалось читать depth с {self._depth_path}. "
                "Проверьте USB3, что камера не занята другим процессом."
            )

        valid_pct = float(((self._latest > 0) & (self._latest < 5000)).mean() * 100)
        print(f"[camera] depth OK, valid≈{valid_pct:.1f}% (лучше >30%; высота камеры 0.5–1.5 м)")

    def _start_depth_worker(self) -> None:
        self._ff = subprocess.Popen(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-fflags",
                "nobuffer",
                "-flags",
                "low_delay",
                "-f",
                "v4l2",
                "-video_size",
                f"{self.width}x{self.height}",
                "-framerate",
                str(self.fps),
                "-pixel_format",
                "gray16le",
                "-i",
                self._depth_path,
                "-f",
                "rawvideo",
                "-pix_fmt",
                "gray16le",
                "-",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=self._frame_bytes * 8,
        )
        self._thread = threading.Thread(target=self._depth_loop, name="rs-depth", daemon=True)
        self._thread.start()

    def _depth_loop(self) -> None:
        assert self._ff is not None and self._ff.stdout is not None
        while not self._stop.is_set():
            raw = self._ff.stdout.read(self._frame_bytes)
            if not raw or len(raw) != self._frame_bytes:
                if self._ff.poll() is not None:
                    break
                continue
            depth = np.frombuffer(raw, dtype="<u2").reshape(self.height, self.width).copy()
            depth[depth == 65535] = 0
            if self.depth_scale_mm != 1.0:
                depth = np.clip(depth.astype(np.float32) * self.depth_scale_mm, 0, 65535).astype(np.uint16)
            depth = fill_depth_holes(depth)
            with self._lock:
                self._latest = depth

    def _read_color(self, depth_mm: np.ndarray) -> tuple[np.ndarray, bool]:
        if self.color_cap is not None:
            ok, color = self.color_cap.read()
            if ok and color is not None:
                if color.shape[:2] != (self.height, self.width):
                    color = cv2.resize(color, (self.width, self.height), interpolation=cv2.INTER_LINEAR)
                if color.ndim == 3 and color.shape[2] == 2:
                    color = cv2.cvtColor(color, cv2.COLOR_YUV2BGR_YUY2)
                elif color.ndim == 2:
                    color = cv2.cvtColor(color, cv2.COLOR_GRAY2BGR)
                # пустой YUYV-кадр после конвертации — ровный зелёный (mean>5,
                # но вариации нет) → проверяем и разброс пикселей
                if float(np.mean(color)) > 5.0 and float(np.std(color)) > 4.0:
                    return color, False
        return depth_colormap(depth_mm), True

    def read(self) -> Optional[FramePair]:
        with self._lock:
            depth = None if self._latest is None else self._latest.copy()
        if depth is None:
            return None
        color, is_preview = self._read_color(depth)
        return FramePair(
            color_bgr=color,
            depth_mm=depth,
            timestamp_ms=time.time() * 1000.0,
            color_is_depth_preview=is_preview,
        )

    def capture_background(self, samples: int = 15) -> np.ndarray:
        """Медианная карта глубины пустой сцены (лента + платформы/борта).

        Позволяет сегментировать товар на неровном фоне и не сливать его
        с накопителем: объект = то, что ближе фона на min_object_height_mm.
        """
        frames = []
        deadline = time.time() + 12.0
        while len(frames) < samples and time.time() < deadline:
            pair = self.read()
            if pair is not None:
                frames.append(pair.depth_mm.astype(np.float32))
            time.sleep(0.04)
        if len(frames) < max(3, samples // 3):
            raise RuntimeError("Не удалось накопить кадры для фоновой карты")
        stack = np.stack(frames)
        stack[stack <= 0] = np.nan
        bg = np.nanmedian(stack, axis=0)
        return np.nan_to_num(bg, nan=0.0).astype(np.uint16)

    def capture_background_rgb(self, samples: int = 10) -> Optional[np.ndarray]:
        """Усреднённый RGB-кадр пустой сцены — для детекции плоских товаров
        (телефон и т.п.), которые не видны в depth."""
        frames = []
        deadline = time.time() + 8.0
        while len(frames) < samples and time.time() < deadline:
            pair = self.read()
            if pair is not None and not pair.color_is_depth_preview:
                frames.append(pair.color_bgr.astype(np.float32))
            time.sleep(0.04)
        if len(frames) < 3:
            return None
        return np.clip(np.mean(np.stack(frames), axis=0), 0, 255).astype(np.uint8)

    def estimate_belt_distance_mm(self, samples: int = 30) -> float:
        vals = []
        h, w = self.height, self.width
        rois = [
            (h // 2 - 40, h // 2 + 40, w // 2 - 60, w // 2 + 60),
            (h // 3 - 30, h // 3 + 30, w // 3 - 40, w // 3 + 40),
            (2 * h // 3 - 30, 2 * h // 3 + 30, 2 * w // 3 - 40, 2 * w // 3 + 40),
            (h // 4, 3 * h // 4, w // 4, 3 * w // 4),
        ]
        for _ in range(samples):
            pair = self.read()
            if pair is None:
                time.sleep(0.03)
                continue
            for y0, y1, x0, x1 in rois:
                roi = pair.depth_mm[y0:y1, x0:x1]
                valid = roi[(roi > 200) & (roi < 4000)]
                if valid.size >= 50:
                    vals.append(float(np.median(valid)))
                    break
            else:
                valid = pair.depth_mm[(pair.depth_mm > 200) & (pair.depth_mm < 4000)]
                if valid.size >= 50:
                    vals.append(float(np.median(valid)))
            time.sleep(0.03)
        if not vals:
            raise RuntimeError(
                "Не удалось оценить belt_distance_mm. "
                "Поставьте камеру на 0.5–1.5 м над лентой (USB3), задайте belt_distance_mm в config.yaml вручную."
            )
        return float(np.median(vals))

    def release(self) -> None:
        self._stop.set()
        if self.color_cap is not None:
            self.color_cap.release()
            self.color_cap = None
        if self._ff is not None and self._ff.poll() is None:
            self._ff.terminate()
            try:
                self._ff.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._ff.kill()
            self._ff = None
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    def __enter__(self) -> "RealSenseV4L2":
        return self

    def __exit__(self, *args) -> None:
        self.release()
