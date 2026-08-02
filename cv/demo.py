#!/usr/bin/env python3
"""
Демо-режим хакатона с ползунками в браузере:
  • высота до ленты (belt_distance_mm)
  • порог уверенности (сколько кадров подряд одно и то же решение)
  • мин. высота объекта, порог круга

Без MQTT / мотора / серво.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np
import yaml

from camera import RealSenseV4L2
from classify import Category, ClassificationResult
from demo_hud import ContourSmoother, align_color, build_demo_frame
from journal import append_decision
from measure import (
    is_plausible_measurement,
    measure_flat_object,
    measure_object,
    merge_overlapping_measurements,
    segment_objects,
    segment_rgb_objects,
)
from stabilize import DecisionStabilizer
from tracker import MultiObjectTracker, slot_key

ZONE_TO_CATEGORY = {
    "B": Category.SUITABLE,
    "C": Category.OVERSIZE,
    "D": Category.NEED_PACK,
}


HTML = r"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Трек 3 — демо</title>
<style>
  :root {
    --bg:#111114; --card:#1c1c22; --line:#33333c; --txt:#f2f2f4;
    --muted:#a0a0ab; --acc:#2dd4bf; --b:#22c55e; --c:#ef4444; --d:#f59e0b;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); font-family:system-ui,-apple-system,sans-serif; }
  .top {
    position:sticky; top:0; z-index:20;
    background:var(--card); border-bottom:2px solid var(--acc);
    padding:12px 16px 14px; box-shadow:0 8px 24px rgba(0,0,0,.45);
  }
  .top h1 { margin:0 0 4px; font-size:17px; }
  .top .sub { margin:0 0 12px; color:var(--muted); font-size:12px; }
  .sliders {
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
    gap:12px 18px;
  }
  .sliders label {
    display:flex; justify-content:space-between; align-items:baseline;
    font-size:12px; margin-bottom:4px; color:var(--muted);
  }
  .sliders label b { color:var(--acc); font-size:14px; font-variant-numeric:tabular-nums; }
  input[type=range] { width:100%; height:28px; accent-color:var(--acc); cursor:pointer; }
  .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; align-items:center; }
  button {
    border:0; border-radius:8px; padding:10px 14px; font-weight:700; cursor:pointer;
    background:var(--acc); color:#042f2e;
  }
  button.sec { background:#2a2a32; color:var(--txt); }
  #st {
    flex:1; min-width:200px; padding:10px 12px; border-radius:8px;
    background:#121218; border:1px solid var(--line); font-size:13px; line-height:1.45;
  }
  #st .zoneB { color:var(--b); font-weight:800; font-size:18px; }
  #st .zoneC { color:var(--c); font-weight:800; font-size:18px; }
  #st .zoneD { color:var(--d); font-weight:800; font-size:18px; }
  .main {
    display:flex; gap:12px; padding:12px; max-width:1400px;
    margin:0 auto; align-items:flex-start;
  }
  .stage { flex:1; min-width:0; }
  .stage img {
    width:100%; height:auto; display:block;
    border-radius:10px; border:1px solid var(--line); background:#000;
  }
  .side { width:320px; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
  .side h3 {
    margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em;
    color:var(--muted);
  }
  .card {
    background:var(--card); border:1px solid var(--line); border-radius:10px;
    padding:10px; font-size:13px; line-height:1.5;
  }
  .card img {
    width:100%; height:auto; display:block; border-radius:6px;
    background:#000; margin-bottom:8px;
  }
  .card .hd { font-weight:800; font-size:14px; }
  .card .mut { color:var(--muted); font-size:12px; }
  #feed { display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height:60vh; }
  .fitem {
    display:flex; gap:8px; background:var(--card); border:1px solid var(--line);
    border-radius:10px; padding:8px; font-size:12px; line-height:1.45;
  }
  .fitem img {
    width:86px; height:64px; object-fit:cover; border-radius:6px;
    background:#000; flex-shrink:0;
  }
  .fitem .hd { font-weight:800; font-size:13px; }
  .fitem .mut { color:var(--muted); }
  .zB { color:var(--b); } .zC { color:var(--c); } .zD { color:var(--d); }
  .zU { color:#f97316; }
  @media (max-width:900px) {
    .main { flex-direction:column; }
    .side { width:100%; }
  }
</style>
</head>
<body>
  <div class="top">
    <h1>Трек 3 — демо классификации (B / C / D)</h1>
    <p class="sub">Ползунки СВЕРХУ (отдельная панель). Картинка только камера. Выход: Ctrl+C в терминале. Обновите страницу Ctrl+F5.</p>
    <div class="sliders">
      <div>
        <label>Высота до ленты, мм <b id="v_belt">600</b></label>
        <input id="belt" type="range" min="300" max="2000" step="5" value="600"/>
      </div>
      <div>
        <label>Порог уверенности, % <b id="v_conf">75</b></label>
        <input id="conf" type="range" min="10" max="100" step="5" value="75"/>
      </div>
      <div>
        <label>Мин. высота объекта, мм <b id="v_hmin">8</b></label>
        <input id="hmin" type="range" min="2" max="80" step="1" value="8"/>
      </div>
      <div>
        <label>Порог «круг» <b id="v_circ">0.80</b></label>
        <input id="circ" type="range" min="0.50" max="0.95" step="0.01" value="0.80"/>
      </div>
      <div>
        <label>Мин. площадь, px <b id="v_area">800</b></label>
        <input id="area" type="range" min="100" max="5000" step="50" value="800"/>
      </div>
    </div>
    <div class="actions">
      <div id="st">Загрузка…</div>
      <button type="button" id="auto">Авто-высота</button>
      <button type="button" class="sec" id="reset">Сброс</button>
    </div>
  </div>
  <div class="main">
    <div class="stage">
      <img id="f" src="/frame.jpg?t=0" alt="camera"/>
    </div>
    <aside class="side">
      <h3>Текущий объект</h3>
      <div id="live"><div class="card mut">объектов нет</div></div>
      <h3>Лента</h3>
      <div id="feed"><div class="card mut">пока пусто</div></div>
    </aside>
  </div>
<script>
  const img = document.getElementById('f');
  const ids = ['belt','conf','hmin','circ','area'];
  const defaults = { belt:600, conf:75, hmin:8, circ:0.80, area:800 };
  let dragging = false;

  function syncLabels() {
    v_belt.textContent = belt.value;
    v_conf.textContent = conf.value;
    v_hmin.textContent = hmin.value;
    v_circ.textContent = Number(circ.value).toFixed(2);
    v_area.textContent = area.value;
  }

  async function pushParams() {
    syncLabels();
    await fetch('/api/params', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        belt_mm: Number(belt.value),
        confidence_pct: Number(conf.value),
        min_object_height_mm: Number(hmin.value),
        circle_threshold: Number(circ.value),
        min_area_px: Number(area.value),
      }),
    });
  }

  async function pullStatus() {
    try {
      const s = await (await fetch('/api/status')).json();
      let zoneHtml = '<span style="color:#888">объектов нет</span>';
      if (s.objects && s.objects.length) {
        zoneHtml = s.objects.map(o => {
          const dims = o.dims ? (o.dims.map(x => Math.round(x)).join('×') + ' мм') : '';
          const extra = ' · ' + dims + ' · круг ' + (o.ratio ?? '—');
          if (o.locked && o.uncertain)
            return '<span style="color:#f97316;font-weight:800">#' + o.id + ' НЕУВЕРЕННО → ' + o.label + '</span>' + extra;
          if (o.locked)
            return '<span class="zone' + o.zone + '">#' + o.id + ' ' + o.label + ' ✓</span>' + extra;
          return '<span style="color:#38bdf8">#' + o.id + ' анализ… ' + o.conf + '%</span>' + extra;
        }).join('<br/>');
      }
      const stt = s.stats || {};
      const statsLine = 'Итого: <b style="color:#22c55e">ГОТОВ ' + (stt.B || 0) +
        '</b> · <b style="color:#ef4444">НЕГАБАРИТ ' + (stt.C || 0) +
        '</b> · <b style="color:#f59e0b">ДОУПАКОВКА ' + (stt.D || 0) + '</b>' +
        (stt.uncertain ? ' · неуверенно ' + stt.uncertain : '');
      st.innerHTML = zoneHtml + '<br/>' + statsLine + '<br/>высота <b>' + s.belt_mm + '</b> мм';
      renderLive(s.objects || []);
      if (s.feed_seq !== window.__feedSeq) {
        window.__feedSeq = s.feed_seq;
        refreshFeed(s.feed || null);
      }
      if (!window.__inited && !dragging) {
        belt.value = s.belt_mm;
        conf.value = s.confidence_pct;
        hmin.value = s.min_object_height_mm;
        circ.value = s.circle_threshold;
        area.value = s.min_area_px;
        syncLabels();
        window.__inited = true;
      }
    } catch (e) { st.textContent = 'Нет связи с demo.py — перезапустите ./demo.sh'; }
  }

  function zcls(o) {
    if (o.uncertain) return 'zU';
    return o.zone ? ('z' + o.zone) : '';
  }
  function dimsStr(d) {
    return d ? d.map(x => Math.round(x)).join('×') + ' мм' : '';
  }

  function objSig(o) {
    return o.id + '|' + (o.locked ? 'L' : 'P') + '|' + o.conf + '|' + (o.zone || '') +
      '|' + (o.label || '') + '|' + (o.dims || []).map(x => Math.round(x)).join(',');
  }

  function renderLive(objs) {
    const box = document.getElementById('live');
    const sig = objs.map(objSig).join(';');
    if (sig === window.__liveSig) return;
    window.__liveSig = sig;
    if (!objs.length) {
      box.innerHTML = '<div class="card mut">объектов нет</div>';
      return;
    }
    box.innerHTML = objs.map(o => {
      const img = (o.locked && o.crop) ? '<img src="data:image/jpeg;base64,' + o.crop + '"/>' : '';
      const head = o.locked
        ? '<span class="hd ' + zcls(o) + '">#' + o.id + ' ' + (o.uncertain ? 'НЕУВЕРЕННО → ' : '') + o.label + (o.zone ? ' · зона ' + o.zone : '') + '</span>'
        : '<span class="hd" style="color:#38bdf8">#' + o.id + ' анализ… ' + o.conf + '%</span>';
      const reason = o.reason ? '<div class="mut">' + o.reason + '</div>' : '';
      return '<div class="card">' + img + head +
        '<div>' + dimsStr(o.dims) + ' · круг ' + (o.ratio ?? '—') + '</div>' + reason + '</div>';
    }).join('');
  }

  function refreshFeed(items) {
    const box = document.getElementById('feed');
    if (!window.__feedKeys) window.__feedKeys = new Set();
    if (!items || !items.length) {
      if (!window.__feedKeys.size) box.innerHTML = '<div class="card mut">пока пусто</div>';
      return;
    }
    if (window.__feedKeys.size === 0) box.innerHTML = '';
    for (const it of items.slice().reverse()) {
      const key = it.slot || ('#' + it.id);
      if (window.__feedKeys.has(key)) continue;
      window.__feedKeys.add(key);
      const img = it.crop ? '<img src="data:image/jpeg;base64,' + it.crop + '"/>' : '<img/>';
      const el = document.createElement('div');
      el.className = 'fitem';
      el.dataset.slot = key;
      el.innerHTML = img + '<div>' +
        '<div class="hd ' + zcls(it) + '">#' + it.id + ' ' + (it.uncertain ? 'НЕУВЕР → ' : '') + 'зона ' + it.zone + '</div>' +
        '<div>' + it.label + '</div>' +
        '<div class="mut">' + dimsStr(it.dims) + ' · круг ' + it.ratio + ' · ' + it.time + '</div>' +
        '</div>';
      box.insertBefore(el, box.firstChild);
    }
  }

  ids.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', () => { dragging = true; });
    el.addEventListener('pointerup', () => { dragging = false; pushParams(); });
    el.addEventListener('input', () => { syncLabels(); pushParams(); });
  });

  document.getElementById('auto').onclick = async () => {
    st.textContent = 'Калибровка… уберите объекты с ленты';
    const s = await (await fetch('/api/autocalib', {method:'POST'})).json();
    if (s.ok) {
      belt.value = Math.round(s.belt_mm);
      syncLabels();
      await pushParams();
    } else st.textContent = 'Ошибка: ' + (s.error || '');
  };
  document.getElementById('reset').onclick = () => {
    belt.value = defaults.belt; conf.value = defaults.conf;
    hmin.value = defaults.hmin; circ.value = defaults.circ; area.value = defaults.area;
    syncLabels(); pushParams();
  };

  setInterval(() => { img.src = '/frame.jpg?t=' + Date.now(); }, 280);
  setInterval(pullStatus, 350);
  pullStatus();
</script>
</body>
</html>
"""


