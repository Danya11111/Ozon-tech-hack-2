# 3D Digital Twin Rework Plan

## Текущие проблемы

### 1. Labels перекрывают объекты
- **Проблема**: `SceneLabels3D.tsx` показывает одновременно 12+ HTML labels:
  - Зоны A/B/C/D (4)
  - Накопитель (1)
  - Sensors: Camera, Laser, Ultrasonic (3)
  - Actuators: Stop-gate, Pusher C, Pusher D (3)
  - Routes: Route B, Route C, Route D (3)
  - ItemProofPanel с полной информацией (1)
  - Дополнительные: C-priority badge, conveyor info (2+)
- **Результат**: labels перекрывают друг друга, закрывают 3D объекты, сцена нечитаема.
- **Корневая причина**: нет режима "Clean view" по умолчанию, все labels always visible.

### 2. Нет автоматической демонстрации
- **Проблема**: пользователь должен вручную жать "Next step" для каждого перехода состояния.
- **Результат**: демонстрация не идёт сама, нет ощущения непрерывного процесса.
- **Корневая причина**: `ProductDemoSection.tsx` управляется вручную через `onNext()`, нет auto-play loop.

### 3. Не используются реальные 3D модели товаров
- **Проблема**: `Item3D.tsx` использует только примитивы:
  - `isRound ? <cylinderGeometry> : <boxGeometry>`
  - Нет загрузки STL/GLB моделей из `input_info/extracted/Stl/`
- **Результат**: бутылка выглядит как цилиндр, тарелка как цилиндр, короб как куб — все одинаково.
- **Доступно**: 11 STL файлов реальных товаров в `input_info/extracted/Stl/`

### 4. Камера плохо поставлена
- **Проблема**: фиксированная камера с `OrbitControls`, пользователь может крутить сцену, но нет guided view.
- **Результат**: непонятно, на что смотреть в данный момент.
- **Нужно**: camera presets для разных этапов (detection, gate, routing, result).

### 5. Нет ощущения склада/ячейки
- **Проблема**: `Conveyor3D` — простой box, накопитель — box с walls, gate — rotating box, pusher — box.
- **Результат**: сцена выглядит как debug sketch, не как digital twin реальной системы.
- **Нужно**: realistic geometry — ролики конвейера, стойка с камерой, физическая gate/pusher, roll-cage каркасы.

### 6. Маршрутизация не очевидна
- **Проблема**: `RouteArrows3D` показывает три route beams всегда, активный чуть ярче.
- **Результат**: не видно, что товар физически движется по маршруту.
- **Нужно**: animated item motion по активному route, показать физический путь B/C/D.

### 7. Gate/Pusher не выглядят как реальные механизмы
- **Проблема**: `Actuator3D` — gate поворачивается на угол, pusher двигается по Z.
- **Результат**: не понятно, как это работает в реальности.
- **Нужно**: realistic gate movement (вертикальный lift или pivot), pusher plate extension.

### 8. Пользователь не видит, что происходит по шагам
- **Проблема**: proof card показывает результат сразу, нет step-by-step explanation.
- **Результат**: непонятно, как система пришла к решению.
- **Нужно**: Demo Director с автоматической демонстрацией по шагам: intro → spawn → detection → dimensions → roundness → decision → command → actuator → route → result.

---

## Новая концепция: Auto Demo 3D Digital Twin

### Главная идея
Превратить текущую интерактивную 3D-сцену в **автоматическую демонстрацию**, которая показывает полный цикл работы ПАК:
- A → конвейер → накопитель → CV detection → измерение → классификация → команда ROUTE_TO_* → исполнение → физический маршрут в B/C/D.

### Ключевые принципы
1. **Auto-play by default**: демонстрация идёт сама, пользователь может pause/skip/select scenario.
2. **Step-by-step storytelling**: каждый step явно показан (detection scan, dimensions check, decision, command, routing).
3. **Clean view**: по умолчанию только A/B/C/D + Накопитель + current step labels. Technical labels — опционально.
4. **Real models**: использовать STL модели товаров из `input_info`.
5. **Camera presets**: автоматические переходы камеры для каждого step.
6. **Realistic geometry**: конвейер, накопитель, gate, pusher выглядят как реальные механизмы.
7. **Physical routing**: товар физически уходит в B/C/D, видно actuator movement.

