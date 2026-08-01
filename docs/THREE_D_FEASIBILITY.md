# 3D Digital Twin Feasibility

## Выбранный стек

- `three`
- `@react-three/fiber`
- `@react-three/drei` (OrbitControls, Html labels)
- **Без** `@react-three/rapier` на первом этапе

## Почему

- R3F хорошо ложится на текущий React UI.
- Простые box/cylinder геометрии достаточны для digital twin.
- Drei нужен только для камеры и коротких labels.
- Physics engine в браузере добавляет wasm, непредсказуемость и риск лагов на защите.

## Physics engine

**Не подключается.**

Анимация: keyframe / state-machine interpolation по `machineState` + `elapsedInStateMs`.

Архитектура готова к physics позже:
- позиции товара и actuator вычисляются в `itemMotion.ts`;
- статические меши сцены отделены от motion layer;
- можно заменить motion layer на kinematic/dynamic bodies без смены domain logic.

## Риски

| Риск | Митигация |
|------|-----------|
| Bundle size | lazy-load 3D, простые геометрии |
| Нет WebGL | 2D `SorterScene` fallback |
| Mobile FPS | simplified 3D или auto-2D при width < 640 |
| Непредсказуемая физика | не используем rapier |

## Fallback

1. WebGL unavailable → 2D.
2. User toggle «2D fallback».
3. Mobile narrow screen → default 2D (можно вручную включить 3D).

Сообщение: «3D недоступен, включён 2D fallback. Логика симуляции та же.»

## Performance budget

- Без shadows / postprocessing / textures.
- < ~50 mesh-объектов.
- FPS overlay в capability check.
- Target: стабильный interactive FPS на desktop.

## Integration point

`ProductDemoSection`: toggle 3D Digital Twin / 2D fallback.
Props из `SimulationState`: item, machineState, scenario, classification, sensors, actuators, metrics, gate.

## Definition of Done

- [x] Build/test/Docker OK
- [x] 3D показывает A → conveyor → CV → gate → B/C/D
- [x] State machine двигает товар предсказуемо
- [x] ROUTE_TO_* виден цветом и стрелкой
- [x] 2D fallback работает
- [x] min dimensions > 10×10×10, max < 450×320×320, roundness K > 0.8, conveyor 1.00 m/s
- [x] Нет horizontal scroll

## Decision log

> **HISTORICAL / SUPERSEDED (stage note):** early feasibility assumed no physics engine.  
> **Current:** `@react-three/rapier` is used on the drop segment; belt pose remains domain-driven.

Physics (`@react-three/rapier`) **установлен** для drop/handoff. Motion on belt — domain state machine.