class Params:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.belt_mm: float = 800.0
        self.confidence_pct: int = 75  # порог фиксации
        self.min_object_height_mm: float = 8.0
        self.circle_threshold: float = 0.80
        self.min_area_px: int = 400
        # runtime status
        self.confidence_now: int = 0
        self.zone: Optional[str] = None
        self.locked: bool = False
        self.uncertain: bool = False
        self.circle_ratio: Optional[float] = None
        self.dims: Optional[tuple] = None
        self.reason: str = ""
        self.objects: list = []       # [{id, zone, label, dims, ratio, locked, uncertain, conf, crop}]
        self.stats: dict = {}         # счётчики за сессию
        self.feed: list = []          # лента LOCK-событий (новые в конце)
        self.feed_seq: int = 0        # версия ленты — клиент тянет только при изменении
        self.feed_slots: set = set()  # slot_key — один товар = одна карточка в ленте
        self.crop_cache: dict = {}    # track_id → base64, фиксируется при LOCK
        self.jpeg: bytes = b""
        self.last_print: str = ""
        self.cam: Any = None
        self.request_autocalib: bool = False
        self.autocalib_result: Optional[Dict[str, Any]] = None
        self.background: Optional[np.ndarray] = None  # карта глубины пустой сцены
        self.color_background: Optional[np.ndarray] = None  # RGB пустой сцены (плоские товары)