---

## Какие файлы будут изменены

### Новые файлы

#### 1. `src/domain/demoDirector.ts`
**Цель**: управление автоматической демонстрацией.

**Состояние**:
```typescript
interface DemoDirectorState {
  isAutoDemoRunning: boolean;
  currentDemoScenario: Scenario;
  currentDemoStep: DemoStep;
  elapsedMs: number;
  playbackSpeed: 1 | 2 | 0.5;
  loopMode: boolean;
}

enum DemoStep {
  intro = "intro",
  spawn_item = "spawn_item",
  move_to_detection = "move_to_detection",
  detection_scan = "detection_scan",
  dimensions_check = "dimensions_check",
  roundness_check = "roundness_check",
  decision = "decision",
  command_sent = "command_sent",
  actuator_move = "actuator_move",
  route_item = "route_item",
  result = "result",
  reset_or_next = "reset_or_next",
}
```

**Функции**:
- `startAutoDemo(scenario)`: запуск автодемо для scenario.
- `pauseAutoDemo()`, `resumeAutoDemo()`.
- `nextScenario()`, `selectScenario(id)`.
- `updateAutoDemo(deltaMs)`: автоматический переход между steps.
- `getCameraPresetForStep(step)`: camera preset для текущего step.
- `getActiveLabelsForStep(step)`: какие labels показать для step.

#### 2. `src/data/modelAssets.ts`
**Цель**: manifest реальных 3D моделей товаров.

**Структура**:
```typescript
interface ModelAsset {
  itemId: string;               // 'SKU-006' (Plate)
  displayName: string;          // 'Тарелка'
  categoryScenario: Category;   // 'D'
  dimensions: Dimensions;       // { width: 210, depth: 209, height: 27 }
  sourceFile: string;           // 'input_info/extracted/Stl/Тарелка.stl'
  frontendAssetPath?: string;   // 'public/models/plate.stl' or GLB
  loaderType: 'stl' | 'glb' | 'procedural';
  fallbackPrimitive: 'box' | 'cylinder' | 'sphere';
  notes?: string;               // 'STL too heavy, using simplified mesh'
}
```

**Товары**:
- SKU-006: Тарелка (D) — STL доступен
- SKU-007: Бутылка (D) — STL доступен
- SKU-008: Цилиндр (D) — STL доступен
- SKU-004: Короб 400×400×300 (C) — STL доступен
- SKU-001: Короб 300×200×200 (B) — STL доступен
- SKU-002: ЛанчБокс (B) — STL доступен
- SKU-003: Моющее средство (B) — STL доступен
- SKU-005: Пуфик (C) — STL доступен
- SKU-009: Ручка (C) — STL доступен
- SKU-010: Boundary box (B) — fallback box
- SKU-011: Oversized round (C) — fallback cylinder

#### 3. `src/components/ThreeD/STLModel.tsx`
**Цель**: компонент для загрузки STL моделей.

**Использует**: `STLLoader` из `three/examples/jsm/loaders/STLLoader`.

**Props**:
```typescript
interface STLModelProps {
  path: string;
  scale: [number, number, number];
  rotation?: [number, number, number];
  position?: [number, number, number];
  color: string;
}
```

### Изменяемые файлы

#### 1. `src/components/ThreeD/Item3D.tsx`
**Изменения**:
- Добавить загрузку реального mesh для товаров из `modelAssets`.
- Если asset доступен — загрузить STL/GLB.
- Центрировать и масштабировать модель по dimensions товара.
- Повернуть модель так, чтобы она лежала на конвейере.
- Fallback primitive, если модель не загружена.

**Новая логика**:
```typescript
const asset = getModelAsset(currentItem.item.id);
if (asset && asset.loaderType === 'stl') {
  return <STLModel path={asset.frontendAssetPath} scale={[sx, sy, sz]} color={color} />;
} else {
  // fallback primitive (current logic)
}
```

