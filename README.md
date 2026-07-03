# OZON Tech Sorter Simulation

Инженерный frontend MVP для задачи хакатона OZON Tech: «Интеллектуальная роботизированная система сортировки товаров».

Проект показывает 2D/SVG dashboard сортировочной линии: рабочую зону 6000 x 10000 мм, конвейер шириной 500 мм, зоны A/B/C/D, roll-cage C/D, датчики, stop-gate, толкатели, классификацию, маршрутизацию, timeline цикла, PID-имитацию, метрики, event log и режим защиты для жюри.

## Стек

- Vite
- React
- TypeScript
- SVG/CSS для инженерной 2D-сцены
- Vitest для доменных тестов
- Docker + nginx для production static hosting

Нет Three.js, backend, реального ML и тяжелых UI-библиотек.

## Как открыть демо

Публично:

```text
https://arhipovdan.ru/
https://www.arhipovdan.ru/
```

Локально на сервере:

```text
http://127.0.0.1:3100/
```

### Guided Demo

Рекомендуемый путь для жюри — использовать **Guided Demo** view.
В Header переключите режим на `Guided Demo`.
Это чистое демо-представление для защиты (1 экран без скролла).

Отличия Guided Demo от Engineering Dashboard:
- Guided Demo показывает только ключевую информацию для защиты (Proof Card, Narration, Snapshot), скрывая длинные логи и графики.
- Engineering Mode дает полный доступ ко всем метрикам, логам, PID-графику и дереву классификации.

Рекомендуемый путь:
- Start Guided Demo
- Next
- Oversized
- Round
- Low confidence
- Jam
- Emergency stop

В Guided Demo закрываются критерии: classification correctness, routing, timing, fault handling.

## Presentation Mode

В Header есть переключатель:

- `Engineering Mode` — полный инженерный dashboard.
- `Presentation Mode` — режим защиты с demo narrative, подсказками докладчика, фокусом на текущую область и criteria checklist.

В Presentation Mode панель demo steps показывает:

- номер текущего шага;
- что сейчас происходит;
- что смотреть на экране;
- что это доказывает для жюри;
- связанные OZON criteria;
- готовую presenter phrase.

Кнопки:

- `Previous step` / `Next step`;
- `Restart demo`;
- `Apply scenario`;
- `Run suggested action`.

Для `jam` и `emergency_stop` при `Safe Demo: ON` требуется явное повторное подтверждение fault-сценария.

## Demo Steps

1. System overview.
2. Normal item to B.
3. Oversized item to C.
4. Round object to D.
5. Boundary dimensions.
6. Low confidence fallback.
7. Close items queue.
8. Jam / fault handling.
9. Emergency stop.
10. Performance and synchronization.

## OZON Criteria Coverage Panel

Панель `OZON criteria coverage` показывает, какие критерии закрыты и где это доказано:

- category correctness;
- classification rules;
- boundary cases;
- physical routing;
- manipulation logic;
- geometry variety;
- safety;
- timing and throughput;
- CV-to-actuator integration;
- engineering realism;
- reproducibility/docs.

Фильтры: `all`, `covered`, `partially covered`, `demo step available`.

## Event Log JSON

`Copy JSON` в Event Log использует browser clipboard API. Если clipboard недоступен в браузере, экспорт не критичен для защиты: используйте визуальный Event Log с фильтрами, timestamp, state, command/category и severity. DevTools открывать не требуется.

## Запуск локально

```bash
npm install
npm run dev
```

## Запуск через Docker

```bash
docker compose -p owl -f docker-compose.server.yml up -d --build
```

Compose публикует только loopback-порт:

```yaml
127.0.0.1:3100:80
```

## Проверка домена

```bash
curl -I http://127.0.0.1:3100/
curl -I https://arhipovdan.ru/
curl -I https://www.arhipovdan.ru/
```

## Сценарии

- `normal_flow` — обычный поток B/C/D.
- `oversized_item` — max dimensions нарушены, маршрут C.
- `round_object` — габариты проходят, roundness >= 0.8, маршрут D.
- `boundary_dimensions` — проверка min/max границ.
- `close_items` — предупреждение spacing/queue, последовательная обработка.
- `low_confidence` — низкий CV confidence, rule-based fallback.
- `jam` — застревание у gate, FAULT, остановка конвейера.
- `emergency_stop` — EMERGENCY_STOP, остановка всех движений.

## Классификация

Классификация реализована чистой функцией `classifyItem`.

1. Проверяются габариты.
2. Если нарушены min/max размеры, категория C.
3. Если габариты подходят, проверяется `roundness`.
4. Если `roundness >= 0.8`, категория D.
5. Иначе категория B.
6. Если товар одновременно негабаритный и круглый, приоритет у C, потому что dimensions check идет первым.

Границы MVP:

- min: width >= 10 мм, depth >= 10 мм, height >= 2 мм;
- max: width <= 450 мм, depth <= 320 мм, height <= 320 мм;
- roundness threshold: 0.8.

## Исполнительная часть

State machine управляет циклом:

- `MOVING_TO_CAMERA`
- `DETECTING`
- `MOVING_TO_GATE`
- `WAITING_AT_GATE`
- `CLASSIFYING`
- `ROUTE_TO_B/C/D`
- `RETURN_HOME`
- `FAULT`
- `EMERGENCY_STOP`

Датчики имитируются по mock-данным: camera bbox/confidence/CV latency, laser measured height, ultrasonic gate detection. Stop-gate закрывается перед классификацией, открывается для B и удерживает товар для C/D перед толкателями.

## Simplified PID

PID-панель показывает упрощенную имитацию control loop: target speed, actual speed, error, correction и mini graph последних тиков скорости.

В normal flow actual speed приближается к target. В `jam` и `emergency_stop` target становится 0, actual speed визуально падает к 0.

## Тесты

```bash
npm run test
```

Покрыты classifier, PID, сценарии, demo steps и OZON criteria.

## Документация

- `docs/ARCHITECTURE.md` — модули и поток данных.
- `docs/DEMO_SCRIPT.md` — 3-5 минутный сценарий защиты.
- `docs/SCENARIOS.md` — ожидаемые результаты сценариев.
- `docs/JURY_QA.md` — короткие ответы на вопросы жюри.
- `docs/SUBMISSION_CHECKLIST.md` — checklist перед сдачей.

## Ограничения MVP

- Физика движения дискретная, без динамической модели массы/трения.
- CV является pseudo-CV по mock-данным.
- PID упрощен до демонстрации стабилизации скорости.
- Нет backend, real-time API, сохранения событий и реального ML.
- Нет 3D digital twin.

## Что улучшить дальше

- Добавить WebSocket-телеметрию и replay реальных событий.
- Подключить реальные CV-модели или датасеты.
- Добавить режим manual override для gate/pushers.
- Расширить модель очереди, spacing и recovery после jam.
- Экспортировать event log в отчет смены.
