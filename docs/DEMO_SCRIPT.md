# Demo Script

Open https://arhipovdan.ru/ (или http://127.0.0.1:3100/).

Страница — product demo: Hero → Demo → Storyline → Scenarios → C-priority → Criteria → Engineering Details.

## 30-Second Pitch

«Мы сделали инженерную симуляцию сортировочной ячейки OZON с 3D digital twin. Полный цикл: detection → classification → command → routing. Товар физически уходит в B/C/D. Physics engine не используем — motion по state machine, демо предсказуемо.»

## 7-Minute Structure

Рекомендуемый тайминг для защиты (максимум 7 минут):

- **0:00–0:20** Что это за система? ПАК предварительной сортировки, полный цикл A → CV → B/C/D.
- **0:20–0:45** Полный контур: Detection → Classification → Command → Actuator → Route.
- **0:45–1:30** Категория B: габариты проходят, нет круга, зелёный маршрут в основной сортировщик.
- **1:30–2:15** Категория C: негабаритный товар, оранжевый маршрут в roll-cage C.
- **2:15–3:00** Категория D: габариты проходят, но круг в сечении (K ≥ 0.7), фиолетовый маршрут в roll-cage D.
- **3:00–3:45** C-priority: негабаритный + круглый → всё равно C (приоритет габаритов).
- **3:45–4:30** Low confidence и fault: rule-based fallback, FAULT состояние, EMERGENCY_STOP.
- **4:30–5:30** Engineering Details: timeline, PID, sensors, event log, 3D capability check.
- **5:30–6:30** Критерии OZON и метрики: cycle time, устойчивость, воспроизводимость.
- **6:30–7:00** Ограничения MVP и развитие: real CV, physics engine, WebSocket телеметрия.

## 3-Minute Demo

1. На первом экране укажите Hero: что это за система и цепочку Detection → Classification → Command → Routing.
2. Нажмите **Запустить демо**.
3. В блоке **Главное демо** покажите **3D Digital Twin** и карточку результата:
   - товар на конвейере;
   - накопитель и stop-gate;
   - категория B/C/D;
   - команда `ROUTE_TO_*`;
   - подсветка маршрута в зону.
4. Нажимайте **Next step**, следите за **Этапами цикла** и движением в 3D.
5. В **Сценариях** нажмите **Показать** на «Негабарит» — оранжевый route C, roll-cage C.
6. Затем «Круглый объект» — фиолетовый route D.
7. Затем «Застревание» или «Аварийная остановка» — красная подсветка, FAULT / EMERGENCY_STOP, Reset.
8. При необходимости переключите **2D fallback** — логика та же.

## 5-Minute Demo

Пройдите сценарии по карточкам:

1. Обычный товар — B/C/D поток.
2. Негабарит — C.
3. Круглый объект — D.
4. Пограничные размеры — строгие min/max.
5. Низкая уверенность CV — fallback.
6. Очередь товаров — queue/spacing.
7. Застревание — FAULT.
8. Аварийная остановка — EMERGENCY_STOP.

Для каждого:

1. Нажмите **Показать**.
2. **Start demo** / **Next step**.
3. Укажите категорию, причину и маршрут на карточке результата.
4. Покажите активный шаг в Storyline Stepper.

## Engineering Details

Если жюри просит PID, event log, sensors или полный layout:

1. Нажмите **Инженерный режим** (header / hero / demo).
2. Откроется секция **Engineering Details** с полными панелями.
3. Полная сцена — `SorterScene variant="full"`.

## Что делать, если демо зависло

1. **Reset** в header или в блоке демо.
2. Выберите сценарий заново карточкой **Показать**.
3. При необходимости откройте Engineering Details и смените сценарий там.

## Fallback, если домен не открывается

1. SSH на сервер.
2. Проверьте локальный frontend:

```bash
curl -I http://127.0.0.1:3100/
```

3. Проверьте Docker:

```bash
docker compose -p owl -f /opt/arhipovdan/app/docker-compose.server.yml ps
```

## Mobile / no horizontal scroll

Перед защитой проверьте:

- 1920×1080 — hero + demo читаемы, CTA видны;
- 1440×900 — нет debug-dashboard на первом экране;
- 390×844 — одна колонка, крупные кнопки, сцена не вылезает.

В консоли:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

## 3D / WebGL

- Desktop: по умолчанию 3D Digital Twin (если WebGL есть).
- Mobile: по умолчанию 2D; 3D можно включить вручную.
- Capability check: Engineering Details → блок **3D capability check** (WebGL, FPS).
- Physics engine: **не подключён** (state-machine animation).

## What Each Block Proves

- Hero — смысл проекта за 10 секунд.
- 3D digital twin — физическая маршрутизация A → CV → gate → B/C/D.
- Proof card — почему выбрана категория B/C/D.
- Storyline — текущий этап цикла.
- Scenario cards — jury test cases без узкого скролл-списка.
- Criteria cards — покрытие критериев OZON.
- Engineering Details — timeline, PID, event log, sensors, 3D capability check.
