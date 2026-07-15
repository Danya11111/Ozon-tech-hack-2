# Полный аудит проекта — OZON Tech Sorter Simulation

**Дата аудита:** 2026-07-15  
**Ветка:** `feature/maximum-demo-realism` (от `dan_branch` @ `e89c728`)  
**Точка отката:** тег `backup/pre-maximum-demo-realism-20260715`  
**Репозиторий:** `/home/coder/arhipovdan/app`  
**Публичный URL:** https://arhipovdan.ru/

| Метка | Значение |
| ----- | -------- |
| Тип данных | Измерено / проверено в репозитории и на сервере |
| Статус | Frontend-only MVP, Track 3 (цифровой двойник сортировки) |

---

## 1. Описание проекта

**OZON Tech Sorter Simulation** — React/Vite/Three.js цифровой двойник промышленной сортировки товаров (Track 3). Система демонстрирует полный контур:

```text
Поступление объекта
→ обнаружение (pseudo-CV / сенсоры)
→ измерения и признаки (габариты, K-roundness)
→ classifyItem (детерминированные правила)
→ управляющий сигнал (gate / pusher)
→ кинематическое перемещение
→ маршрут B / C / D или fault
→ журнал событий + метрики
```

**Характер MVP:** только frontend. Backend, WebSocket, БД, API-сервер — отсутствуют. Сборка — статический `dist`, раздача через nginx (Docker-образ или локальный preview).

**Два движка демонстрации:**

| Маршрут | Движок | Назначение |
| ------- | ------ | ---------- |
| `/` | Continuous playback + playlist | Основная демо для жюри: непрерывный 3D twin, seek/speed, hotkeys |
| `/details` | State-machine simulation | Инженерный разбор: FSM, сенсоры, PID, сценарии |

Оба движка используют общий `classifyItem` и доменные типы, но **визуальные 3D-сцены всё ещё различаются** (`SorterDigitalTwinContinuous` vs `SorterDigitalTwin`).

---

## 2. Архитектура

```text
src/data/items.ts, scenarios.ts, resolveItem.ts, modelAssets.ts
        |
        v
src/domain/classifier.ts  ← единый источник решения (B/C/D)
        |
        +-- continuousPlayback.ts + demoPlaylist.ts + measurementSystem.ts  → MainPage (/)
        |
        +-- simulation.ts + metrics/pid/sensors                              → DetailsPage (/details)
        |
        v
React UI + R3F (Three.js) + Proof HUD / CV overlay / EventLog
```

**Деплой (production-контур):**

```text
Vite build → dist/
    → Docker (node:20-alpine build + nginx:alpine runtime)
    → nginx слушает 127.0.0.1:3100 на хосте OwlPrime
    → cloudflared tunnel → https://arhipovdan.ru/
```

В текущем окружении **нет docker CLI** для оператора; Node 20.20.2 используется для локальной сборки. Production-контейнер мог быть поднят вне этой среды — см. риск устаревшего `dist` на :3100.

---

## 3. Карта модулей

