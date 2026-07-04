# Demo Script

Open https://arhipovdan.ru/ (или http://127.0.0.1:3100/).

Страница — product demo: Hero → Demo → Storyline → Scenarios → Criteria → Engineering Details.

## 30-Second Pitch

«Мы сделали инженерную симуляцию сортировочной ячейки OZON. Полный цикл: detection → classification → command → routing. Показываем happy path B/C/D, fault handling и timing. Главный экран — product demo, инженерные панели ниже.»

## 3-Minute Demo

1. На первом экране укажите Hero: что это за система и цепочку Detection → Classification → Command → Routing.
2. Нажмите **Запустить демо**.
3. В блоке **Главное демо** покажите упрощённую сцену и карточку результата:
   - товар;
   - категория B/C/D;
   - причина решения;
   - команда `ROUTE_TO_*`;
   - целевая зона.
4. Нажимайте **Next step**, следите за **Этапами цикла**.
5. В **Сценариях** нажмите **Показать** на «Негабарит» — приоритет C.
6. Затем «Круглый объект» — зона D.
7. Затем «Застревание» или «Аварийная остановка» — FAULT / EMERGENCY_STOP, Reset.

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

## What Each Block Proves

- Hero — смысл проекта за 10 секунд.
- Product Demo scene — физический маршрут и команда.
- Proof card — почему выбрана категория B/C/D.
- Storyline — текущий этап цикла.
- Scenario cards — jury test cases без узкого скролл-списка.
- Criteria cards — покрытие критериев OZON.
- Engineering Details — timeline, PID, event log, sensors.