#### 2. `src/components/ThreeD/SceneLabels3D.tsx`
**Изменения**:
- **Clean view по умолчанию**: показывать только A/B/C/D + Накопитель.
- **Step-based labels**: Camera/Laser/Ultrasonic только во время detection.
- **Active actuators only**: Stop-gate/Pusher только когда активны.
- **Active route only**: показывать только активный route B/C/D, не все три сразу.
- **Максимум 4–5 labels одновременно**.
- **Toggle**: добавить prop `technicalLabelsEnabled: boolean`.

**Новая логика**:
```typescript
// Always show zones
<Badge position={...} text="A" />
<Badge position={...} text="B" />
<Badge position={...} text="C" />
<Badge position={...} text="D" />
<Badge position={...} text="Накопитель" />

// Step-based
{demoStep === 'detection_scan' && <Badge position={...} text="Camera CV" />}
{demoStep === 'detection_scan' && <Badge position={...} text="Laser" />}
{demoStep === 'actuator_move' && <Badge position={...} text="Stop-gate" />}
{activeRoute === 'C' && <Badge position={...} text="Pusher C" />}

// Technical labels (optional toggle)
{technicalLabelsEnabled && <Badge ... />}
```

#### 3. `src/components/ThreeD/SorterDigitalTwin.tsx`
**Изменения**:
- Принимать `demoDirectorState` как prop.
- Использовать `getCameraPresetForStep()` для автоматической камеры.
- Передавать `technicalLabelsEnabled` в `SceneLabels3D`.

**Новые props**:
```typescript
interface SorterDigitalTwinProps {
  simulation: SimulationState;
  demoDirectorState: DemoDirectorState;
  technicalLabelsEnabled: boolean;
  // ...
}
```

#### 4. `src/components/ThreeD/Conveyor3D.tsx`
**Изменения**:
- Добавить realistic ролики/ленту конвейера.
- Добавить direction markers (стрелки движения).
- Добавить борта конвейера.
- Улучшить geometry накопителя (explicit raised pocket с четкими walls).

#### 5. `src/components/ThreeD/Actuator3D.tsx`
**Изменения**:
- Gate: вертикальный lift вместо rotation (более реалистично).
- Pusher C/D: расширенная plate, которая выдвигается.
- Добавить animation эффекты при movement.

#### 6. `src/components/ThreeD/SortingZones3D.tsx`
**Изменения**:
- Roll-cage C/D: добавить visible каркас (wireframe edges).
- B: улучшить зону выхода (не просто куб).

#### 7. `src/components/ThreeD/itemMotion.ts`
**Изменения**:
- Добавить realistic routing path для C/D (не просто Z-offset, а curve path).
- Синхронизировать с `demoDirector` steps.

#### 8. `src/components/ProductDemoSection.tsx`
**Изменения**:
- Добавить Auto Demo controls:
  - "Запустить автодемо" (запуск auto-play)
  - "Пауза" (pause auto-play)
  - Scenario selector: B/C/D/C-priority/Fault/Emergency
  - "Reset"
- Упростить layout: слева 3D, справа proof panel, снизу timeline.
- Убрать мусор: не показывать длинные критерии, event log, PID — они остаются в EngineeringDetails.

**Новые controls**:
```typescript
<div className="demo-controls">
  <button onClick={startAutoDemo}>Запустить автодемо</button>
  <button onClick={pauseAutoDemo} disabled={!isAutoRunning}>Пауза</button>
  <select onChange={selectScenario}>
    <option value="normal_b">B (normal)</option>
    <option value="oversized_c">C (oversized)</option>
    <option value="round_d">D (round)</option>
    <option value="c_priority">C-priority</option>
    <option value="fault">Fault</option>
    <option value="emergency">Emergency</option>
  </select>
  <button onClick={onReset}>Reset</button>
</div>
```

---

## Как будут использоваться реальные модели