STATE = Params()


def make_handler() -> type:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            return

        def _json(self, code: int, obj: Dict[str, Any]) -> None:
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path.startswith("/frame.jpg"):
                with STATE.lock:
                    data = STATE.jpeg
                if not data:
                    self.send_error(503, "no frame yet")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif path == "/api/status":
                with STATE.lock:
                    self._json(
                        200,
                        {
                            "belt_mm": round(STATE.belt_mm),
                            "confidence_pct": STATE.confidence_pct,
                            "confidence_now": STATE.confidence_now,
                            "min_object_height_mm": STATE.min_object_height_mm,
                            "circle_threshold": STATE.circle_threshold,
                            "min_area_px": STATE.min_area_px,
                            "zone": STATE.zone,
                            "locked": STATE.locked,
                            "uncertain": STATE.uncertain,
                            "circle_ratio": STATE.circle_ratio,
                            "dims": STATE.dims,
                            "reason": STATE.reason,
                            "objects": STATE.objects,
                            "stats": STATE.stats,
                            "feed_seq": STATE.feed_seq,
                            "feed": STATE.feed,
                        },
                    )
            elif path == "/api/feed":
                with STATE.lock:
                    self._json(200, {"seq": STATE.feed_seq, "items": STATE.feed})
            else:
                body = HTML.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        def do_POST(self) -> None:
            path = urlparse(self.path).path
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}

            if path == "/api/params":
                with STATE.lock:
                    if "belt_mm" in data:
                        new_belt = float(np.clip(float(data["belt_mm"]), 200, 3000))
                        # ручная правка высоты → фоновая карта устарела
                        if abs(new_belt - STATE.belt_mm) > 2.0:
                            STATE.background = None
                        STATE.belt_mm = new_belt
                    if "confidence_pct" in data:
                        STATE.confidence_pct = int(np.clip(int(data["confidence_pct"]), 10, 100))
                    if "min_object_height_mm" in data:
                        STATE.min_object_height_mm = float(np.clip(float(data["min_object_height_mm"]), 1, 200))
                    if "circle_threshold" in data:
                        STATE.circle_threshold = float(np.clip(float(data["circle_threshold"]), 0.4, 0.99))
                    if "min_area_px" in data:
                        STATE.min_area_px = int(np.clip(int(data["min_area_px"]), 50, 20000))
                self._json(200, {"ok": True})
            elif path == "/api/autocalib":
                with STATE.lock:
                    STATE.request_autocalib = True
                    STATE.autocalib_result = None
                # ждём результат от цикла камеры
                for _ in range(80):
                    time.sleep(0.1)
                    with STATE.lock:
                        if STATE.autocalib_result is not None:
                            self._json(200, STATE.autocalib_result)
                            return
                self._json(500, {"ok": False, "error": "timeout"})
            else:
                self.send_error(404)

    return Handler


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


