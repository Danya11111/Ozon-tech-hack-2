# Лимиты безопасности AI-агента

**Файл реализации лимитов:** `agent/cli.mjs` → объект `LIMITS`  
**Дата:** 2026-07-15  

Документ обязателен к соблюдению при любом расширении агента за пределы MVP.

---

## 1. Однозначная политика

| Действие | Разрешено автоматически? |
| -------- | ------------------------ |
| Читать репозиторий, запускать tests/build | Да |
| Писать отчёты в `agent/reports` | Да |
| Планировать задачи (dry-run) | Да |
| Патчить исходники (MVP) | **Нет** |
| Merge в `main`/`master` | **Никогда** |
| Deploy production (:3100 / tunnel) | **Никогда** |
| Печать значений секретов / `.env` | **Никогда** |
| Менять firewall/SSH/системные секреты | **Никогда** |
| Force-push | **Никогда** |

---

## 2. Числовые лимиты (MVP)

| Параметр | Значение | Смысл |
| -------- | -------: | ----- |
| `maxCycleMinutes` | 25 | Стена времени одного цикла |
| `maxChangedFiles` | 12 | Потолок будущего патча |
| `maxDiffLines` | 800 | Анти-мегадифф |
| `maxParallelWorkers` | 1 | Ёмкость сервера |
| `dailyLlmBudgetUsd` | 5 | Бюджет API |
| `minScoreDelta` | 0 | Порог «улучшения» для accept (будущее) |
| `requireTestsPass` | true | Gate |
| `requireBuildPass` | true | Gate |
| `forbidMergeToMain` | true | Hard |
| `forbidProductionDeploy` | true | Hard |
| `forbidSecretAccess` | true | Hard |

Playwright (когда будет в цикле): **1 worker**, не параллелить с локальной LLM.

---

## 3. Kill switch

| Операция | Команда / файл |
| -------- | -------------- |
| Остановить | `node agent/cli.mjs stop` → создаёт `agent/state/KILL` |
| Возобновить | `node agent/cli.mjs resume` → удаляет KILL |
| Пауза статуса | `node agent/cli.mjs pause` |

При наличии `KILL` режимы `dry-run` / `run-once` завершаются с ошибкой.

**Перед живой демонстрацией:** всегда `stop`.

---

## 4. Изоляция изменений

| Правило | Деталь |
| ------- | ------ |
| Ветка | Только `feature/*` или `agent/*`; не `main` |
| Backup | Тег `backup/pre-maximum-demo-realism-20260715` уже создан |
| Worktree (рекомендация L2) | Отдельный worktree для патчей |
| Production dist | Не трогать volume/nginx без человека |
| Preview | `:3101` допустим для проверки; не путать с `:3100` |

---

## 5. Что можно / нельзя автоматизировать

### Безопасно автоматизировать

- Запуск Vitest и production build.  
- Генерация JSON-отчётов и scorecard.  
- Обновление backlog приоритетов.  
- Health-check URL (без секретов).  
- Сбор метрик размеров `dist` (без PII).

### Только с проверкой человека

- Любой diff по `src/`.  
- Изменение demo playlist / classifier thresholds.  
- Включение shadows/effects (FPS).  
- Зависимости `package.json`.  
- Nginx/Docker/Compose манифесты.  
- Создание PR (без auto-merge).

### Никогда автоматически

- Merge в main.  
- Deploy на https://arhipovdan.ru/ / :3100.  
- Ротация credentials, правка `.env`.  
- `git push --force`.  
- Отключение или ослабление тестов «чтобы стало зелёным».  
- Удаление backup-тегов.  
- Запуск локальной LLM параллельно с демо-нагрузкой.

---

## 6. Журналирование и аудит

| Артефакт | Требование |
| -------- | ---------- |
| `audit.jsonl` | Append-only; каждое start/stop/complete |
| Reports | Хранить hypothesis, decision, limits snapshot |
| Запрет | Значения `login`/`password`/`url` из `.env` |

При инциденте: приложить `status.json` + хвост `audit.jsonl` + `latest.json` **без** `.env`.

---

## 7. Ресурсные лимиты хоста (операционные)

Согласовано с `SERVER_CAPACITY_REPORT.md`:

| Ресурс | Лимит для агента |
| ------ | ---------------- |
| Workers | 1 |
| RAM budget | ≤4 GiB суммарно с Chromium |
| GPU | не обязателен; не держать 7B 24/7 |
| Расписание | не во время режима «Демонстрация» |
| Disk | ротация старых `agent/reports` при росте |

---

## 8. Реакция на отказы

| Ситуация | Действие агента |
| -------- | --------------- |
| Tests red | `REJECT_BASELINE`, не планировать фичи |
| Build red | то же |
| Kill switch | немедленный выход |
| Budget exceeded | stop + report |
| Попытка deploy/merge | невозможна в коде MVP; при добавлении — hard fail |

---

## 9. Чеклист расширения Implementer (уровень 2)

Перед включением auto-patch обязательно:

1. [ ] Отдельный git worktree.  
2. [ ] Проверка `forbidMergeToMain` интеграционными тестами агента.  
3. [ ] Max files/diff enforced до `git commit`.  
4. [ ] Авто-PR без auto-merge.  
5. [ ] Visual QA optional flag, default off on demo days.  
6. [ ] Документированный human approver.

Пока пункты не выполнены — Implementer остаётся **выключенным** (текущее состояние).

---

## 10. Вывод

Безопасность агента важнее скорости итераций. На OwlPrime допустим только **узкий, наблюдаемый, обратимый** контур. MVP это соблюдает: verify-only + kill switch + запрет prod.