### Доступные модели (11 STL файлов)
1. `Бутылка.stl` → SKU-007 (Bottle) → D
2. `Короб 300х200х200.stl` → SKU-001 (Box 300×200×200) → B
3. `Короб 400х400х300.stl` → SKU-004 (Oversized box) → C
4. `ЛанчБокс.stl` → SKU-002 (Lunchbox) → B
5. `Мешок.stl` → (нет в items, можно добавить)
6. `Моющее средство.STL` → SKU-003 (Detergent) → B
7. `Пуфик.stl` → SKU-005 (Pouf) → C
8. `Ручка.stl` → SKU-009 (Pen) → C
9. `Тарелка.stl` → SKU-006 (Plate) → D
10. `Цилиндр.stl` → SKU-008 (Cylinder) → D
11. `Шлем.stl` → (нет в items, можно добавить)

### Стратегия загрузки
1. **STLLoader из three/examples**: использовать для загрузки STL в браузере.
2. **Копировать STL в public**: `public/models/bottle.stl`, `public/models/plate.stl`, etc.
3. **Масштабирование**: STL модели часто в мм, нужно scale к Three.js units (1 unit = 1 m).
4. **Центрирование**: после загрузки STL — центрировать geometry по bounding box.
5. **Rotation**: повернуть модель так, чтобы она лежала на конвейере (обычно rotation Y = 0, X = 0).
6. **Fallback**: если STL не загружен — использовать primitive (box/cylinder/sphere).

### Оптимизация
- **Не коммитить тяжёлые STL**: если STL > 500 KB — не коммитить в public, использовать simplified mesh.
- **Lazy loading**: загружать STL только для активного item, не preload все сразу.
- **LOD (future)**: для тяжёлых моделей можно добавить Level of Detail.

---

## Как будет работать Auto Demo

### Последовательность steps
1. **intro** (1.5s): камера overview, показать всю сцену A/B/C/D, conveyor, накопитель.
2. **spawn_item** (0.8s): товар появляется в зоне A, подсвечивается.
3. **move_to_detection** (1.2s): товар едет по конвейеру к Camera/CV, камера close-up на detection zone.
4. **detection_scan** (0.9s): Camera/CV активен, scan plane visible, товар сканируется.
5. **dimensions_check** (0.7s): proof card показывает "Dimensions: PASS/FAIL".
6. **roundness_check** (0.7s): proof card показывает "Roundness K = ...".
7. **decision** (0.7s): proof card показывает "Category: B/C/D".
8. **command_sent** (0.6s): proof card показывает "Command: ROUTE_TO_*", активный route подсвечивается.
9. **actuator_move** (1.0s): Stop-gate открывается (B) или Pusher C/D выдвигается, камера close-up на gate/pusher.
10. **route_item** (1.2s): товар физически движется в B/C/D, камера follows item, route beam яркий.
11. **result** (1.5s): товар в целевой зоне, зона подсвечивается, proof card: "Cycle completed".
12. **reset_or_next** (0.5s): fade out, переход к следующему scenario или loop.

### Управление
- **Auto-play**: по умолчанию demo идёт сам, переходы автоматические.
- **Pause**: пользователь может pause на любом step.
- **Skip**: пользователь может skip to next step.
- **Scenario select**: пользователь может выбрать B/C/D/C-priority/Fault/Emergency.
- **Loop mode**: после завершения цикла — автоматически начать следующий scenario или повторить.

---

## Как решена проблема labels

### Clean view (default)
Показывать только:
- A/B/C/D zones (4 labels)
- Накопитель (1 label)
- **Всего: 5 labels постоянно**

### Step-based labels
- **detection_scan**: добавить "Camera CV" (1)
- **actuator_move**: добавить "Stop-gate" или "Pusher C/D" (1)
- **route_item**: добавить "Route B/C/D" (1)
- **Максимум: 5 + 2 = 7 labels в peak момент**

### Technical labels (opt-in toggle)
- Laser, Ultrasonic, Conveyor speed, Min dimensions, PID — скрыты по умолчанию.
- Пользователь может включить "Technical labels" toggle → показать все.

### ItemProofPanel
- Убрать из 3D сцены.
- Показывать в 2D proof card справа от 3D сцены.

