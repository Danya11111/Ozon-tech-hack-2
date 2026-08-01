# OZON Tech Sorter Simulation

Интеллектуальная роботизированная система сортировки товаров (Frontend MVP).

Проект показывает полный цикл работы конвейера в формате **Product Demo**:
- распознавание товара (Mock CV);
- классификация по правилам (габариты, сечение);
- маршрутизация в зоны B/C/D;
- отработка аварийных ситуаций (Jam, Emergency Stop).

UI — **Product Demo Landing Page**:
- без горизонтального скролла на desktop / laptop / mobile;
- mobile-first адаптив (одна колонка < 640px);
- **3D digital twin** (React Three Fiber) + 2D SVG fallback;
- storyline Detection → Classification → Decision → Command → Routing;
- карточки сценариев и критериев OZON;
- Engineering Details свёрнуты по умолчанию.

## 3D Digital Twin

Главная сцена — цифровая модель программно-аппаратного комплекса:

A → подающий конвейер → накопитель → CV/laser/ultrasonic → stop-gate → actuator → B/C/D.

- Стек: `three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/rapier`.
- **Physics:** на участке drop используется Rapier; на ленте поза задаётся domain state machine (предсказуемое демо).
- Переключатель: **3D Digital Twin** / **2D fallback**.
- На mobile (<640px) по умолчанию 2D; 3D можно включить вручную.
- Если WebGL недоступен — автоматический 2D fallback.

Что доказывает 3D:
- classification → `ROUTE_TO_*` → actuator motion → physical route;
- B зелёный прямой маршрут, C оранжевый roll-cage, D фиолетовый roll-cage;
- C priority при негабарите (даже если объект круглый);
- fault / emergency stop красной подсветкой и остановкой конвейера.

Проверка WebGL: Engineering Details → **3D capability check** (FPS, WebGL status).

### Автоматическая демонстрация

**Главная страница `/`** — Continuous Playback (10 кейсов: B/C/D + low confidence + jam + E-stop):

1. Откройте сайт и нажмите **Play Demo** (или Space).
2. Управление:
   - **Space** — play/pause
   - **N / →** — следующий кейс, **B / ←** — предыдущий
   - **1–0** — прыжок к кейсу
   - **R** — аварийный reset сценария
   - **P** — presentation mode, **F** — fullscreen
   - **E** — журнал событий
   - **0.5×–2×** — скорость
3. HUD показывает live `classifyItem` (DIM / K / reason) — не заскриптованный override.
4. Engineering / documentation: `/documentation`

Проверка: `npm test` (200+), `npm run build`, `./scripts/demo-health.sh`.

**3D Verification Checklist** (для защиты):
1. Desktop Chrome/Edge → Play Demo
2. Нет чёрного экрана, товар движется, FPS стабилен (~30–60)
3. Console без ошибок
4. Кейсы 9–10: jam (FAULT) и emergency stop
5. Mobile (<640px): упрощённая сцена / fallback

**Реальные 3D модели** (6 STL, 55%):
- Бутылка, Тарелка, Цилиндр, Короб 300, Короб 400, ЛанчБокс
- Fallback primitives для heavy models (> 1 MB)
- Manifest: `src/data/modelAssets.ts`

## Стек

- Vite, React, TypeScript
- CSS/SVG (адаптивная сцена)
- Vitest для доменных тестов
- Docker + nginx (production static hosting)

## input_info

Проект разработан в соответствии с официальной постановкой задачи OZON Tech Track 3.

**Использованные материалы:**
- `Постановка_Задача_3_сжато_2.pdf` — полная постановка задачи (правила классификации, схема участка, критерии оценки)
- `doc-1783009942.pdf` — схема рабочей зоны с размерами A/B/C/D
- `doc-1783011400.pdf` — критерии оценки Track 3 (матрица баллов)
- `doc-1782987706.zip` → STEP модели тестовых товаров (11 шт)
- `doc-1782987733.zip` → STL модели тестовых товаров (11 шт)

**Тестовый набор товаров:**
Цилиндр, Шлем, Бутылка, Мешок, Тарелка, Короб 400×400×300, ЛанчБокс, Короб 300×200×200, Пуфик, Ручка, Моющее средство.

**Параметры классификации (официальная постановка `doc-1783095831`, стр. 5–8):**
- Min dimensions: **строго больше 10×10×10 мм**
- Max dimensions: **строго меньше 450×320×320 мм**
- Roundness: **K > 0.8** (K = 0.8 не считается круглым)
- Conveyor speed: 1.00 м/с
- C-priority: габариты проверяются первыми

