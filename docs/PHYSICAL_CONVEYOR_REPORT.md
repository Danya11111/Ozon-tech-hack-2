# Physical Conveyor Report

## Summary

Исправлена физическая правдоподобность 3D demo на главной странице.

## Проблема

Товар выглядел так, будто "летит" выше конвейера:
- `beltY` был 0.35м вместо 0.7м
- `itemOffsetY` добавлял ещё смещение
- Итоговая высота товара: 0.5м — неправильно
- Конвейер не имел реалистичной структуры (без опор до пола)

## Root Cause

В `conveyorPath.ts` были hardcoded значения:
```typescript
beltY: 0.35,        // Должно быть 0.7м
itemOffsetY: 0.15,  // Добавлялось без учёта размера товара
```

В `SorterDigitalTwinContinuous.tsx` belt surface был на 0.32м.

## Решение

### 1. Создан единый файл размеров

`src/domain/physicalLayout.ts` — единый источник правды:

| Параметр | Значение | Описание |
|----------|----------|----------|
| `CONVEYOR_WIDTH_M` | 0.5м | Ширина полотна |
| `CONVEYOR_HEIGHT_M` | 0.7м | Высота верха полотна |
| `CONVEYOR_SPEED_MPS` | 1.0 м/с | Скорость ленты |
| `BELT_THICKNESS_M` | 0.015м | Толщина полотна |
| `ROLLER_RADIUS_M` | 0.04м | Радиус ролика |
| `ROLLER_SPACING_M` | 0.15м | Шаг роликов |

### 2. Формула высоты товара

```typescript
// Товар сидит НА ленте: верх полотна + половина высоты товара
itemY = BELT_TOP_Y + itemVisualHeight / 2
// BELT_TOP_Y = 0.7м
```

### 3. Реалистичный конвейер

Добавлены компоненты:
- **Belt surface** — верхняя рабочая поверхность на 0.7м
- **Side guards** — боковые направляющие выше полотна
- **Frame rails** — рама под полотном
- **Rollers** — вращающиеся ролики под лентой
- **Drive roller** — приводной ролик (увеличенный)
- **Tension roller** — натяжной ролик
- **Support legs** — опоры от пола до рамы
- **Stepper motor** — шаговый двигатель у приводного ролика

### 4. Позиции зон

```typescript
ZONES = {
  A: { x: -4.0, z: 0 },      // Spawn
  CAMERA: { x: -1.5, z: 0 }, // Detection
  GATE: { x: 1.5, z: 0 },    // Diverter
  B: { x: 4.0, z: 0 },       // Main exit
  C: { x: 2.0, z: 2.0 },     // Oversized
  D: { x: 2.0, z: -2.0 },    // Round
}
```

## Файлы изменены

| Файл | Изменения |
|------|-----------|
| `src/domain/physicalLayout.ts` | **Создан** — все физические размеры |
| `src/domain/conveyorPath.ts` | Импорт из physicalLayout, правильный расчёт itemY |
| `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Новый ConveyorBelt с правильными размерами |

## Скриншоты

`docs/physical_conveyor_screenshots/`:
- `conveyor_side_view.png` — боковой вид с опорами
- `item_on_belt.png` — товар на полотне
- `running_item_on_belt.png` — товар движется
- `motor_drive.png` — виден stepper motor
- `conveyor_top_angle.png` — вид сверху
- `details_page.png` — /details не сломан

## Проверки

| Проверка | Результат |
|----------|-----------|
| `npm run build` | ✅ Успешно |
| `npm run test` | ✅ 59 тестов |
| Docker rebuild | ✅ Успешно |
| Production QA | ✅ Работает |
| Console errors | ✅ Нет ошибок |

## Что осталось

- Визуально stepper motor небольшой — это правильно для масштаба
- Можно добавить более детальную геометрию роликов (низкий приоритет)
- Roll-cages для C/D зон можно добавить отдельно

## Команды для commit/push

```bash
git add -A
git commit -m "fix: physical conveyor realism - belt at 0.7m, item rides ON belt

- Create physicalLayout.ts with all dimensions
- Update conveyorPath.ts to use correct belt height
- Rebuild ConveyorBelt with proper structure:
  - Support legs from floor
  - Rollers under belt
  - Drive/tension rollers
  - Stepper motor at drive end
- Item Y = BELT_TOP_Y + itemHeight/2

Closes: item floating above conveyor"
git push origin dan_branch
```