def frames_needed(confidence_pct: int) -> int:
    # 10% → 5, 100% → 12 кадров одной зоны после прогрева окна
    return max(5, int(round(5 + (confidence_pct / 100.0) * 7)))


def crop_b64(img: np.ndarray, contour: np.ndarray, pad: int = 14, max_w: int = 260) -> Optional[str]:
    """Кроп объекта по bounding box контура → JPEG base64 для веб-панели."""
    x, y, w, h = cv2.boundingRect(contour)
    H, W = img.shape[:2]
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(W, x + w + pad), min(H, y + h + pad)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    crop = img[y0:y1, x0:x1]
    if crop.shape[1] > max_w:
        s = max_w / crop.shape[1]
        crop = cv2.resize(crop, (max_w, max(1, int(crop.shape[0] * s))))
    ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    return base64.b64encode(buf.tobytes()).decode("ascii") if ok else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Демо классификации с ползунками")
    parser.add_argument("-c", "--config", default=str(Path(__file__).with_name("config.yaml")))
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    cam_cfg = cfg["camera"]
    cls_cfg = cfg["classification"]
    min_mm = cls_cfg.get("min_mm", [10, 10, 10])
    max_mm = cls_cfg.get("max_mm", [450, 320, 320])

    out_dir = Path(cfg.get("runtime", {}).get("debug_dir", "debug_frames"))
    out_dir.mkdir(parents=True, exist_ok=True)
    out_jpg = out_dir / "demo_live.jpg"

    print("[demo] открываю RealSense D415…")
    cam = RealSenseV4L2(
        depth_device=cam_cfg.get("depth_device", "/dev/video0"),
        color_device=cam_cfg.get("color_device", "/dev/video4"),
        width=int(cam_cfg.get("width", 640)),
        height=int(cam_cfg.get("height", 480)),
        fps=int(cam_cfg.get("fps", 30)),
        depth_scale_mm=float(cam_cfg.get("depth_scale_mm", 1.0)),
        use_color=bool(cfg.get("use_color", False)),
    )
    STATE.cam = cam

    belt0 = float(cfg.get("belt_distance_mm") or 0)
    if belt0 <= 0:
        print("[demo] калибровка ленты — уберите объекты…")
        belt0 = cam.estimate_belt_distance_mm()
    with STATE.lock:
        STATE.belt_mm = belt0
        STATE.circle_threshold = float(cls_cfg.get("circle_ratio_threshold", 0.8))
        STATE.min_object_height_mm = float(cfg.get("min_object_height_mm", 8))
        STATE.min_area_px = int(cfg.get("min_object_area_px", 400))
        STATE.confidence_pct = 75
    print(f"[demo] belt_distance_mm = {belt0:.0f}")
    max_objects = int(cfg.get("max_objects_in_frame", 3))
    detect_flat_rgb = bool(cfg.get("detect_flat_rgb", False))
    print(f"[demo] max_objects={max_objects}, flat_rgb={'ON' if detect_flat_rgb else 'OFF'}")
    print("[demo] фоновая карта: кнопка «Авто-высота» на пустой ленте")

    server = ThreadingHTTPServer((args.host, args.port), make_handler())
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"[demo] браузер → http://127.0.0.1:{args.port}/")
    print("[demo] ползунки СВЕРХУ страницы (не на картинке)")
    print("[demo] зона только после LOCK (медиана 12 кадров + голосование)")
    print("[demo] Ctrl+C — выход\n")

    fx, fy = float(cam_cfg["fx"]), float(cam_cfg["fy"])
    cx, cy = float(cam_cfg["cx"]), float(cam_cfg["cy"])
    fallback_zone = str(cls_cfg.get("uncertain_fallback_zone", "C")).upper()
    thr0 = float(cls_cfg.get("circle_ratio_threshold", 0.8))
    settings = {"confirm": frames_needed(75), "circ": thr0}

    def make_stabilizer() -> DecisionStabilizer:
        return DecisionStabilizer(
            window=12,
            confirm_frames=settings["confirm"],
            lost_frames=12,
            enter_circle=settings["circ"],
            exit_circle=settings["circ"] - 0.08,
            uncertain_after=int(cls_cfg.get("uncertain_after_frames", 45)),
            fallback=ZONE_TO_CATEGORY.get(fallback_zone, Category.OVERSIZE),
        )

    # lost_frames=30 ≈ 1.5–2 с: глянцевые/тёмные предметы (мышка) дают
    # кратковременные выпадения depth — трек не должен умирать от них
    tracker = MultiObjectTracker(make_stabilizer, max_dist_px=120, lost_frames=30)
    contour_smoother = ContourSmoother(alpha=0.3)
    color_align = (
        float(cam_cfg.get("color_dx", 0.0)),
        float(cam_cfg.get("color_dy", 0.0)),
        float(cam_cfg.get("color_scale", 1.0)),
    )
    decisions_log = Path(cfg.get("runtime", {}).get("decisions_log", "logs/decisions.jsonl"))
    frame_i = 0
    last_conf_setting = 75
    last_circ = thr0

    try:
        while True:
            # автокалибровка по запросу из UI
            with STATE.lock:
                need_auto = STATE.request_autocalib
                if need_auto:
                    STATE.request_autocalib = False
            if need_auto:
                try:
                    print("[demo] автокалибровка: снимаю фоновую карту (сцена должна быть пустой)…")
                    bg = cam.capture_background(samples=15)
                    color_bg = cam.capture_background_rgb(samples=10)
                    h, w = bg.shape
                    center = bg[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4].astype(np.float32)
                    center = center[(center > 200) & (center < 4000)]
                    new_belt = float(np.median(center)) if center.size > 100 else cam.estimate_belt_distance_mm(samples=10)
                    with STATE.lock:
                        STATE.belt_mm = new_belt
                        STATE.background = bg
                        STATE.color_background = color_bg
                        STATE.autocalib_result = {"ok": True, "belt_mm": new_belt}
                    tracker.reset()
                    rgb_tag = "RGB-фон есть" if color_bg is not None else "RGB-фон недоступен"
                    print(f"[demo] высота = {new_belt:.0f} mm, фоновая карта активна, {rgb_tag}")
                except Exception as exc:
                    with STATE.lock:
                        STATE.autocalib_result = {"ok": False, "error": str(exc)}

            pair = cam.read()
            if pair is None:
                time.sleep(0.02)
                continue
            frame_i += 1

            with STATE.lock:
                belt_mm = STATE.belt_mm
                conf_pct = STATE.confidence_pct
                hmin = STATE.min_object_height_mm
                circ_thr = STATE.circle_threshold
                min_area = STATE.min_area_px
                background = STATE.background
                color_background = STATE.color_background

            if conf_pct != last_conf_setting:
                settings["confirm"] = frames_needed(conf_pct)
                tracker.reset()
                last_conf_setting = conf_pct
            if abs(circ_thr - last_circ) > 1e-6:
                settings["circ"] = float(circ_thr)
                tracker.reset()
                last_circ = circ_thr

            # несколько объектов в кадре → трекер с ID
            measurements = []
            depth_union = None
            seg_n = 0
            for mask, contour in segment_objects(
                pair.depth_mm,
                belt_distance_mm=belt_mm,
                belt_tolerance_mm=float(cfg.get("belt_tolerance_mm", 25)),
                min_object_height_mm=hmin,
                min_area_px=min_area,
                background_mm=background,
                max_objects=max_objects,
            ):
                seg_n += 1
                depth_union = mask if depth_union is None else cv2.bitwise_or(depth_union, mask)
                m = measure_object(
                    pair.depth_mm,
                    mask,
                    contour,
                    belt_distance_mm=belt_mm,
                    fx=fx,
                    fy=fy,
                    cx=cx,
                    cy=cy,
                    background_mm=background,
                    min_object_height_mm=hmin,
                )
                if m is not None and is_plausible_measurement(m):
                    measurements.append(m)

            # плоские товары — только если detect_flat_rgb: true (иначе тени → ложные C)
            if (
                detect_flat_rgb
                and color_background is not None
                and not pair.color_is_depth_preview
            ):
                for mask, contour in segment_rgb_objects(
                    pair.color_bgr,
                    color_background,
                    min_area_px=min_area,
                    diff_threshold=int(cfg.get("rgb_diff_threshold", 35)),
                    max_objects=max(0, max_objects - len(measurements)),
                    exclude_mask=depth_union,
                ):
                    m = measure_flat_object(
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
                    if m is not None and is_plausible_measurement(m):
                        measurements.append(m)

            measurements = merge_overlapping_measurements(measurements, overlap_thr=0.5)
            tracks, events = tracker.update(measurements, min_mm=min_mm, max_mm=max_mm)

            rgb_available = not pair.color_is_depth_preview
            if rgb_available and float(np.std(pair.color_bgr)) > 4.0:
                base_img = pair.color_bgr
                if base_img.shape[:2] != pair.depth_mm.shape[:2]:
                    base_img = cv2.resize(base_img, (pair.depth_mm.shape[1], pair.depth_mm.shape[0]))
                base_img = align_color(base_img, *color_align)
            else:
                # без живого RGB — colorize(depth), иначе веб был бы чёрным
                from camera import depth_colormap
                base_img = depth_colormap(pair.depth_mm)
                rgb_available = False

            crops: Dict[int, Optional[str]] = {}
            for tr in tracks:
                if tr.measurement is not None:
                    crops[tr.track_id] = crop_b64(base_img, tr.measurement.contour)

            crop_updates: Dict[int, str] = {}
            feed_add = []
            for ev in events:
                r = ev.decision.result
                tag = "UNCERTAIN→" if ev.decision.uncertain else "LOCK "
                print(
                    f"[demo] #{ev.track_id} {tag}{r.category.zone} | {r.category.short_label} | "
                    f"LWH={tuple(round(x, 1) for x in r.dims_sorted_mm)} | circle={r.circle_ratio:.3f}"
                )
                append_decision(
                    decisions_log, r,
                    uncertain=ev.decision.uncertain, source="demo", track_id=ev.track_id,
                )
                L, W, H = r.dims_sorted_mm
                tr_ev = next((t for t in tracks if t.track_id == ev.track_id), None)
                cx, cy = (tr_ev.centroid if tr_ev else (0, 0))
                sk = slot_key(cx, cy, L, W, H, r.category.zone)
                crop = crops.get(ev.track_id)
                if crop:
                    crop_updates[ev.track_id] = crop
                feed_add.append({
                    "slot": sk,
                    "id": ev.track_id,
                    "time": time.strftime("%H:%M:%S"),
                    "zone": r.category.zone,
                    "label": r.category.short_label,
                    "dims": [round(x, 1) for x in r.dims_sorted_mm],
                    "ratio": round(r.circle_ratio, 3),
                    "uncertain": bool(ev.decision.uncertain),
                    "crop": crop,
                })

            with STATE.lock:
                STATE.crop_cache.update(crop_updates)
                crop_cache = dict(STATE.crop_cache)

            # статус для веба: список объектов + «главный» (первый залоченный)
            objects_json = []
            primary = None
            for tr in tracks:
                d = tr.decision
                m = tr.measurement
                if d is None or m is None:
                    continue
                is_locked = bool(d.locked and d.result is not None)
                if is_locked:
                    obj = {
                        "id": tr.track_id,
                        "locked": True,
                        "uncertain": bool(d.uncertain),
                        "conf": 100,
                        "zone": d.result.category.zone,
                        "label": d.result.category.short_label,
                        "dims": [round(x, 1) for x in d.result.dims_sorted_mm],
                        "ratio": round(d.result.circle_ratio, 3),
                        "reason": d.result.reason,
                        "crop": crop_cache.get(tr.track_id),
                    }
                else:
                    obj = {
                        "id": tr.track_id,
                        "locked": False,
                        "uncertain": False,
                        "conf": d.confidence_pct,
                        "zone": None,
                        "label": "анализ…",
                        "dims": [round(m.length_mm, 1), round(m.width_mm, 1), round(m.height_mm, 1)],
                        "ratio": round(m.circle_ratio, 3),
                        "reason": "",
                        "crop": None,
                    }
                objects_json.append(obj)
                if primary is None or (obj["locked"] and not primary["locked"]):
                    primary = obj

            with STATE.lock:
                STATE.objects = objects_json
                STATE.stats = dict(tracker.stats)
                if feed_add:
                    fresh = [it for it in feed_add if it["slot"] not in STATE.feed_slots]
                    for it in fresh:
                        STATE.feed_slots.add(it["slot"])
                    if fresh:
                        STATE.feed.extend(fresh)
                        STATE.feed = STATE.feed[-20:]
                        STATE.feed_seq += 1
                if primary is not None:
                    STATE.confidence_now = primary["conf"]
                    STATE.locked = primary["locked"]
                    STATE.uncertain = primary["uncertain"]
                    STATE.zone = primary["zone"]
                    STATE.circle_ratio = primary["ratio"]
                    STATE.dims = tuple(primary["dims"])
                    STATE.reason = primary["reason"] or (
                        f"накопление {primary['conf']}% → ждём LOCK" if not primary["locked"] else ""
                    )
                else:
                    STATE.confidence_now = 0
                    STATE.locked = False
                    STATE.uncertain = False
                    STATE.zone = None
                    STATE.circle_ratio = None
                    STATE.dims = None
                    STATE.reason = ""

            hud = build_demo_frame(
                base_img,
                pair.depth_mm,
                tracks,
                belt_mm,
                stats=tracker.stats,
                confidence_pct=conf_pct,
                rgb_available=rgb_available,
                background_active=background is not None,
                color_align=(0.0, 0.0, 1.0),
                contour_smoother=contour_smoother,
            )
            ok, buf = cv2.imencode(".jpg", hud, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ok:
                jpeg = buf.tobytes()
                with STATE.lock:
                    STATE.jpeg = jpeg
                if frame_i % 3 == 0:
                    out_jpg.write_bytes(jpeg)

            if seg_n > len(measurements) and STATE.last_print != "seg_drop":
                print(f"[demo] depth: контуров {seg_n}, измерено {len(measurements)} "
                      f"(часть отфильтрована: низкая высота < {hmin:.0f} мм или шум)")
                STATE.last_print = "seg_drop"
            elif not tracks and STATE.last_print != "empty":
                print("[demo] объектов нет")
                STATE.last_print = "empty"
            elif tracks and STATE.last_print in ("seg_drop", "empty"):
                STATE.last_print = ""

            time.sleep(0.03)
    except KeyboardInterrupt:
        print("\n[demo] stop")
    finally:
        server.shutdown()
        cam.release()
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