### Offset и positioning
- Labels с offset от объектов (не прямо на объекте).
- Использовать `distanceFactor` для масштабирования labels.
- Избегать overlapping: если два labels близко — сместить один вверх/вниз.

---

## Camera presets

### 1. Overview (intro)
```typescript
position: [6.2, 4.8, 6.2]
target: [0, 0.3, 0]
fov: 42
```
Видно всю ячейку A/B/C/D.

### 2. Detection close-up (detection_scan)
```typescript
position: [-1.2, 2.5, 3.5]
target: [-1.2, 0.3, 0]
fov: 38
```
Камера ближе к Camera/CV и товару.

### 3. Gate close-up (actuator_move)
```typescript
position: [1.6, 2.0, 3.0]
target: [1.6, 0.3, 0]
fov: 36
```
Видно накопитель, stop-gate, pusher.

### 4. Routing view (route_item)
```typescript
position: [2.5, 3.5, category === 'C' ? 2.4 : category === 'D' ? -2.4 : 0]
target: [TWIN_LAYOUT.gateX + 0.4, 0.5, categoryZ]
fov: 40
```
Камера follows активный route B/C/D.

### 5. Result view (result)
```typescript
position: [category === 'B' ? TWIN_LAYOUT.zoneBX : TWIN_LAYOUT.gateX + 0.4, 3.0, categoryZ]
target: [zoneX, 0.5, categoryZ]
fov: 38
```
Видно целевую зону и товар в ней.

### Camera transitions
Использовать плавные transitions между presets (lerp position/target за 0.8s).

---

## Улучшенная геометрия сцены

### 1. Складской пол
- Grid с subtle цветом `#1e3a54` (current).
- Не слишком яркий, чтобы не отвлекать.

### 2. Конвейер
- **Ролики**: несколько цилиндров поперёк конвейера.
- **Лента**: plane с texture или просто flat surface.
- **Направление движения**: стрелки на ленте.
- **Борта**: два box по бокам конвейера.

### 3. Накопитель
- **Explicit raised pocket**: box с raised floor.
- **Walls**: четкие walls по трём сторонам (кроме входа).
- **Цвет**: teal `#0f766e`.

### 4. Camera/CV
- **Стойка**: вертикальная mesh над конвейером.
- **Camera body**: небольшой box на стойке.
- **Scan plane**: plane во время detection (fade in/out).

### 5. Laser height
- **Датчик**: маленький box на стойке.
- **Луч**: thin cylinder или line во время detection.

### 6. Ultrasonic
- **Датчик**: небольшой box у gate.
- **Pulse**: sphere с fade in/out во время detection.

### 7. Stop-gate
- **Geometry**: vertical plate (box).
- **Movement**: вертикальный lift (translate Y) вместо rotation.
- **Состояние**: закрыт (Y = 0.2), открыт (Y = 0.6).

### 8. Pusher C/D
- **Geometry**: horizontal plate (box).
- **Movement**: extension по Z (current logic OK).
- **Состояние**: idle (Z = 0), extended (Z = 0.55), retracting (Z = 0.25).

### 9. B (прямой выход)
- **Geometry**: zone box (current).
- **Добавить**: direction arrow, border highlight.

### 10. C/D (roll-cage)
- **Geometry**: wireframe box для каркаса.
- **Walls**: mesh с низкой opacity для walls.
- **Label**: на передней стенке каркаса.

### 11. Ограждения
- **Стойки**: vertical posts у зон C/D.
- **Минимализм**: простые, без перегруза.

### 12. Свет
- **Ambient light**: 0.55 (current OK).
- **Directional lights**: два (current OK).
- **Без тяжёлых shadows**: если влияет на FPS.

---

## Definition of Done

