"""MQTT: публикация категории + команды серво/мотору (существующий API Arduino)."""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt

from classify import Category, ClassificationResult


class MqttBridge:
    def __init__(self, cfg: Dict[str, Any]) -> None:
        self.cfg = cfg
        self.enabled = bool(cfg.get("enabled", False))
        self.routing_cfg = cfg.get("_routing", {})
        self.motor_cfg = cfg.get("_motor", {})
        self._last_route_ts = 0.0
        self._last_category: Optional[str] = None

        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=cfg.get("client_id", "vision_classifier_opi"),
        )
        user = cfg.get("user")
        password = cfg.get("password")
        if user:
            self.client.username_pw_set(user, password)

        self._connected = False
        if self.enabled:
            try:
                self.client.connect(cfg["broker"], int(cfg.get("port", 1883)), 30)
                self.client.loop_start()
                # короткая проверка
                time.sleep(0.3)
                self._connected = True
                print(f"[mqtt] подключено к {cfg['broker']}:{cfg.get('port', 1883)}")
            except Exception as exc:
                print(f"[mqtt] не удалось подключиться: {exc}")
                self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    def start_conveyor(self) -> None:
        """Включить шаговик ленты через уже существующие топики motor/control/*."""
        m = self.motor_cfg
        if not m.get("enabled", False):
            return
        if not self.enabled or not self._connected:
            return
        rpm = int(m.get("rpm", 200))
        current = int(m.get("current_percent", 50))
        microsteps = int(m.get("microsteps", 16))
        self.client.publish("motor/control/driver", "on", qos=1)
        self.client.publish("motor/control/tmc/enable", "on", qos=1)
        self.client.publish("motor/control/tmc/current_percent", str(current), qos=1)
        self.client.publish("motor/control/tmc/microsteps", str(microsteps), qos=1)
        if m.get("stealthchop", True):
            self.client.publish("motor/control/tmc/stealthchop", "on", qos=1)
        self.client.publish("motor/control/rpm", str(rpm), qos=1)
        print(f"[mqtt] конвейер: driver ON, rpm={rpm}")

    def stop_conveyor(self) -> None:
        m = self.motor_cfg
        if not m.get("enabled", False):
            return
        if not self.enabled or not self._connected:
            return
        self.client.publish("motor/control/rpm", "0", qos=1)
        if m.get("disable_on_stop", False):
            self.client.publish("motor/control/driver", "off", qos=1)
        print("[mqtt] конвейер: rpm=0")

    def publish_result(self, result: ClassificationResult) -> None:
        if not self.enabled or not self._connected:
            return
        l, w, h = result.dims_sorted_mm
        self.client.publish(
            self.cfg.get("topic_result", "vision/feedback/category"),
            result.category.value,
            qos=1,
        )
        self.client.publish(
            self.cfg.get("topic_dims", "vision/feedback/dimensions"),
            f"{l:.1f},{w:.1f},{h:.1f}",
            qos=0,
        )
        self.client.publish(
            self.cfg.get("topic_circle", "vision/feedback/circle_ratio"),
            f"{result.circle_ratio:.4f}",
            qos=0,
        )
        payload = {
            "category": result.category.value,
            "zone": result.category.zone,
            "label_ru": result.category.ru_label,
            "dims_mm": [round(l, 1), round(w, 1), round(h, 1)],
            "circle_ratio": round(result.circle_ratio, 4),
            "reason": result.reason,
        }
        self.client.publish(
            self.cfg.get("topic_debug", "vision/feedback/debug"),
            json.dumps(payload, ensure_ascii=False),
            qos=0,
        )

    def route(self, category: Category) -> None:
        """Отправка команды серво через servo/control/{ch}/angle|enable."""
        routing = self.routing_cfg
        if not routing.get("enabled", True):
            return
        if not self.enabled or not self._connected:
            return

        now = time.time() * 1000.0
        cooldown = float(routing.get("cooldown_ms", 1500))
        if category.value == self._last_category and (now - self._last_route_ts) < cooldown:
            return

        zones = routing.get("zones", {})
        zone_key = category.zone
        zone = zones.get(zone_key)
        if not zone:
            return

        for zk, zcfg in zones.items():
            ch = int(zcfg["servo"])
            idle = int(zcfg.get("idle_angle", 0))
            if zk == zone_key:
                continue
            self._set_servo(ch, idle, enable=True)

        ch = int(zone["servo"])
        divert = int(zone.get("divert_angle", 90))
        idle = int(zone.get("idle_angle", 0))
        hold_ms = int(zone.get("hold_ms", 800))

        if category == Category.SUITABLE and divert == idle:
            self._set_servo(ch, idle, enable=True)
            print(f"[mqtt] зона B — пропуск (servo {ch} idle)")
        else:
            self._set_servo(ch, divert, enable=True)
            print(f"[mqtt] зона {zone_key} — divert servo {ch} → {divert}°")

            def _return_idle(channel: int = ch, angle: int = idle, delay_s: float = hold_ms / 1000.0) -> None:
                time.sleep(delay_s)
                self._set_servo(channel, angle, enable=True)

            threading.Thread(target=_return_idle, daemon=True).start()

        self._last_category = category.value
        self._last_route_ts = now

    def _set_servo(self, channel: int, angle: int, enable: bool = True) -> None:
        base = f"servo/control/{channel}"
        self.client.publish(f"{base}/enable", "on" if enable else "off", qos=1)
        self.client.publish(f"{base}/angle", str(int(angle)), qos=1)

    def close(self) -> None:
        try:
            self.stop_conveyor()
        except Exception:
            pass
        if self._connected:
            self.client.loop_stop()
            self.client.disconnect()
