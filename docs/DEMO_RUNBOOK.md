# Demo Runbook — OZON Tech Sorter Simulation

**Назначение:** провести живую демонстрацию жюри/заказчику без сюрпризов.
**Дата актуализации:** 2026-07-15
**Рабочий публичный URL (временный):** Quick Tunnel — см. `PRODUCTION_DEPLOYMENT_REPORT.md`
**Ожидаемый постоянный домен:** https://arhipovdan.ru/ — **BLOCKED_EXTERNAL** (`PUBLIC_DOMAIN_DIAGNOSTIC.md`)
**Локальный production:** http://127.0.0.1:3100/
**Репозиторий:** `/home/coder/arhipovdan/app`

---

## 1. За 30–60 минут до показа

### 1.1. Остановить фоновые помехи

```bash
cd /home/coder/arhipovdan/app
node agent/cli.mjs stop
# убедиться, что Playwright/тяжёлые job не бегут
```

### 1.2. Зелёный baseline

```bash
npm test
npm run build
```

Ожидание: Vitest **166** passed; build OK.

### 1.3. Health

```bash
npm run demo:health
```

Проверяет:

- `http://127.0.0.1:3100/` (prod loopback),
- `http://127.0.0.1:3101/` (preview, если поднят),
- `https://arhipovdan.ru/`,
- vitest.

### 1.4. Актуальный билд на том URL, который показываете

| Если показываете | Что сделать |
| ---------------- | ----------- |
| Локальный preview | `npm run demo:start` → http://127.0.0.1:3101/ |
| Публичный сайт | Убедиться, что :3100 отдаёт **новый** `dist` (ручной redeploy). Иначе жюри увидит старую версию. |

> В этой среде может не быть `docker` CLI — redeploy выполняется тем процессом, которым контейнер обычно обновляется на OwlPrime.

---

## 2. Старт одной командой

```bash
cd /home/coder/arhipovdan/app
npm run demo:start
```

Скрипт: при необходимости `npm ci`, `npm run build`, поднимает `vite preview` на **127.0.0.1:3101**.

Остановка:

```bash
npm run demo:stop
# reset: bash scripts/demo-reset.sh
```

---

## 3. Сценарий показа (рекомендуемый тайминг ~6–8 мин)

| Мин | Что делать | Что говорит оператор |
| --: | ---------- | -------------------- |
| 0:00 | Открыть `/`, включить Presentation (P/F) | «Цифровой двойник линии сортировки» |
| 0:20 | Дать continuous playback идти | «Товар едет → измеряется → классифицируется» |
| 1:00 | Указать Proof HUD (DIM, K, reason) | «Решение — правила classifyItem, не просто ролик» |
| 2:00 | Кейсы B → C → D | «Габариты / негабарит / круглое сечение» |
| 3:30 | Кейс c_priority | «C приоритетнее D» |
| 4:00 | Jam | «Затор — поток заморожен» |
| 4:40 | Emergency stop | «E-stop — safety stop» |
| 5:20 | Speed 0.5× на сложном кейсе | «Замедляем для разбора» |
| 5:50 | При необходимости `/details` | «Инженерный FSM и сенсоры» — осторожно: визуал twin другой |
| 6:30 | Q&A | Hotkeys 1–0 для прыжка к кейсу |

---

## 4. Hotkeys оператора

| Клавиша | Действие |
| ------- | -------- |
| Space | Пауза / продолжить |
| N | Следующий кейс |
| B | Предыдущий |
| R | Reset |
| P / F | Presentation / fullscreen |
| E | Журнал событий |
| 1–0 | Быстрый переход по кейсам |

Скорость: **0.5×–2×** в demo controls.

---

## 5. Playlist (10 кейсов) — шпаргалка

Порядок storytelling (см. `demoPlaylist.ts`):

1. Короб → **B**
2. ЛанчБокс → **B**
3. Негабарит → **C**
4. Мелкий item (ручка) → **C** (min dims)
5. Тарелка → **D** (K)
6. Бутылка → **D**
7. Oversized+round → **C** (priority)
8. (edge / доп. кейс по playlist)
9. **Jam**
10. **Emergency stop**

Точные id/SKU — в `src/domain/demoPlaylist.ts`.

---

## 6. Если что-то пошло не так

| Симптом | Действие |
| ------- | -------- |
| Чёрный экран / WebGL | Обновить страницу; проверить `ThreeCapabilityCheck`; снизить нагрузку (не demo на слабом GPU клиента) |
| «Не та» логика на сайте | Сравнить с preview :3101; вероятно устарел prod dist → redeploy |
| Завис после jam | R / следующий кейс; не паниковать — freeze ожидаем |
| Красные тесты утром | Не начинать показ; `npm test`, чинить на feature-ветке |
| Агент что-то пишет | `node agent/cli.mjs stop`; MVP не патчит, но stop обязателен |
| Нет сети к публичному URL | Показать loopback :3100 или preview :3101 |

Откат кода:

```bash
git checkout backup/pre-maximum-demo-realism-20260715
```

---

## 7. Что не обещать жюри

- «Настоящий CV с камеры» — нет, pseudo-CV.
- «Полный physics engine» — нет, кинематика.
- «Агент сам выкатывает в prod» — запрещено.
- «`/` и `/details` — идентичная 3D-сцена» — пока нет.

---

## 8. После показа

```bash
npm run demo:stop
node agent/cli.mjs resume   # если нужен ночной dry-run
# или оставить stop до следующего окна обслуживания
```

Собрать feedback → занести в backlog агента / issues; не коммитить секреты.
