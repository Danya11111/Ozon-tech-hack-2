# План максимизации демонстрации

**Проект:** OZON Tech Sorter Simulation  
**Ветка реализации:** `feature/maximum-demo-realism`  
**Дата:** 2026-07-15  

Документ фиксирует целевое состояние демо, этапы и критерии приёмки. Статус этапов: **Done** = реализовано в этой итерации; **Open** = остаётся.

---

## 1. Текущее состояние (as-is)

| Аспект | Состояние | Тип |
| ------ | --------- | --- |
| Движки | Continuous `/` + FSM `/details` | Измерено |
| Классификация на `/` | `classifyItem` wired (live) | Измерено (код) |
| Playlist | 10 кейсов вкл. jam + e-stop | Измерено |
| Proof | HUD DIM/K/reason + CV RULE | Измерено |
| Управление | seek, 0.5–2×, hotkeys, presentation | Измерено |
| Quality | low/medium/high/demo | Измерено |
| Physics | Детерминированная кинематика + jitter | Измерено |
| CV | Pseudo | Измерено |
| Twin parity `/` vs `/details` | Расходятся визуально | Измерено |
| Prod sync | :3100 может быть старым | Измерено (риск) |
| Tests | 153 / 16 files | Измерено |
| Agent | MVP verify-only | Измерено |

---

## 2. Целевое состояние (to-be)

Демонстрация должна за 5–10 секунд отвечать зрителю:

1. Что это за система (промышленная сортировка OZON Tech).
2. Откуда берётся решение (измерения → правила → B/C/D).
3. Что делают механизмы (gate/pusher/маршрут).
4. Что происходит при аварии (jam / e-stop + recover).
5. Что это не «мультфильм»: proof HUD, журнал, метрики.

Целевые свойства:

- визуально реалистичный industrial twin;
- физически правдоподобное (хотя бы кинематически согласованное) движение;
- стабильные 30–60 FPS в режиме demo;
- one-command start + health;
- откат через git tag;
- production = тот же билд, что прошёл тесты.

---

## 3. Этапы

| # | Этап | Приоритет | Сложность | Статус | Ожидаемый эффект |
| - | ---- | --------- | --------- | ------ | ---------------- |
| E1 | Wire `classifyItem` в continuous | P0 | Низкая | **Done** | Доверие к алгоритму |
| E2 | Measurement + DIMENSION_LIMITS + confidence | P0 | Средняя | **Done** | Корректные min dims, reason |
| E3 | Playlist 8→10 + fault timelines | P0 | Средняя | **Done** | Safety story для жюри |
| E4 | Fault freeze/recover + seeded jitter | P1 | Средняя | **Done** | Правдоподобие / воспроизводимость |
| E5 | Demo controls + presentation + journal | P0 | Средняя | **Done** | Управление показом |
| E6 | Quality modes | P1 | Низкая | **Done** | FPS на слабых клиентах |
| E7 | Proof HUD + CV RULE overlay | P0 | Средняя | **Done** | «Видно почему» |
| E8 | simulation tests jam/estop/c_priority | P1 | Низкая | **Done** | Регрессионная защита |
| E9 | Agent MVP + scripts | P1 | Средняя | **Done** | Ops / future autonomy |
| E10 | resolveItem SKU-*-LC | P2 | Низкая | **Done** | Стабильность данных |
| E11 | Унификация визуала `/` и `/details` | P1 | Высокая | **Open** | Единый образ системы |
| E12 | Redeploy prod dist на :3100 | P0 | Низкая (ops) | **Open** | Публичная демо актуальна |
| E13 | Playwright в CI (1 worker) | P2 | Средняя | **Open** | Авто-регрессия UI |
| E14 | Опциональный physics (Rapier lite) | P3 | Высокая | **Open** | Доп. fidelity (не блокер) |
| E15 | Agent auto-patch за human gate | P3 | Высокая | **Open** | Автономия уровня 2 |

---

## 4. Приоритет (матрица)

| Приоритет | Фокус |
| --------- | ----- |
| P0 | То, без чего живой показ врёт или ломается: классификация, proof, faults, controls, prod sync |
| P1 | Убедительность и стабильность: quality, tests, twin unify, agent ops |
| P2 | Удобство и покрытие: e2e CI, data edge cases |
| P3 | Исследования: real physics, full autonomous implementer |

---

## 5. Ожидаемый эффект по направлениям

| Направление | Эффект Done-этапов | Остаточный разрыв |
| ----------- | ------------------ | ----------------- |
| Demo clarity | Высокий — seek/hotkeys/presentation | — |
| Algorithm proof | Высокий — live classify + HUD | Pseudo-CV всё ещё |
| Fault story | Высокий — jam/e-stop в playlist | — |
| Visual realism | Средний+ | Dual twin, нет AO/heavy PBR |
| Physics fidelity | Средний | Нет rigid body |
| Ops | Высокий — scripts + agent | Redeploy path вне docker CLI |

---

## 6. Сложность оставшихся работ

| Работа | Сложность | Зависимости | Риск |
| ------ | --------- | ----------- | ---- |
| Unify twins | Высокая | Общий scene kit, не ломая оба маршрута | Регрессия `/details` |
| Prod redeploy | Низкая | Доступ к docker/host вне среды | Забыть обновить tunnel cache |
| e2e CI | Средняя | 1 worker, артефакты | Flaky screenshots |
| Rapier | Высокая | Performance budget | FPS падение |
| Agent patcher | Высокая | Safety limits, staging | Порча ветки |

---

## 7. Риски плана

| Риск | Митигация |
| ---- | --------- |
| Погоня за «настоящей физикой» убивает FPS | Держать кинематику; physics только opt-in |
| Унификация twin ломает details UX | Feature flag / поэтапный shared module |
| Агент без лимитов | Kill switch + forbid deploy |
| Показ со старым prod | `demo:health` + явный checklist redeploy |

---

## 8. Зависимости

```text
E12 (redeploy) зависит от зелёных tests/build на feature-ветке
E11 (unify) зависит от стабильного continuous twin (E1–E7 Done)
E13 (e2e CI) зависит от ёмкости (1 worker) и стабильных селекторов
E15 (agent patch) зависит от E9 + AI_AGENT_SAFETY_LIMITS
```

---

## 9. Критерии приёмки

### Must (для «максимальной демо» итерации)

- [x] Continuous использует `classifyItem` (не только playlist label).
- [x] Playlist ≥10 с jam и emergency_stop.
- [x] Proof HUD показывает DIM, K, reason.
- [x] Hotkeys + speed + seek + presentation работают.
- [x] Quality modes существуют и покрыты тестами.
- [x] Vitest зелёный (≥153).
- [x] Build OK.
- [x] Backup tag существует.
- [ ] Production https://arhipovdan.ru/ отдаёт новый dist (**Open**).

### Should

- [ ] Визуальный parity ключевых элементов `/` и `/details`.
- [ ] Playwright smoke в CI (1 worker).

### Could

- [ ] Лёгкий physics layer.
- [ ] Agent auto-patch с обязательным human merge.

---

## 10. Рекомендуемый порядок дожима

1. Redeploy production (E12) — максимальный ROI для жюри.  
2. Visual unify twin (E11) — доверие «одной системы».  
3. e2e smoke (E13).  
4. Остальное — по необходимости.
