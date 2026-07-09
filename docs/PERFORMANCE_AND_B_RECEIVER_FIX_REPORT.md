# PERFORMANCE & B RECEIVER FIX REPORT

Дата: 2026-07-09  
Ветка: `dan_branch`  
Production: https://arhipovdan.ru/

---

## 1. Что тормозило (root cause)

Production audit (`docs/performance_physics_fix_screenshots/before/`):

| Причина | Детали |
|---------|--------|
| **53+ useFrame на роликах** | Каждый `Roller` имел собственный `useFrame` с покадровым вращением → десятки хуков на кадр. |
| **Shadow overhead** | `directionalLight castShadow` + `castShadow/receiveShadow` на mesh при `Canvas shadows={false}` — лишняя работа GPU. |
| **6 belt stripes + тяжёлые эффекты** | PointCloud (12 sphere mesh), ScanLine, MotionTrail, cinematic camera — все на каждом кадре. |
| **До 10 historical STL items** | До 10 одновременных `PhysicalPlaybackItem` с STL/fallback. |
| **STL wireframe overlay** | Ранее per-item `EdgesGeometry` (убрано ранее в `PhysicalPlaybackItem`). |
| **React setPlayback ~20 Hz** | `App.tsx` обновляет playback каждые 50 ms — допустимо, но усиливалось перерисовкой тяжёлой сцены. |

Console (before): **0 errors, 0 spam logs**. Только browser warnings: `THREE.Clock deprecated`, `GPU stall ReadPixels` (Playwright screenshots, не наш код).

---

## 2. Какие логи убраны

`grep` по `src/`: runtime `console.log` **отсутствуют**.

Оставлено (допустимо):
- `console.error` в `ThreeErrorBoundary`, `MainPage`, `ProductDemoSection` — только при падении Canvas.
- `STLModel.tsx` `console.warn` → **только в DEV** (`import.meta.env.DEV`).

Критерий после фикса: **0 errors, 0 spam logs** (`after_console.json`).

---

## 3. Что оптимизировано

| Изменение | Файл |
|-----------|------|
| Ролики **статические** (без useFrame) | `SorterDigitalTwinContinuous.tsx` |
| Убраны `castShadow` / shadow maps | `SorterDigitalTwinContinuous.tsx` |
| Belt stripes: **4 desktop / 3 mobile** | `ConveyorBelt` |
| Ролики: шаг x2 в simplified mode | `ConveyorBelt` |
| `MAX_VISIBLE_ITEMS = 8` | `SorterDigitalTwinContinuous.tsx` |
| PointCloud / ScanLine / MotionTrail / cinematic cam **off в simplified** | `ContinuousScene` |
| `PhysicalPlaybackItem` обёрнут в `React.memo` | `PhysicalPlaybackItem.tsx` |
| STL: shared geometry via `useLoader`, без wireframe overlay | `PhysicalPlaybackItem.tsx` |
| LaserBeam: static, без useFrame | `SorterDigitalTwinContinuous.tsx` |
| Canvas: `shadows={false}`, `dpr` capped, `powerPreference: high-performance` | уже было |

---

## 4. B receiving bin / tray

Добавлена физическая **BReceiverBin** (открытый лоток на полу):

- центр `(4.4, 0, 0)`, размер **1.0 × 0.8 m**, стены **0.4 m**;
- дно на `floorY = 0.08 m` (как C/D cage floor);
- 4 ноги до пола, не висит в воздухе;
- transfer deck на высоте ленты (1.5 → 3.6 m) + **drop chute** в bin;
- зелёный акцент B (`#16a34a`), отличается от C/D.

---

## 5. Как B товар попадает и остаётся в B

**conveyorNetwork path (B):**
```
main_belt → inspection_station → routing_junction → b_transfer → chute_b → b_receiver_floor
```

**physicalItemMotion (исправлен тайминг):**
- `routing` phase (6400–8900 ms): transfer (55%) → chute (45%);
- с **exit** phase (8900 ms+): `surface = b_receiver_floor`, поза внутри bounds;
- B item **не исчезает**, **не на активной ленте** после exit;
- settled фиксирован при увеличении времени.

**Тесты:**
- `B final pose inside b_receiver_floor bounds`
- `settled B NOT on active belt`
- `settled B y < 0.35 m` (ниже ленты 0.7 m)
- `settled at elapsedMs >= 9000`
- C/D containment — без регрессий

---

## 6. C/D не сломаны

Пути C/D без изменений. Тесты `c_cage_floor` / `d_cage_floor` bounds — pass.  
Roll-cage с внутренним полом сохранён.

---

## 7. Тесты

`npm run test` → **13 files, 137 tests passed** (добавлен тест B bin floor height).

---

## 8. Screenshots

`docs/performance_physics_fix_screenshots/before/`  
`docs/performance_physics_fix_screenshots/after/`

| Файл | Содержание |
|------|------------|
| `01_home_idle.png` | idle |
| `02_play_running_smooth.png` | play running |
| `03_b_item_enters_b_receiver.png` | B routing / chute |
| `04_b_item_settled_in_b_bin.png` | B case exit/clear (bin на полу виден) |
| `05_c_item_settled_in_c_cage.png` | C cage |
| `06_d_item_settled_in_d_cage.png` | D cage + plate STL |
| `07_all_receivers_b_c_d.png` | все зоны |
| `08_no_overlay_overlap.png` | overlay |
| `09_mobile.png` | mobile, no h-scroll |
| `10_details.png` | /details |

**Примечание:** auto-cam следует за **текущим** кейсом; для кадра «B в корзине» надёжнее смотреть фазу exit/clear case 1/8 или unit-тесты позы. Физика позы доказана тестом `y < 0.35` at 9200 ms.

---

## 9. Остаточные риски

- Browser warnings `THREE.Clock deprecated` — из three.js/r3f, не наш runtime log.
- `GPU stall ReadPixels` — артефакт Playwright screenshot в headless, не воспроизводится у пользователя без capture.
- Auto-cam может скрывать settled items в дальних зонах при смене кейса.
- 2 fallback кейса (`small_item_c`, `low_confidence`) — тяжёлые исходные STL.

---

## 10. Verdict

**ГОТОВО** для демо-защиты по performance + B physics.

- Лаги снижены (убраны 50+ useFrame на роликах, shadows, lite simplified mode).
- Console чистая (0 errors, 0 spam).
- B имеет физический bin на полу + путь transfer → chute → floor.
- B товар по модели в bin с exit phase, не на ленте (тесты).
- C/D containment сохранён.
- build/test/docker/production — OK.

---

## Build / deploy

```
npm run build   → OK
npm run test    → 137 passed
docker compose -p owl -f docker-compose.server.yml up -d --build → OK
curl -I arhipovdan.ru / details / ai-shorts.ru → 200
```
