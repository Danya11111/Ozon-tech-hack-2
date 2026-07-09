# FINAL PHYSICS FIX REPORT — 3D Demo Conveyor Network

Дата: 2026-07-09
Ветка: `dan_branch`
Production: https://arhipovdan.ru/ · https://arhipovdan.ru/details

---

## 1. Root causes confirmed

Подтверждено на production (`docs/final_physics_fix_screenshots/before/`) и в коде:

| # | Проблема | Root cause в коде |
|---|----------|-------------------|
| 1 | Движение ленты «жило отдельно» от товара | `BeltStripe` двигался через `useFrame` с покадровым инкрементом `posRef += delta * speedFactor` — отдельный источник, зависящий от FPS и не связанный с позицией товара. |
| 2 | B-товар исчезал после сортировки | В `PhysicalPlaybackItem` стоял ранний `return null` для `isSettled && expectedCategory === 'B'`. Физической приёмной зоны B не было — только плоский `ZoneMarker`. |
| 3 | Геометрия движения разбросана | Все координаты (belt, chute, cage) считались ad-hoc внутри `physicalItemMotion` через `ZONES.*`, без единой модели поверхностей. Не было единого «источника правды». |
| 4 | Кубик вместо STL для c_priority | `SKU-011` был помечен `loaderType: 'procedural'`, хотя round STL (`cylinder.stl`, 106 KB) доступен. |
| 5 | Слабый contain в cage | `cageFloorY` был захардкожен `0.1`, cage не имел видимого внутреннего пола — товар выглядел «висящим». |

---

## 2. Conveyor network surfaces

Создан единый источник правды: **`src/domain/conveyorNetwork.ts`**.
Все координаты в метрах (1 unit = 1 m).

| Surface | start → end (m) | surfaceY | width | speed | target |
|---------|-----------------|----------|-------|-------|--------|
| `main_belt` | A(-4,0) → CAMERA(-1.5,0) | 0.70 | 0.5 | 1.0 m/s | — |
| `inspection_station` | CAMERA (dwell) | 0.70 | 0.5 | 0 | — |
| `routing_junction` | CAMERA(-1.5) → GATE(1.5) | 0.70 | 0.5 | 1.0 m/s | — |
| `b_receiver` | GATE(1.5) → rest(4.0) | 0.70 | 0.5 | 1.0 m/s | B |
| `chute_c` | GATE edge(0.25z) → cage C front | 0.70→0.13 | 0.5 | 0.5 m/s | C |
| `chute_d` | GATE edge(-0.25z) → cage D front | 0.70→0.13 | 0.5 | 0.5 m/s | D |
| `c_cage_floor` | C(2.0, 2.0) | 0.08 | 1.2 | 0 | C |
| `d_cage_floor` | D(2.0, -2.0) | 0.08 | 1.2 | 0 | D |

Пути:
- **B**: `main_belt → inspection_station → routing_junction → b_receiver → settled_b`
- **C**: `main_belt → inspection_station → routing_junction → chute_c → c_cage_floor → settled_c`
- **D**: `main_belt → inspection_station → routing_junction → chute_d → d_cage_floor → settled_d`

Каждая поверхность имеет `bounds` (minX/maxX/minZ/maxZ) для containment-проверок.

---

## 3. Physical motion model

`src/domain/physicalItemMotion.ts` полностью переписан и теперь берёт **всю геометрию только из `conveyorNetwork`**:

- поза считается детерминированно от `elapsedMs` (без random, без покадровых инкрементов);
- позиция = интерполяция вдоль текущего segment (`lerp3`);
- `y = surfaceY + itemHeight / 2` (низ товара точно на поверхности);
- `rotation` = heading текущей поверхности (`surfaceHeading`);
- на `main_belt`/`routing_junction` скорость = **1 м/с**;
- на chute — плавный спуск по наклонной (0.5 м/с), не полёт;
- в cage товар фиксируется в детерминированном slot (grid 3×2 внутри bounds);
- `isSettled = true` только на `b_receiver`/`c_cage_floor`/`d_cage_floor` после завершения кейса;
- защита от NaN/Infinity.

Убраны все конкурирующие источники движения: `BeltStripe` больше не использует покадровый инкремент.

---

## 4. B receiving zone

Добавлен физический приёмный лоток **`BReceiver`** (в `SorterDigitalTwinContinuous.tsx`):

- короткий downstream receiving tray сразу после сортировщика;
- ширина 0.5 m, верхняя поверхность 0.7 m (на уровне ленты, не «платформа в воздухе»);
- невысокие борта (0.12 m) + торцевой стоп;
- опорные ноги до пола;
- B-товар доезжает по лотку и **остаётся** в нём (ранний `return null` удалён).

Константы: `B_RECEIVER` в `physicalLayout.ts` (`startX 2.2 → endX 4.4`, `restX 4.0`).

---

## 5. C/D containment

- `RollCage` получил **сплошной внутренний пол** на `CAGE_FLOOR_Y` (0.08 m), товар физически лежит на нём.
- cage стоит на полу (колёса), есть нижняя/верхняя рамка, вертикальные стойки, wireframe-стенки.
- вход — со стороны chute (front edge cage).
- после chute товар оказывается внутри `bounds`, распределяется по slot-grid, не выше верхней границы, после settled cage не покидает.
- проверено тестами: финальная поза C/D внутри `c_cage_floor` / `d_cage_floor` bounds, `y = CAGE_FLOOR_Y + h/2`.

---

## 6. STL / fallback table

