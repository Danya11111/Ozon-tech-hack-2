# OZON Tech Sorter Simulation

Интеллектуальная роботизированная система сортировки товаров (Frontend MVP).

Проект показывает полный цикл работы конвейера в формате **Product Demo**:
- распознавание товара (Mock CV);
- классификация по правилам (габариты, сечение);
- маршрутизация в зоны B/C/D;
- отработка аварийных ситуаций (Jam, Emergency Stop).

UI переработан под **Product Demo Landing Page**, который:
- работает без горизонтального скролла на любых экранах;
- адаптирован для Mobile, Tablet и Desktop;
- включает Storyline (Detection → Classification → Command → Routing);
- предлагает список Jury Scenarios и OZON Criteria;
- прячет сложный Engineering Dashboard в сворачиваемый аккордеон.

## Стек

- Vite, React, TypeScript
- CSS/SVG (адаптивная сцена)
- Vitest для доменных тестов
- Docker + nginx (production static hosting)

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

## Структура Demo-страницы

1. **Hero Section:** краткая суть проекта и цепочки действий.
2. **Product Demo Section:** живая сцена (`SorterScene`) и карточка текущего результата.
3. **Scenarios Cards:** карточки для проверки нестандартных товаров (негабарит, шар, затор).
4. **Criteria Cards:** чек-лист покрытия требований OZON.
5. **Engineering Details:** подробные отладочные панели (Event Log, PID, метрики).

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