### Критерии завершения
1. ✅ 3D demo запускается автоматически при нажатии "Запустить автодемо".
2. ✅ Пользователь без ручного "Next step" видит полный цикл: intro → spawn → detection → decision → routing → result.
3. ✅ В сцене используются реальные модели товаров из `input_info` (STL), где это возможно.
4. ✅ Если модель не используется — это явно отражено в `modelAssets.ts` manifest.
5. ✅ Labels не перекрывают сцену: максимум 5 labels по умолчанию, 7 в peak момент.
6. ✅ Clean view включён по умолчанию (только A/B/C/D + Накопитель).
7. ✅ Есть "Technical labels" toggle для включения всех подробных labels.
8. ✅ Товар физически уходит в B/C/D, видна траектория движения.
9. ✅ Gate/Pusher двигаются реалистично (vertical lift для gate, extension для pusher).
10. ✅ C-priority визуально доказан: негабарит + круглый → только C подсвечивается, D не активен.
11. ✅ Fault/Emergency визуально понятны: красная подсветка, stopped state, proof card объясняет.
12. ✅ Mobile использует 2D fallback (current logic OK, не трогать).
13. ✅ Нет horizontal scroll (responsive layout OK, не трогать).
14. ✅ Tests зелёные: `npm run test` проходит.
15. ✅ Build зелёный: `npm run build` проходит.
16. ✅ Docker зелёный: `docker compose up --build` успешен.
17. ✅ Домены 200: arhipovdan.ru, www.arhipovdan.ru, 127.0.0.1:3100.
18. ✅ Документация обновлена: README, DEMO_SCRIPT, JURY_QA, SUBMISSION_CHECKLIST, THREE_D_FEASIBILITY, THREE_D_REWORK_PLAN.

---

## Риски и ограничения

### Риски
1. **STL модели тяжёлые**: некоторые STL могут быть > 1 MB → медленная загрузка.
   - **Митигация**: lazy loading, simplified mesh, fallback primitive.
2. **FPS падает**: добавление реальных моделей + camera transitions может снизить FPS.
   - **Митигация**: LOD, simplified geometry для mobile, dpr adjustment.
3. **Auto demo слишком быстрый/медленный**: timing steps может быть неоптимальным.
   - **Митигация**: playback speed control (1x, 2x, 0.5x).
4. **Camera transitions дёрганые**: lerp может быть не плавным.
   - **Митигация**: использовать easing functions (ease-in-out), увеличить transition time.

### Ограничения
1. **Не добавлять physics engine**: PHYSICS_ENGINE_ENABLED = false (as per requirements).
2. **Не добавлять backend/real ML**: симуляция остаётся rule-based.
3. **Не удалять 2D fallback**: mobile + WebGL fail должен показывать 2D.
4. **Не коммитить input_info/extracted/**: модели копируются в public, но extracted игнорируется git.
5. **Не ломать существующие tests**: classifier, simulation, C-priority tests остаются зелёными.

---

## Следующие шаги

### ЭТАП 2: Проанализировать реальные 3D-модели из input_info
- Проверить размер и качество каждого STL.
- Определить, какие модели можно использовать напрямую.
- Определить, какие требуют simplified mesh.
- Создать `src/data/modelAssets.ts` manifest.

### ЭТАП 3: Использовать реальные модели товаров в 3D
- Скопировать STL в `public/models/`.
- Создать `STLModel.tsx` компонент.
- Изменить `Item3D.tsx` для загрузки реальных моделей.

### ЭТАП 4: Создать Demo Director
- Создать `src/domain/demoDirector.ts`.
- Определить steps, durations, camera presets.
- Интегрировать в `ProductDemoSection.tsx`.

### ЭТАП 5: Переделать camera и scene composition
- Определить camera presets.
- Добавить camera transitions в `SorterDigitalTwin.tsx`.

### ЭТАП 6: Убрать мусорные labels
- Изменить `SceneLabels3D.tsx`: clean view + step-based labels.
- Добавить "Technical labels" toggle.

### ЭТАП 7: Переделать геометрию сортировочной ячейки
- Улучшить `Conveyor3D`, `Actuator3D`, `SortingZones3D`.

### ЭТАП 8: Реальная маршрутизация в 3D
- Улучшить `itemMotion.ts` для realistic routing paths.

### ЭТАП 9: Упростить ProductDemo UI
- Рефакторить `ProductDemoSection.tsx`: auto demo controls, timeline.

### ЭТАП 10–18: Tests, build, deploy, docs, Visual QA.
