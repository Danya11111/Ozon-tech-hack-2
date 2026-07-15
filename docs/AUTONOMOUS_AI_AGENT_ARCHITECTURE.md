# Архитектура автономного AI-агента

**Статус:** MVP реализован (`agent/cli.mjs`)  
**Вердикт ёмкости:** круглосуточный агент **возможен с ограничениями**  
**Рекомендуемый вариант LLM:** **C — гибридный** (внешний API primary; локальная 7B+ только эксперименты)

---

## 1. Цель

Агент исследует, анализирует, планирует улучшения, **проверяет** тесты/сборку, пишет отчёты и готовит безопасные следующие шаги — **без** автоматического merge в `main` и **без** production deploy.

MVP **не** выполняет auto-patch кода (verify-only / plan-only).

---

## 2. Компоненты (целевая схема брифа → фактический MVP)

| # | Компонент | Роль в брифе | MVP сейчас |
| - | --------- | ------------ | ---------- |
| 10.1 | Orchestrator | Цикл задач, лимиты, kill switch | **Есть** — `agent/cli.mjs` |
| 10.2 | Research Agent | Поиск подходов | Задел в backlog задач |
| 10.3 | Project Analyst | Анализ репо/метрик | Baseline tests+build |
| 10.4 | Planner | Выбор задачи по impact/risk | `proposeTasks()` |
| 10.5 | Implementer | Патчи | **Не авто** — human |
| 10.6 | Test Agent | Vitest/build gates | Встроено в dry-run/run-once |
| 10.7 | Visual QA | Playwright/screenshots | Scripts вручную; не в цикле MVP |
| 10.8 | Physics QA | Инварианты motion | Покрыто частично unit-тестами |
| 10.9 | Critic | Scorecard | `scoreCategories()` |
| 10.10 | Release Manager | Merge/deploy | **Запрещён** всегда |

---

## 3. Схема взаимодействия

```text
                    ┌─────────────┐
                    │ Kill switch │ agent/state/KILL
                    └──────┬──────┘
                           │ blocks
┌──────────┐   plan    ┌───▼────────┐   verify    ┌────────────┐
│ Planner  │──────────►│ Orchestrator│───────────►│ Test/Build │
└──────────┘           └───┬────────┘             └─────┬──────┘
                           │                            │
                           ▼                            ▼
                    agent/reports/*.json         ACCEPT / REJECT
                           │
                           ▼
                    Human Implementer (feature branch)
                           │
                           X ──► main / production  (forbidden auto)
```

---

## 4. Жизненный цикл задачи

1. **Ingest:** `dry-run` или `run-once`.  
2. **Baseline:** `npm test` + `npm run build`.  
3. **Propose:** выбрать задачу из backlog (impact/risk) или `stabilize-baseline`.  
4. **Score:** категории visual/physics/demo/… → total/100.  
5. **Decide:**  
   - dry-run → `PLAN_ONLY`;  
   - run-once → `ACCEPT_BASELINE` / `REJECT_BASELINE`.  
6. **Persist:** `agent/reports/<id>.json`, `latest.json`, `audit.jsonl`, `status.json`.  
7. **Stop conditions:** kill switch, красный baseline, лимиты LIMITS.

*(Будущий уровень 2: Implementer создаёт patch branch → Test → Critic → human merge.)*

---

## 5. Выбор моделей

| Вариант | Описание | Вердикт на OwlPrime |
| ------- | -------- | ------------------- |
| A. Полностью локальный | 7B+ на 2×1080 | Технически возможно, **тяжело**; риск OOM |
| B. Внешние LLM API | Планирование/код вне хоста | Хорошо, нужен бюджет и секреты вне логов |
| **C. Гибридный** | API для reasoning; локально tests/build/Playwright | **Рекомендуется** |

Локально всегда: Vitest, Vite build, git, статический preview.  
Внешне: генерация гипотез/диффов (когда Implementer появится).

---

## 6. Хранение состояния

| Путь | Назначение |
| ---- | ---------- |
| `agent/state/status.json` | Текущее состояние (idle/dry-run/…) |
| `agent/state/audit.jsonl` | Append-only журнал событий |
| `agent/state/KILL` | Аварийная остановка |
| `agent/reports/*.json` | Отчёты прогонов |
| `agent/reports/latest.json` | Последний отчёт |

Секреты из `.env` агент **не** должен читать в логи (`forbidSecretAccess: true`).

---

## 7. Очереди

MVP: **очереди нет** — один процесс, `maxParallelWorkers: 1`.  
Будущее: файловая очередь `agent/queue/` с lease и TTL, всё ещё single worker на этом хосте.

---

## 8. Безопасность

См. полный документ `AI_AGENT_SAFETY_LIMITS.md`. Кратко:

- запрет merge `main` / `master`;
- запрет production deploy;
- kill switch;
- лимиты файлов/диффа/времени цикла;
- работа только в feature-ветках;
- require green tests/build перед любым будущим патчем.

---

## 9. Бюджет

| Статья | Лимит MVP |
| ------ | --------: |
| dailyLlmBudgetUsd | 5 |
| Parallel LLM calls | 1 effective |
| Cycle wall time | ≤25 min |

Превышение бюджета → stop + report, без «догоняющих» ретраев.

---

## 10. Мониторинг

| Сигнал | Как смотреть |
| ------ | ------------ |
| Status | `npm run agent:status` / `node agent/cli.mjs status` |
| Audit | `agent/state/audit.jsonl` |
| Host load | `uptime`, `free -h` (не в агенте) |
| Demo health | `npm run demo:health` |

Во время показа жюри: `node agent/cli.mjs stop`.

---

## 11. Rollback

| Уровень | Механизм |
| ------- | -------- |
| Git code | тег `backup/pre-maximum-demo-realism-20260715`, ветки feature/* |
| Agent run | stop/kill; отчёты не мутируют prod |
| Preview | `scripts/demo-stop.sh` |
| Production | только ручной redeploy предыдущего образа/dist |

Авто-rollback кода в MVP не требуется, т.к. авто-патча нет.

---

## 12. План внедрения

| Фаза | Содержание | Статус |
| ---- | ---------- | ------ |
| 0 | Orchestrator + dry-run/run-once + limits | **Done** |
| 1 | Подключить внешний LLM к Planner (без write) | Open |
| 2 | Implementer пишет patch в `agent/work/*` branch | Open |
| 3 | Visual QA 1 worker в цикле | Open |
| 4 | Human approval gate → PR (не auto-merge) | Open |
| 5 | Staging preview auto-update | Open |
| ∞ | Production | **Никогда автоматически** |

---

## 13. Команды

```bash
npm run agent:dry-run
npm run agent:run-once
npm run agent:status
# или
node agent/cli.mjs dry-run|run-once|status|stop|resume|pause|report
./scripts/agent-dry-run.sh
./scripts/agent-run-once.sh
```

---

## 14. Вывод

Архитектура соответствует брифу на уровне **безопасного оркестратора**. Полная автономия «исследуй→патчь→деплой» на этом сервере **нецелесообразна и запрещена**. Гибридный Variant C + 1 worker + human merge — единственный устойчивый путь.
