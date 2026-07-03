# OZON Tech Sorter Simulation

Инженерный frontend MVP для задачи хакатона OZON Tech: «Интеллектуальная роботизированная система сортировки товаров».

Приложение показывает 2D/SVG dashboard сортировочной линии: конвейер, рабочую зону 6000 x 10000 мм, зоны A/B/C/D, датчики, stop-gate, боковые толкатели, движение товаров, классификацию, маршрутизацию, state machine, метрики, PID-виджет и event log.

## Архитектура решения

- Vite + React + TypeScript.
- Доменная логика вынесена в `src/domain`.
- Mock-данные товаров и сценариев находятся в `src/data`.
- UI собран из независимых панелей в `src/components`.
- Визуализация линии выполнена на SVG без Three.js и тяжелой 3D-графики.

## Логика классификации

Классификация реализована чистой функцией `classifyItem`.

1. Сначала проверяются допустимые габариты.
2. Если товар нарушает min/max размеры, он относится к C.
3. Если габариты подходят, проверяется `roundness`.
4. Если `roundness >= 0.8`, товар относится к D.
5. Иначе товар относится к B.
6. Если объект одновременно негабаритный и круглый, приоритет остается у C.

Допустимые габариты MVP:

- min: width >= 10 мм, depth >= 10 мм, height >= 2 мм;
- max: width <= 450 мм, depth <= 320 мм, height <= 320 мм;
- roundness threshold: 0.8.

## Исполнительная часть

Симуляция отображает:

- камеру с pseudo-CV, bounding box и confidence;
- лазерный датчик высоты;
- ультразвуковой датчик прибытия к stop-gate;
- stop-gate с состояниями open/closed;
- pusher C и pusher D со состояниями idle/extended/retracting;
- маршруты B/C/D с цветовой индикацией;
- предупреждения для close items и low confidence;
- fault/emergency сценарии с остановкой конвейера.

## State machine

Состояния MVP:

- IDLE
- MOVING_TO_CAMERA
- DETECTING
- MOVING_TO_GATE
- WAITING_AT_GATE
- CLASSIFYING
- ROUTE_TO_B
- ROUTE_TO_C
- ROUTE_TO_D
- RETURN_HOME
- FAULT
- EMERGENCY_STOP

## Сценарии

- `normal_flow` — обычный поток товаров B/C/D.
- `oversized_item` — товар выходит за max dimensions и уходит в C.
- `round_object` — товар проходит по габаритам, но имеет roundness >= 0.8 и уходит в D.
- `boundary_dimensions` — товары на границах допустимых размеров.
- `close_items` — два товара близко друг к другу, появляется warning queue/spacing.
- `low_confidence` — confidence ниже 0.65, решение принимается rule-based.
- `jam` — застревание у stop-gate, state FAULT, conveyor stopped.
- `emergency_stop` — аварийная остановка, state EMERGENCY_STOP.

## Метрики

Dashboard показывает:

- processed count;
- success count;
- error count;
- avg cycle time;
- throughput items/min;
- cv latency;
- actuator latency;
- queue length;
- conveyor speed;
- PID target speed;
- PID actual speed.

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть: http://127.0.0.1:3100/

## Запуск на сервере

```bash
docker compose -p owl -f docker-compose.server.yml up -d --build
```

Compose публикует только loopback-порт:

```yaml
127.0.0.1:3100:80
```

## Как проверить

```bash
curl -I http://127.0.0.1:3100/
```

## Ограничения MVP

- Физика движения упрощена до дискретной state-machine симуляции.
- PID-регулятор имитационный, без точной модели двигателя и нагрузки.
- CV, laser и ultrasound генерируют псевдоизмерения на основе mock-данных.
- Нет backend, real-time API и сохранения событий.
- Нет Three.js и полноценного digital twin в 3D.

## Что улучшить дальше

- Добавить backend с WebSocket-телеметрией.
- Подключить реальные ML/CV модели или replay датасетов.
- Сделать режим ручного управления исполнительными механизмами.
- Добавить тесты доменной логики и сценариев.
- Расширить физическую модель очереди, зазоров и jam recovery.
- Добавить экспорт event log и отчеты по SLA сортировки.
