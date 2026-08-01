> **HISTORICAL / SUPERSEDED:** This document records an earlier project stage. Canonical Track 3 rules are exclusive bounds **> 10×10×10** and **< 450×320×320** mm, roundness **K > 0.8** (`doc-1783095831` pp.5–8; `src/domain/classifier.ts`). Values 10×10×2 / K≥0.7 below are obsolete.

# Measurement System Report

## Summary

Добавлена инженерная архитектура измерения в full-screen 3D demo:
- Шаговый двигатель измеряет длину через подсчёт шагов
- Лазерный дальномер измеряет высоту
- Стереокамера измеряет ширину и форму
- PLC контроллер принимает решение и управляет actuator

## Инженерная логика

### 1. Измерение длины (Stepper Motor)

```
Длина = stepCount × mmPerStep

Параметры:
- Step angle: 1.8° (200 steps/rev)
- Microstep: 16x (3200 steps/rev)
- Drive roller: Ø120mm
- mmPerStep ≈ 0.118 mm

Пример: 300mm depth → stepCount ≈ 2540 pulses
```

### 2. Измерение высоты (Laser Rangefinder)

```
Высота = laserMountHeight - laserDistance

Параметры:
- Laser mount: 1150mm
- Belt surface: 700mm
- Max item height: 320mm
- Laser distance: mount - (belt + itemHeight)
```

### 3. Измерение ширины и формы (Stereo Camera)

```
Стереокамера:
- Baseline: 120mm между линзами
- FOV: 60°
- Mount: 1100mm

Roundness K:
- K ≥ 0.7 → round shape → D
- K < 0.7 → box/irregular → B or C
```

### 4. C-Priority Logic

```
if (dimensionsFail) {
  category = 'C';  // Overrides roundness
  if (roundness >= 0.7) {
    cPriorityApplied = true;
    warning = "Dims fail overrides roundness → C";
  }
} else if (roundness >= 0.7) {
  category = 'D';
} else {
  category = 'B';
}
```

## Файлы созданы/изменены

| Файл | Действие |
|------|----------|
| `src/domain/physicalLayout.ts` | Добавлены stepper/laser/stereo параметры |
| `src/domain/measurementSystem.ts` | **Создан** — полная measurement логика |
| `src/domain/measurementSystem.test.ts` | **Создан** — unit tests |
| `src/components/CVInspectionOverlay.tsx` | Обновлён — MEASUREMENT overlay |
| `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Добавлены LaserBeam, StereoCameraLenses, PointCloud, ActuatorPusher |
| `src/pages/MainPage.tsx` | Использует measurementSystem |
| `src/styles.css` | Новые стили для measurement overlay |

## Визуальные элементы 3D

### Stepper Motor
- Pulse indicator LED на моторе
- Вращающийся вал при активном измерении

### Laser Beam
- Вертикальный cyan луч от датчика к товару
- Laser dot на верхней поверхности товара
- Laser emitter подсвечивается при измерении

### Stereo Camera
- Два объектива на overhead rig (baseline 120mm)
- View cones к товару при активном измерении

### Point Cloud
- 12 точек вокруг контура товара
- Форма зависит от roundness (круглая/квадратная)

### Actuator Pusher
- Animated pusher при routing в C/D
- Цвет соответствует категории

## Measurement Overlay

Секции:
1. **STEPPER LENGTH** — Pulses, mm/step, Length
2. **LASER HEIGHT** — Mount, Distance, Height
3. **STEREO WIDTH/SHAPE** — Width, Shape, Roundness K
4. **PLC DECISION** — Dims pass/fail, Confidence, CLASS, CMD

Warnings:
- C-priority: "Dims fail overrides roundness → C"
- Low confidence: "Low confidence, rule-based fallback"

## Скриншоты

`docs/measurement_system_screenshots/`:
- `stepper_counting.png` — overlay с данными stepper
- `laser_height_measurement.png` — лазерный луч на товаре
- `stereo_shape_measurement.png` — анализ формы
- `c_priority_decision.png` — C-priority warning
- `route_command_sent.png` — команда маршрутизации
- `mobile_compact_overlay.png` — mobile view (overlay hidden)

## Проверки

| Проверка | Результат |
|----------|-----------|
| `npm run build` | ✅ Успешно |
| `npm run test` | ✅ 74 тестов |
| Docker rebuild | ✅ Успешно |
| Production QA | ✅ Работает |
| Console errors | ✅ Нет ошибок |
| /details | ✅ Не сломан |

## Что осталось

- Можно добавить более детальную анимацию point cloud
- Можно добавить визуальный encoder на drive roller
- Actuator pusher может быть более механистичным

## Команды commit/push

```bash
git add -A
git commit -m "feat: engineering measurement architecture in 3D demo

- Stepper motor length measurement (step counting)
- Laser rangefinder height measurement
- Stereo camera width/shape analysis
- PLC decision logic with C-priority
- Actuator pusher animation
- Full measurement overlay with live data

Technical details:
- mmPerStep = 0.118mm (1.8° step, 16x microstep, Ø120mm roller)
- Laser mount at 1150mm
- Stereo baseline 120mm, FOV 60°

All measurements derived from item dimensions, no random values."
git push origin dan_branch
```