> Исторический файл `docs/INPUT_INFO_ANALYSIS.md` содержит устаревшие значения 10×10×2 / K≥0.7 — помечен как SUPERSEDED.

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

## Как устроен новый UI

1. **Hero** — что это за система, CTA «Запустить демо», цепочка Detection → Routing.
2. **Product Demo** — 3D digital twin (или 2D fallback) + карточка результата + Start / Next / Reset.
3. **Storyline Stepper** — текущий этап цикла.
4. **Scenario Cards** — jury-кейсы карточками (кнопка «Показать»).
5. **Criteria Cards** — покрытие критериев OZON со ссылкой на сценарий.
6. **Engineering Details** — полные техпанели (state machine, sensors, PID, timeline, event log, criteria).

## Как запустить демо

1. Откройте сайт.
2. Нажмите **Запустить демо** в Hero или **Start demo** в блоке демо.
3. Нажимайте **Next step**, чтобы пройти цикл товара.
4. Выберите сценарий в карточках ниже (негабарит, круглый объект, jam и т.д.).
5. Для экспертов откройте **Инженерный режим** / **Engineering Details**.

## Где Engineering Details

Внизу страницы, секция **Engineering Details**. По умолчанию свёрнута. Кнопки «Инженерный режим» в header / hero / demo раскрывают блок и скроллят к нему. Внутри — полная сцена (`variant="full"`) и все инженерные панели.

## Как проверить mobile

1. Откройте DevTools → device toolbar.
2. Выберите `390×844` (или iPhone 12/13).
3. Проверьте:
   - одна колонка;
   - кнопки ≥ 44px;
   - сцена масштабируется (`width: 100%`);
   - нет horizontal scroll.

## Как проверить отсутствие horizontal scroll

В консоли браузера:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Должно вернуть `true` на ширинах 1920, 1440 и 390.

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
- `round_object` — габариты проходят, roundness K > 0.8, маршрут D.
- `c_priority` — негабарит + круглый → только C (приоритет габаритов).
- `boundary_dimensions` — проверка строгих min/max границ.
- `close_items` — предупреждение spacing/queue, последовательная обработка.
- `low_confidence` — низкая уверенность измерения, rule-based fallback.
- `jam` — застревание у gate, FAULT, остановка конвейера.
- `emergency_stop` — EMERGENCY_STOP, остановка всех движений.

## Классификация

Классификация реализована чистой функцией `classifyItem`.

1. Проверяются габариты (строгие границы «больше» / «меньше»).
2. Если нарушены min/max размеры, категория C.
3. Если габариты подходят, проверяется `roundness` K = r_in / R_out.
4. Если `K > 0.8`, категория D.
5. Иначе категория B.
6. Если товар одновременно негабаритный и круглый, приоритет у C.

Официальные границы (Track 3):

- min: width > 10 мм, depth > 10 мм, height > 10 мм;
- max: width < 450 мм, depth < 320 мм, height < 320 мм;
- roundness: круг при K > 0.8 (K = 0.8 не круглый);
- conveyor target speed: 1.00 м/с (close_items: 0.75 м/с).

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

PID-панель (в Engineering Details) показывает упрощенную имитацию control loop: target speed, actual speed, error, correction и mini graph последних тиков скорости.

В normal flow actual speed приближается к target. В `jam` и `emergency_stop` target становится 0, actual speed визуально падает к 0.

## Тесты

```bash
npm run test
```

Покрыты classifier, PID, сценарии, demo steps и OZON criteria.

## Документация

- `docs/ARCHITECTURE.md` — модули и поток данных.
- `docs/DEMO_SCRIPT.md` — сценарий защиты.
- `docs/SCENARIOS.md` — ожидаемые результаты сценариев.
- `docs/JURY_QA.md` — ответы на вопросы жюри.
- `docs/UI_UX_REDESIGN_AUDIT.md` — план редизайна UI.
- `docs/SUBMISSION_CHECKLIST.md` — checklist перед сдачей.

## Cursor rules

Локальные UI/UX rules в `.cursor/rules/`:

- `ui-ux-pro-max.mdc`
- `responsive-product-demo.mdc`
- `react-design-system.mdc`
- `accessibility-and-visual-qa.mdc`

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
