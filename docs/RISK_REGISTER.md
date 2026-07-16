# Реестр рисков (Risk Register)

**Проект:** OZON Tech Sorter Simulation
**Дата:** 2026-07-15
**Ветка:** `feature/maximum-demo-realism`

Шкала: вероятность / влияние = Low · Medium · High · Critical.
Статус: Open · Mitigated · Accepted.

---

## 1. Сводная таблица

| ID | Риск | Вероятность | Влияние | Статус | Митигация |
| -- | ---- | ----------- | ------- | ------ | --------- |
| R01 | Production :3100 / arhipovdan.ru | Medium | Critical | Partially mitigated | Local+tunnel on `4fcce5b`+version.json; domain still BLOCKED_EXTERNAL |
| R18 | Tunnel/cloudflared outage / permanent DNS | High | Critical | Open | Quick Tunnel kept; Named Tunnel needs CF login — `CLOUDFLARE_NAMED_TUNNEL_SETUP.md` |
| R21 | Hardware GPU baseline недоступен в coder | High | Medium | Accepted | `BLOCKED_BY_DISPLAY_ENVIRONMENT`; portable `perf:browser` |
| R22 | DNS NS cutover теряет MX/TXT | Medium | High | Open | `DNS_MIGRATION_INVENTORY.md` — check REG.RU panel before NS change |
| R02 | Визуальный разрыв `/` vs `/details` путает жюри | Medium | High | Mitigated | `sharedLayout` + routeConsistency tests |
| R03 | Жюри воспринимает кинематику как «фейк» | Medium | High | Mitigated | Proof HUD + честные формулировки; jam/e-stop |
| R04 | Pseudo-CV раскрыт как «обман» | Medium | Medium | Accepted | RULE overlay + confidence; не обещать ML |
| R05 | Просадка FPS на ноутбуке жюри | Medium | High | Mitigated | quality modes; `?perf=1`; SwiftShader ≠ GPU |
| R06 | Регрессия classifier/min dims | Low | Critical | Mitigated | tests 166; measurement+DIMENSION_LIMITS |
| R07 | Fault freeze без recover ломает показ | Low | High | Mitigated | recover path + hotkeys R/N |
| R08 | Agent/фоновые job портят ресурсы во время демо | Medium | High | Mitigated | kill switch; runbook stop |
| R09 | Будущий auto-patch агента ломает main | Low (сейчас) | Critical | Mitigated | forbid merge/deploy; MVP verify-only |
| R10 | Утечка секретов `.env` в отчёты/логи | Low | Critical | Mitigated | policy forbidSecretAccess; не документировать values |
| R11 | Нет e2e в CI — UI регрессия незамечена | Low | Medium | Mitigated | CI + 10 visual snapshots; production smoke manual |
| R12 | OOM при локальной LLM + Playwright | Medium | High | Accepted (avoid) | Variant C; не совмещать |
| R13 | Disk fill отчётами/скриншотами | Low | Medium | Open | ротация reports |
| R14 | Нет docker CLI в operator env | High (факт) | Medium | Accepted | `DOCKER_HOST=tcp://127.0.0.1:2375` |
| R15 | Swap thrash под нагрузкой | Low | High | Mitigated | лимиты 1 worker; demo mode без фона |
| R16 | Расхождение playlist expectedCategory и classifyItem | Low | High | Mitigated | wire classifyItem; tests |
| R17 | STL/fallback выглядят «игрушечно» | Medium | Low | Accepted | modelAssets notes; backlog textures |
| R18 | Tunnel/cloudflared outage / permanent DNS | High | Critical | Open | Quick Tunnel temp; Named Tunnel + REG.RU DNS required |
| R19 | Несогласованность документации и кода | Medium | Low | Mitigated | этот пакет docs = snapshot 2026-07-15 |
| R20 | Попытка «добавить physics» перед показом → регрессия | Medium | High | Open | запрет P0-physics перед demo day |
| R21 | Hardware GPU baseline недоступен в coder | High | Medium | Accepted | NVIDIA есть, Chromium→SwiftShader; измерять на demo laptop |
---

## 2. Детали по критическим рискам

### R01 — Устаревший production dist

**Симптом:** локально proof/hotkeys есть, на https://arhipovdan.ru/ — нет.
**Детектор:** сравнить UI; `demo:health`; hash файлов в контейнере (если доступен docker на хосте).
**Реакция:** ручной redeploy; на показе переключиться на проверенный preview.
**Тип данных о риске:** подтверждён аудитом как **процессный** факт («may still serve OLD dist»).

### R09 — Автономный агент vs production

**Симптом:** гипотетический merge/deploy без человека.
**Текущий контроль:** `forbidMergeToMain`, `forbidProductionDeploy`, нет Implementer auto-patch.
**Остаточный риск:** появится при расширении MVP без обновления safety caps.

### R10 — Секреты

`.env` содержит ключи `login`, `password`, `url`. Значения не подлежат публикации. Любой новый tooling обязан редact’ить env.

---

## 3. Риски ёмкости (связь с SERVER_CAPACITY_REPORT)

| Риск | Вывод |
| ---- | ----- |
| 24/7 agent | Возможен **с ограничениями** |
| Local 7B+ | Тяжело; предпочтителен API |
| Playwright | Да, 1 worker |
| CV training | Лучше external GPU |
| Server 3D | Не нужен |

---

## 4. Матрица приоритета обработки

```text
Сначала:  R01 (prod sync), R18 (tunnel fallback plan)
Потом:    R02 (twin unify), R11 (e2e), R13 (disk hygiene)
Следить:  R05/R08 во время каждого показа
Не трогать в demo week: R20 (physics spike)
```

---

## 5. Accepted risks (осознанно)

| ID | Почему принимаем |
| -- | ---------------- |
| R04 | Архитектура MVP Track 3 — pseudo-CV by design |
| R12 | Не запускаем локальную LLM 24/7 |
| R14 | Ограничение окружения; обход через внешний deploy |
| R17 | ROI текстур ниже proof/controls |

---

## 6. Триггеры пересмотра реестра

- Смена хоста/GPU/RAM.
- Включение Implementer auto-patch.
- Добавление physics engine.
- Подключение реального CV inference.
- Появление CI e2e.
- Инцидент на живом показе.

---

## 7. Вывод

Главный необработанный операционный риск для жюри — **R01 (старый prod dist)**. Технические риски демо-контура в основном **смягчены** итерацией maximum-demo-realism. Риски полной автономии агента **заблокированы политикой**, пока MVP verify-only.