| case | itemId | model path | STL / fallback |
|------|--------|-----------|----------------|
| box_b | SKU-001 | `/models/box-300.stl` | **STL** (29 KB) |
| lunchbox_b | SKU-002 | `/models/lunchbox.stl` | **STL** (566 KB) |
| oversized_box_c | SKU-004 | `/models/box-400.stl` | **STL** (27 KB) |
| small_item_c | SKU-009 (Ручка) | — | fallback thin box (исходный STL 2.0 MB — тяжёлый) |
| plate_d | SKU-006 | `/models/plate.stl` | **STL** (123 KB) |
| bottle_d | SKU-007 | `/models/bottle.stl` | **STL** (319 KB) |
| c_priority | SKU-011 | `/models/cylinder.stl` | **STL** (106 KB, round STL reused) |
| low_confidence | SKU-003 (Моющее ср-во) | — | fallback box (исходный STL 3.5 MB — тяжёлый) |

**Итог: 6/8 кейсов используют реальные STL.** 2 fallback — честные (исходные STL >2 MB, исключены по WebGL performance budget). Все 6 доступных лёгких STL используются.

---

## 7. Belt sync proof

- Формула ленты: `stripe.x = baseOffset + (time * CONVEYOR_SPEED_MPS) mod beltLen` — та же скорость 1 м/с, то же направление, что и товар.
- Детерминированно от `totalElapsedMs`: pause → лента и товар замирают; stop → оба reset (0).
- Не зависит от FPS (нет `delta`-инкремента).
- Unit-test: товар на `main_belt` за 1000 ms смещается ровно на **1.0 m** (`±0.02`).

Debug (из модели, height 0.2 m):
- t0 = 300 ms → item.x = −4.00 m (A)
- t1 = 1300 ms → item.x = −3.00 m
- Δx = **1.00 m за 1.00 s** ✓

Скриншоты: `02_belt_sync_t0.png`, `03_belt_sync_t1_delta_1m.png`.

---

## 8. Tests

`npm run test` → **13 файлов, 132 теста passed.**

Новые/обновлённые:
- `src/domain/conveyorNetwork.test.ts` — все surfaces присутствуют; конечные координаты/bounds; belt=1 м/с, cage/junction статичны; chute медленнее ленты, но >0; path per category; bounds-check; chute имеет реальную длину.
- `src/domain/physicalItemMotion.test.ts` — старт на main_belt; **1 m за 1 s**; низ товара = surfaceY; детерминизм; B внутри b_receiver; C внутри c_cage; D внутри d_cage; settled не двигается; нет NaN/Infinity по всему таймлайну; C едет по chute перед settle.
- `src/data/modelAssets.test.ts` — все 6 доступных demo-STL замаплены на реальные пути; fallback явные.

---

## 9. Production QA

- `npm run build` → OK.
- `npm run test` → 132 passed.
- `docker compose -p owl -f docker-compose.server.yml up -d --build` → `owl-web-1` recreated & started.
- `curl -I` → `https://arhipovdan.ru/` **200**, `https://arhipovdan.ru/details` **200**, `https://ai-shorts.ru/` **200**.
- Playwright прогон полного цикла 8 сценариев:
  - Play запускает, все 8 кейсов доходят до отображения;
  - **console errors: NONE**;
  - товар не летит / не телепортируется (виден спуск по chute — `05_chute_c_motion.png`);
  - STL видны на ленте и на chute;
  - B-товар остаётся в приёмном лотке;
  - mobile: `scrollWidth == clientWidth == 390` → **горизонтального scroll нет**.

---

## 10. Screenshots

`docs/final_physics_fix_screenshots/before/` — before (хаос, нет B-зоны, исчезновение товара).
`docs/final_physics_fix_screenshots/after/`:
- `01_stl_box_on_belt.png` — STL короб на ленте;
- `02_belt_sync_t0.png`, `03_belt_sync_t1_delta_1m.png` — синхронизация ленты (Δ≈1 m);
- `04_b_receiver_item_settled.png` — B receiving tray;
- `05_chute_c_motion.png` — STL короб съезжает по chute C;
- `06_item_inside_c_cage.png` — C roll-cage;
- `07_chute_d_motion.png`, `08_item_inside_d_cage.png` — маршрут/cage D;
- `09_all_zones_physical.png` — все зоны (A, belt, inspection, B-tray, C/D cages);
- `10_no_overlay_overlap.png` — HUD и CV overlay не перекрываются;
- `11_mobile.png` — mobile (2D fallback, single column, без h-scroll);
- `12_details.png` — /details.

---

## 11. Remaining risks

- `11_mobile.png` в headless-Chromium показывает 2D fallback («WebGL not available») — это ожидаемо без GPU в CI; на реальных устройствах WebGL доступен. Layout корректный, h-scroll отсутствует.
- 2 кейса (`small_item_c`, `low_confidence`) остаются fallback-примитивами: исходные STL слишком тяжёлые (2.0 / 3.5 MB) — компромисс по WebGL performance budget.
- Скорость chute (0.5 м/с) — визуальная аппроксимация наклонного спуска, не результат физического движка (по требованию physics engine не добавлялся).
- Auto-camera может ловить кадр в момент перехода фаз; поза товара при этом всегда детерминирована и корректна.

---

## 12. Honest verdict

**ГОТОВО для записи видео защиты.**

Товар всегда на физической поверхности (belt → inspection → junction → b_receiver / chute → cage), не летает, не телепортируется, не проваливается, не исчезает и остаётся в зоне. Лента и товар синхронизированы (1 м/с, детерминированно, FPS-independent). B получил физическую приёмную зону. C/D удерживают товар. 6/8 STL реальны, 2 fallback честные. build/test/docker/production — зелёные, console без ошибок.
