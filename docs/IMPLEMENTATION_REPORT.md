# Отчёт о реализации — maximum-demo-realism

**Ветка:** `feature/maximum-demo-realism`  
**База:** `dan_branch` @ `e89c728`  
**Backup tag:** `backup/pre-maximum-demo-realism-20260715`  
**Дата:** 2026-07-15  
**Проект:** OZON Tech Sorter Simulation (Track 3)

---

## 1. Цель итерации

Максимально поднять убедительность живой демонстрации: live-классификация, safety-сценарии, proof UI, управление показом, адаптивное качество, ops-скрипты и безопасный MVP агента — без выдуманных секретов и без auto-deploy.

---

## 2. Все выполненные изменения (реальные)

| # | Изменение | Зачем |
| - | --------- | ----- |
| 1 | `classifyItem` встроен в continuous playback | Live classification, не только подписи playlist |
| 2 | `measurementSystem` → `DIMENSION_LIMITS` + `classifyItem`; min dims; confidence 0.65 | Согласованность измерений и правил |
| 3 | Playlist 8→10: jam + emergency_stop timelines | Safety story для жюри |
| 4 | `physicalItemMotion`: fault freeze/recover + seeded jitter | Правдоподобие и воспроизводимость |
| 5 | Demo controls: seek, speed 0.5–2×, hotkeys Space/N/B/R/P/E/F/1–0, presentation, event journal | Управление живым показом |
| 6 | Quality modes low/medium/high/demo | FPS на разных клиентах |
| 7 | Proof HUD: DIM pass/fail, K, reason; CV overlay RULE | Доказательство работы алгоритма |
| 8 | `simulation.test.ts`: jam / estop / c_priority | Регрессия safety/логики |
| 9 | Agent MVP `agent/cli.mjs`: dry-run\|run-once\|status\|stop\|resume\|pause\|report | Автономия уровня verify-only |
| 10 | Scripts: demo-start/stop/reset/health, agent-dry-run, agent-run-once | One-command ops |
| 11 | `resolveItem` для SKU-*-LC | Стабильность данных |

---

## 3. Изменённые / затронутые области файлов

> Точный `git diff` зависит от незакоммиченного состояния рабочей копии. Ниже — карта модулей по смыслу изменений (**проверено по коду репозитория**).

| Область | Файлы (ключевые) |
| ------- | ---------------- |
| Continuous / classify | `src/domain/continuousPlayback.ts`, `measurementSystem.ts`, `classifier.ts` |
| Playlist / faults | `src/domain/demoPlaylist.ts`, `physicalItemMotion.ts`, `seededRng.ts` |
| UI demo | `src/pages/MainPage.tsx`, Proof/CV components, styles |
| Quality | `src/domain/qualityMode.ts`, `qualityMode.test.ts` |
| Data | `src/data/resolveItem.ts` |
| Tests | `src/domain/simulation.test.ts`, связанные domain tests |
| Agent | `agent/cli.mjs`, `agent/state/*`, `agent/reports/*` |
| Scripts | `scripts/demo-*.sh`, `scripts/agent-*.sh` |
| Package scripts | `package.json` (`demo:*`, `agent:*`) |
| Docs | этот набор `docs/*.md` аудита |

---

## 4. Причины изменений (кратко)

1. Жюри должно **видеть причинно-следственную связь** измерений → правила → маршрут.  
2. Без jam/e-stop демо выглядит «идеальной анимацией».  
3. Без hotkeys/presentation оператор теряет контроль на сцене.  
4. Без quality modes слабые ноутбуки дают рывки и подрывают доверие.  
5. Agent/scripts нужны для устойчивой эксплуатации и будущего цикла улучшений **с лимитами**.

---

## 5. Результаты тестов

| Проверка | До | После | Тип |
| -------- | -: | ----: | --- |
| Vitest passed | 144 | **153** | Измерено |
| Test files | 14 | **16** | Измерено |
| E2E CI | нет | нет | Измерено |
| Lint (отдельный) | не выделен в package | не выделен | Измерено |
| Typecheck | через `tsc -b` в build | OK вместе с build | Измерено |

---

## 6. Метрики до и после

| Метрика | До | После | Изменение |
| ------- | -: | ----: | --------: |
| Tests | 144 | 153 | +9 |
| Test files | 14 | 16 | +2 |
| Build | OK ~391 ms | OK | стабильно |
| CSS | — | 39.66 kB / gzip 8.79 | зафиксировано |
| Continuous twin chunk | — | 51.29 kB / gzip 13.68 | зафиксировано |
| Playlist size | 8 | 10 | +faults |
| Agent | нет | MVP CLI | +ops |
| Live classify on `/` | слабо | wired | +proof |

Main R3F chunk baseline до итерации: ~881 kB (**Измерено** historically).

---

## 7. Оставшиеся ограничения

| Ограничение | Комментарий |
| ----------- | ----------- |
| Нет real physics engine | Детерминированная кинематика |
| Pseudo-CV | Synthetic measurements |
| Dual 3D twins diverge | `/` vs `/details` |
| Нет e2e в CI | Playwright вручную |
| Agent без auto-patch | By design MVP |
| Production :3100 | Может служить старый dist до redeploy |
| Нет docker CLI в этой среде | Redeploy — внешняя ops-процедура |
| GPU idle | Не используется для demo render |

---

## 8. Инструкции запуска

### Демо (preview, не путать с prod :3100)

```bash
cd /home/coder/arhipovdan/app
npm run demo:start          # build + vite preview 127.0.0.1:3101
npm run demo:health         # :3100 / :3101 / public + vitest
npm run demo:stop           # остановить preview
# также: bash scripts/demo-reset.sh
```

### Разработка

```bash
npm install                 # при необходимости
npm run dev                 # 127.0.0.1:3100 (vite dev — не prod nginx)
npm test
npm run build
```

### Агент

```bash
npm run agent:dry-run
npm run agent:run-once
npm run agent:status
node agent/cli.mjs stop     # перед живым показом
node agent/cli.mjs resume
node agent/cli.mjs report
```

### Откат кода

```bash
git fetch --tags
git checkout backup/pre-maximum-demo-realism-20260715
# или сброс ветки к e89c728 по необходимости (только осознанно)
```

### Production

Публичный URL: https://arhipovdan.ru/ (nginx loopback :3100 + cloudflared).  
После merge/сборки нужен **ручной redeploy** образа/dist — агент этого не делает.

---

## 9. Hotkeys (оператору демо)

| Клавиша | Действие |
| ------- | -------- |
| Space | Play / pause |
| N | Next case |
| B | Back / previous |
| R | Reset |
| P / F | Presentation / fullscreen-related |
| E | Event journal focus/toggle (UI) |
| 1–0 | Seek/jump по кейсам playlist |

Speed: 0.5×–2× через demo controls UI.

---

## 10. Вывод

Итерация достигла измеримого улучшения демо-контура (тесты +9, playlist +faults, live classify, proof, controls, agent MVP). Критический остаточный ops-риск — **рассинхрон production dist**. Технический потолок реализма без смены архитектуры — кинематика + pseudo-CV; это задокументировано честно.
