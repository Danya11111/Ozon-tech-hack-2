# Аудит физической достоверности

**Дата:** 2026-07-15  
**Принцип:** не выдавать красивую анимацию за физическую симуляцию.

Разделение слоёв:

| Слой | Реализация в проекте |
| ---- | -------------------- |
| Визуальный реализм | R3F materials / STL / camera |
| Физическая достоверность | Детерминированная кинематика (`physicalItemMotion`, conveyor network) |
| Логика системы | `classifyItem`, FSM `simulation`, measurement stages |
| Презентационный слой | Playlist, hotkeys, presentation mode, Proof HUD |

---

## 1. Единицы и layout

| Величина | Источник | Статус |
| -------- | -------- | ------ |
| мм / м | `physicalLayout.ts` (`MM_PER_STEP`, высоты лазера, `BELT_TOP_Y`) | Измерено |
| Сеть конвейера | `conveyorNetwork.ts` / path | Измерено |
| Габариты SKU | `items.ts` + `resolveItem` (в т.ч. SKU-*-LC) | Измерено |
| Лимиты габаритов | `DIMENSION_LIMITS` в `classifier.ts` | Измерено |

**Вывод:** единицы согласованы в domain-слое. Это **кинематическая** согласованность, не динамика Ньютона.

---

## 2. Что является «настоящей» логикой vs аппроксимацией

| Узел контура | Реальность в MVP | Тип |
| ------------ | ---------------- | --- |
| Поступление объекта | Playlist / scenario spawn | Детерминированные данные |
| Обнаружение | Phase/sensor flags + pseudo-CV | Аппроксимация |
| Измерения | Модель stepper/laser/stereo из известных размеров | Аппроксимация (честно показана в UI) |
| Классификация | `classifyItem` правила + приоритет C>D | **Реальная логика** |
| Управляющий сигнал | Gate/pusher commands | Реальная логика FSM / playback phases |
| Перемещение | Параметрический путь + speed + fault freeze | Кинематика |
| Столкновения / трение | Нет rigid-body | Отсутствует |
| Подтверждение результата | Category + event log + metrics | Реальная логика учёта |
| Jam / E-stop | Fault timelines + freeze/recover | Симулированные safety-сценарии |

---

## 3. Кинематика предметов

Модуль `physicalItemMotion.ts`:

| Свойство | Поведение | Зачем |
| -------- | --------- | ----- |
| Path following | Движение по сегментам сети | Промышленный маршрут |
| Fault freeze | Остановка при jam/e-stop | Safety demo |
| Recover | Возобновление после reset-потока | Живой показ не «умирает» |
| Seeded jitter | Воспроизводимый шум позиции | Меньше «робот-идеал» |
| Speed scale | 0.5–2× от demo controls | Презентация |

**Нет:** импульсов, restitution, stacking, проскальзывания ленты как friction model, расчёта момента инерции.

---

## 4. Измерительная подсистема

`measurementSystem.ts` моделирует стадии:

`idle → leading_edge → step_counting → laser_height → stereo_width_shape → decision_ready → command_sent`

После доработки:

- использует `DIMENSION_LIMITS` + `classifyItem`;
- исправлены min dimensions;
- confidence **0.65** (зафиксировано в реализации measurement path);
- наружу отдаётся `classificationReason` для Proof HUD.

Это **инженерная визуализация измерений**, а не поток с реальной камеры.

---

## 5. Fault physics vs fault logic

| Сценарий | Логика | Физика движения |
| -------- | ------ | --------------- |
| Jam | Playlist `faultType: jam` + tests | Freeze на конвейере |
| Emergency stop | `emergency_stop` | Freeze; требуется recover/reset narrative |
| C priority | `classifyItem` + sim tests | Маршрут C даже при roundness |

Тесты: `simulation.test.ts` покрывает jam / estop / c_priority (**Измерено**: рост 144→153 тестов).

---

## 6. Инварианты, которые должны держаться

| Инвариант | Статус |
| --------- | ------ |
| Решение на continuous = `classifyItem(item)` | Wired (**Done**) |
| C приоритетнее D при oversized+round | Покрыто тестами |
| Min/max dimensions согласованы с UI Proof | Done (DIMENSION_LIMITS) |
| При fault скорость транспорта = 0 (freeze) | Done |
| Jitter детерминирован seed’ом | Done |
| Нет «телепорта» вне path network | Ожидается; регрессии ловятся visual QA вручную |

---

## 7. Оценка fidelity

| Категория | Балл (0–100) | Тип | Пояснение |
| --------- | -----------: | --- | --------- |
| Logical fidelity | 85 | Оценка | Сильный classifier + FSM |
| Kinematic fidelity | 70 | Оценка | Хороший path, слабые контакты |
| Dynamic fidelity | 25 | Оценка | Нет physics engine |
| Sensor fidelity | 55 | Оценка | Стадии есть, данные synthetic |
| Safety fidelity | 75 | Оценка | Jam/e-stop видимы и тестируются |

*(Баллы — экспертная **оценка**, не бенчмарк.)*

---

## 8. Рекомендации (без иллюзий)

1. **Не** подключать тяжёлый physics engine перед живым показом — риск FPS.  
2. Держать честные подписи: «псевдо-CV», «кинематика».  
3. При желании повысить fidelity: лёгкие contact constraints только на gate/pusher (opt-in demo mode).  
4. Унифицировать twin, чтобы physics story не расходилась визуально между страницами.

---

## 9. Вывод

Проект честно находится в зоне **deterministic kinematic digital twin** с **реальной rule-based классификацией**. Это достаточно для Track 3 MVP и жюри, если proof-слой включён. Называть систему «физическим симулятором с CV» без оговорок — нельзя.