| Область | Путь | Роль |
| ------- | ---- | ---- |
| Точка входа | `src/main.tsx`, `src/App.tsx` | Router: `/`, `/details` |
| Continuous demo | `src/domain/continuousPlayback.ts` | Фазы кейса, таймлайн, fault freeze |
| Playlist | `src/domain/demoPlaylist.ts` | 10 кейсов (классификация + jam + e-stop) |
| Измерения | `src/domain/measurementSystem.ts` | Stepper/laser/stereo → `classifyItem` |
| Классификатор | `src/domain/classifier.ts` | `DIMENSION_LIMITS`, приоритет C над D |
| Кинематика | `src/domain/physicalItemMotion.ts` | Путь по сети конвейера, jitter, freeze |
| Layout | `src/domain/physicalLayout.ts`, `conveyorNetwork.ts` | Единицы мм/м, геометрия линий |
| Качество | `src/domain/qualityMode.ts` | low / medium / high / demo |
| FSM sim | `src/domain/simulation.ts` | State machine для `/details` |
| 3D continuous | `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Основной twin |
| 3D details | `src/components/ThreeD/SorterDigitalTwin.tsx` | Инженерный twin |
| Proof UI | `CurrentProofCard`, `CVInspectionOverlay` | DIM / K / reason / RULE |
| Agent MVP | `agent/cli.mjs` | dry-run / run-once / status / stop… |
| Demo scripts | `scripts/demo-*.sh`, `scripts/agent-*.sh` | One-command ops |

---

## 4. Текущий стек

| Слой | Технология | Примечание |
| ---- | ---------- | ---------- |
| Bundler | Vite | Production build ~сотни ms |
| UI | React 19 + TypeScript | SPA |
| 3D | Three.js + @react-three/fiber + drei | Клиентский WebGL |
| Тесты | Vitest | Unit/domain; e2e Playwright — вручную |
| Контейнер | Docker multi-stage + nginx | Статический хостинг |
| Runtime на сервере | nginx :3100, cloudflared | Без pm2 в этой среде |
| Node (build) | 20.20.2 | Измерено |

**Чего нет (подтверждено аудитом):** backend, БД, WebSocket/SSE, PM2, docker CLI в текущем shell-окружении, CI e2e, реальный ML/CV, физический движок (Rapier/Cannon и т.п.).

**Секреты:** файл `.env` присутствует (ключи `login`, `password`, `url`). Значения **не документируются** и в отчёты не включаются.

---

## 5. Выявленные проблемы

| # | Проблема | Критичность | Влияние на демо |
| - | -------- | ----------- | --------------- |
| P1 | Dual 3D twins визуально расходятся (`/` vs `/details`) | Высокая | Зритель может не понять «одну систему» |
| P2 | Нет реального physics engine — детерминированная кинематика | Средняя | При пристальном взгляде нет столкновений/инерции «как в жизни» |
| P3 | Pseudo-CV (измерения из данных SKU, не с камеры) | Средняя | Нужен Proof HUD, иначе «анимация» |
| P4 | Production :3100 может отдавать старый `dist` до redeploy | Высокая | Публичная демо ≠ локальная сборка |
| P5 | Нет e2e в CI; Playwright только scripts | Средняя | Регрессии UI ловятся вручную |
| P6 | Agent MVP не патчит код автоматически | Низкая (by design) | Автономность ограничена verify-only |
| P7 | GPU на сервере idle; 3D на клиенте | Инфо | Серверный offscreen render не нужен |

---

## 6. Критичность (сводка)

| Уровень | Количество | Действие |
| ------- | ---------: | -------- |
| Критическая для живого показа | 1 | Синхронизировать/передеплоить prod dist |
| Высокая (доверие демо) | 2 | Унификация twin + явный proof алгоритма (уже частично сделано) |
| Средняя (техдолг) | 3 | Physics/CV/e2e — план, не блокер MVP |
| Низкая / by design | 1 | Agent без auto-merge |

---

## 7. Технический долг

1. **Два рендерера сцены** — дублирование материалов/освещения/лейаута.
2. **Кинематика вместо физики** — осознанный trade-off производительности и детерминизма.
3. **Pseudo-CV** — confidence фиксирован (0.65 в measurement path после фикса min dims); нет модели.
4. **Ручные Playwright-скрипты** в `scripts/` без интеграции в CI.
5. **Agent** — оркестратор без Implementer-патчей (verify-only).
6. **Документация историческая** в `docs/*_REPORT.md` — много итерационных отчётов; этот аудит — актуальная точка истины на 2026-07-15.

---

## 8. Состояние тестов

| Метрика | До изменений | После изменений | Тип данных |
| ------- | -----------: | --------------: | ---------- |
| Passed | 144 | **153** | Измерено |
| Файлов тестов | 14 | **16** | Измерено |
| Runner | Vitest | Vitest | — |

Добавлено/расширено: `simulation.test.ts` (jam / emergency_stop / c_priority), тесты quality mode и связанные domain-тесты.

**E2E:** не в CI. Скрипты Playwright/Python в `scripts/` — ручной прогон (**оценка процесса**, не автоматический gate).

---

## 9. Состояние production build

| Метрика | До | После | Тип |
| ------- | -- | ----- | --- |
| `npm run build` | OK (~391 ms) | OK | Измерено |
| Main R3F chunk | ~881 kB | (сборка OK; детальный breakdown см. PERFORMANCE_BASELINE) | Измерено / частично |
| CSS | — | 39.66 kB (gzip 8.79) | Измерено |
| Continuous twin chunk | — | 51.29 kB (gzip 13.68) | Измерено |

Команда: `tsc -b && vite build`. Typecheck входит в build pipeline.

---

## 10. Состояние демонстрации

**Сильные стороны (после итерации maximum-demo-realism):**

- `classifyItem` встроен в continuous playback — live classification, не только playlist override.
- Playlist 10 кейсов: B/C/D, edge, c_priority, jam, emergency_stop.
- Demo controls: seek, speed 0.5–2×, hotkeys (Space/N/B/R/P/E/F/1–0), presentation mode, event journal.
- Proof HUD: DIM pass/fail, K, classifier reason; CV overlay с RULE.
- Quality modes: low / medium / high / demo.
- Fault freeze/recover в `physicalItemMotion` + seeded jitter.
- One-command: `npm run demo:start` / `demo:health` / agent scripts.

**Ограничения для жюри:**

- Публичный https://arhipovdan.ru/ может ещё показывать старый билд, пока не пересобран/не перезалит контейнер на :3100.
- Визуальное отличие `/` и `/details`.
- Нет настоящего ML-CV и rigid-body physics.

**Готовность к показу:** высокая для локального preview (`127.0.0.1:3101` через `demo:start`) при зелёных тестах; production — после явного redeploy.

---

## 11. Вывод аудита

Проект — зрелый frontend digital twin с убедительным демо-контуром и измеримой proof-логикой классификации. Главные остаточные риски для показа: **синхронизация production dist** и **визуальная унификация двух twin**. Автономный агент на сервере — **возможен с ограничениями** (1 worker, hybrid LLM, без auto-deploy). Подробности — в `SERVER_CAPACITY_REPORT.md` и `AUTONOMOUS_AI_AGENT_ARCHITECTURE.md`.
