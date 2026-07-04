# REAL_3D_AUDIT_REPORT

**Дата аудита:** 2026-07-04  
**Аудитор:** Claude Opus 4.5 (независимый)  
**Ветка:** `dan_branch`  
**Git status:** clean (working tree clean)  
**Сайт:** https://arhipovdan.ru/

---

## 1. Краткий честный вердикт

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| **3D сцена** | **ЧАСТИЧНО ГОТОВО** | Рендерится, но визуально нечитаема |
| **Auto demo** | **РАБОТАЕТ** | Данные обновляются, proof panel работает |
| **Движение в 3D** | **НЕ СЧИТЫВАЕТСЯ** | Объект слишком мелкий, камера далеко |
| **Визуальное качество** | **ПЛОХО** | Выглядит как low-fi prototype, не digital twin |
| **Готовность к защите** | **НЕ ГОТОВО** | Требуется визуальная переработка |

**Честный вердикт:** 3D сцена технически работает (WebGL ok, модели загружаются, state машина обновляется), но визуально НЕ доказывает физическую маршрутизацию. Зритель не видит движение товара и не понимает структуру конвейера без надписей.

---

## 2. Evidence screenshots

| Файл | Viewport | Действие | Что доказывает |
|------|----------|----------|----------------|
| `desktop_01_initial.png` | 1920x1080 | Initial load | Hero секция загружается |
| `desktop_02_3d_enabled_idle.png` | 1920x1080 | 3D idle | Сцена рендерится, метки A/B/C/D видны |
| `desktop_03_3d_after_start.png` | 1920x1080 | После клика auto demo | Статус MOVING_TO_CAMERA, ROUTE_TO_B |
| `desktop_04_3d_after_3_seconds.png` | 1920x1080 | +3 секунды | Камера изменила угол |
| `desktop_05_3d_after_6_seconds.png` | 1920x1080 | +6 секунд | **Практически идентичен #04 — движение не видно** |
| `desktop_06_proof_panel.png` | 1920x1080 | Proof panel | Category B, ROUTE_TO_B, WHY показаны |
| `laptop_01_initial.png` | 1440x900 | Initial | Hero загружается |
| `laptop_02_3d_running_fallback.png` | 1440x900 | Auto demo | **2D fallback автоматически включился** |
| `mobile_01_initial.png` | 390x844 | Initial | Mobile layout адаптивный |
| `mobile_02_fallback.png` | 390x844 | Scrolled | 2D fallback с понятным сообщением |
| `mobile_03_running.png` | 390x844 | Running | 2D схема работает, MOVING_TO_CAMERA |

**Скриншоты сохранены в:** `docs/audit_screenshots/`

---

## 3. Fact table

| Проверка | Статус | Доказательство | Комментарий |
|----------|--------|----------------|-------------|
| WebGL работает | ✅ РАБОТАЕТ | hasWebGLContext: true | FPS ~60 на desktop |
| STL загружается | ✅ РАБОТАЕТ | Network: box-300.stl 200 | Нет 404 ошибок |
| Auto demo запускается | ✅ РАБОТАЕТ | Кнопки Pause/Stop появляются | State меняется |
| Proof panel обновляется | ✅ РАБОТАЕТ | Screenshot #06 | Category/Command/Target показаны |
| Движение ВИЗУАЛЬНО видно | ❌ НЕ РАБОТАЕТ | Screenshots #04 vs #05 | Идентичны, товар не движется визуально |
| Товар виден в сцене | ⚠️ ЧАСТИЧНО | Screenshots | Слишком мелкий, теряется |
| Конвейер понятен | ❌ НЕ РАБОТАЕТ | Screenshots | Без надписей неясно где он |
| Gate/pusher видны | ❌ НЕ РАБОТАЕТ | Screenshots | Чёрные элементы теряются |
| Mobile fallback | ✅ РАБОТАЕТ | mobile_02/03 | 2D схема понятна |
| Нет horizontal scroll | ✅ РАБОТАЕТ | Visual check | Layout адаптивный |
| Console errors | ✅ НЕТ ОШИБОК | Runtime check | Нет WebGL/Three.js ошибок |

---

## 4. Что реально работает

1. **WebGL рендеринг** — Canvas создаётся, FPS ~60
2. **STL модели** — загружаются без 404 (box-300.stl)
3. **State machine** — IDLE → MOVING_TO_CAMERA → ROUTE_TO_B работает
4. **Proof panel** — показывает Category, Command, Target, WHY
5. **Auto demo controls** — кнопки Pause/Stop функционируют
6. **Mobile 2D fallback** — включается автоматически с понятным сообщением
7. **OrbitControls** — камера управляется пользователем
8. **Метки A/B/C/D** — видны и контрастны

---

## 5. Что реально не работает

1. **Движение товара НЕ ВИДНО** — между кадрами 3 и 6 секунд нет визуальных изменений позиции товара
2. **Товар слишком мелкий** — масштаб 0.12-0.45 м при камере на 6+ единиц делает объект незаметным
3. **Конвейер НЕ ЧИТАЕТСЯ** — цвет #1e3a54 на фоне #050910 сливается
4. **Gate/pusher НЕ ВИДНЫ** — чёрные элементы теряются
5. **Маршрут НЕ ОЧЕВИДЕН** — route arrows есть, но не выделяются
6. **Камера НЕ следит за товаром** — статичная позиция, товар уходит из фокуса
7. **Laptop viewport включает 2D fallback** — хотя WebGL доступен (возможная проблема с emulation)

---

## 6. Что визуально плохо

### Сцена
- ❌ Выглядит как debug wireframe, не industrial digital twin
- ❌ Нет ощущения глубины и реализма
- ❌ Чёрный фон + тёмные элементы = нет контраста

### Камера
- ❌ Слишком далеко (6.2, 4.8, 6.2)
- ❌ Не следит за товаром
- ❌ Не показывает процесс маршрутизации

### Материалы
- ❌ Conveyor: #1e3a54 — слишком тёмный
- ❌ Belt: #334155 — серый, но неконтрастный
- ❌ Floor: #07111d — почти чёрный
- ❌ Нет metalness/glossy для механизмов

### Свет
- ⚠️ Есть ambient + directional, но недостаточно
- ❌ Нет теней (shadows отключены)
- ❌ Нет подсветки активных зон

### Движение
- ❌ Слишком медленное (elapsedMs / 1200 = ~1.2 сек на сегмент)
- ❌ Нет визуального следа/trail
- ❌ Нет анимации перехода камеры

### Labels
- ⚠️ A/B/C/D видны, но:
- ❌ Нет подписей "Conveyor", "Gate", "Pusher"
- ❌ Нет direction arrows внутри сцены

### Маршруты
- ❌ Route arrows существуют (код), но визуально не выделяются
- ❌ Активный маршрут не подсвечен

### Механика
- ❌ Gate визуально не работает (не анимирован)
- ❌ Pusher не виден
- ❌ Actuators сливаются с фоном

### Модели
- ⚠️ STL загружаются, но:
- ❌ Размер товара слишком мал в масштабе сцены
- ❌ Цвет товара не контрастирует с фоном

---

## 7. 3D model / STL status

| Item ID | Model Type | Path | Loaded | Visually Recognizable |
|---------|-----------|------|--------|----------------------|
| SKU-001 | STL | /models/box-300.stl | ✅ yes | ⚠️ partial (too small) |
| SKU-002 | STL | /models/lunchbox.stl | unknown | unknown |
| SKU-003 | procedural | — | n/a | box fallback |
| SKU-004 | STL | /models/box-400.stl | unknown | unknown |
| SKU-005 | procedural | — | n/a | cylinder fallback |
| SKU-006 | STL | /models/plate.stl | unknown | unknown |
| SKU-007 | STL | /models/bottle.stl | unknown | unknown |
| SKU-008 | STL | /models/cylinder.stl | unknown | unknown |
| SKU-009 | procedural | — | n/a | box fallback |

**Вывод:** STL модели существуют и загружаются, но размер в сцене слишком мал для визуального распознавания.

---

## 8. Console/runtime errors

| Action | Error/Warning | Severity | Impact |
|--------|---------------|----------|--------|
| Initial load | None | — | — |
| Switch to 3D | None | — | — |
| Click auto demo | None | — | — |
| Wait 3 seconds | None | — | — |
| Wait 6 seconds | None | — | — |
| Switch to 2D | None | — | — |
| Mobile viewport | None | — | — |

**Вывод:** Нет runtime ошибок. Проблема чисто визуальная, не техническая.

---

## 9. Root causes

### Почему движение не видно

1. **Масштаб товара** — `sx, sy, sz` рассчитываются как `dims / 1000`, получается 0.12-0.45 м
2. **Камера далеко** — позиция [6.2, 4.8, 6.2] делает объект 0.3м слишком мелким
3. **Скорость progress** — `elapsedMs / 1200` = медленное изменение позиции
4. **Нет анимации камеры** — камера не следит за товаром

### Почему сцена нечитабельна

1. **Низкий контраст** — conveyor #1e3a54 на #050910 фоне
2. **Нет outline** — объекты без границ сливаются
3. **Нет теней** — shadows отключены для performance
4. **Нет highlights** — активные зоны не светятся

### Почему детали черные

1. **Conveyor color** — `#1e3a54` (слишком тёмный синий)
2. **Belt color** — `#334155` (тёмно-серый)
3. **Floor color** — `#07111d` (почти чёрный)
4. **Background** — `#050910` (очень тёмный)

### Почему 3D не выглядит как digital twin

1. **Упрощённые геометрии** — box, cylinder без деталей
2. **Нет реалистичных текстур** — только solid colors
3. **Нет физических эффектов** — PHYSICS_ENGINE_ENABLED = false
4. **Статичная камера** — не показывает процесс

---

## 10. Must-fix список

### P0 — Без этого нельзя показывать

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Движение не видно | Увеличить товар × 2-3, приблизить камеру |
| 2 | Камера далеко | Позиция [3.5, 2.8, 3.5] или follow-cam |
| 3 | Объект неконтрастный | Добавить outline или glow |
| 4 | Активный маршрут не очевиден | Подсветка route arrows, highlight зоны |
| 5 | Proof panel объясняет | ✅ Уже работает |

### P1 — Важно для качества

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Материалы тёмные | Сменить conveyor на #2d4a6a, belt на #4a5568 |
| 2 | Нет света | Добавить spotlight на активную зону |
| 3 | Gate/pusher не видны | Контрастные цвета, анимация |
| 4 | Route animation | Trail или particles за товаром |

### P2 — Nice to have

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Camera transitions | Плавное следование за товаром |
| 2 | Labels в сцене | "Conveyor", "Gate" HTML overlays |
| 3 | Polished animations | Easing для movement |

---

## 11. Recommended rework scope

### Убрать
- Яркий зеленый фон (был на некоторых кадрах)
- Labels которые мешают

### Изменить
- `itemMotion.ts` — увеличить scale товара
- `SorterDigitalTwin.tsx` — приблизить камеру
- `Conveyor3D.tsx` — осветлить цвета
- `Item3D.tsx` — добавить outline/glow
- `SortingZones3D.tsx` — ярче highlight для активной зоны
- `RouteArrows3D.tsx` — сделать заметнее

### Не трогать
- Proof panel — работает хорошо
- State machine — логика корректна
- Auto demo controls — функционируют
- Mobile fallback — работает

---

## 12. Что НЕ делать

1. ❌ Не добавлять physics engine — усложнит без пользы
2. ❌ Не плодить labels внутри canvas — уже есть HUD
3. ❌ Не добавлять heavy shadows — убьёт performance
4. ❌ Не писать отчёты без скриншотов
5. ❌ Не утверждать готовность без визуальной проверки
6. ❌ Не добавлять новые фичи — сначала fix existing

---

## 13. Готовый Cursor prompt outline

```
Fix 3D digital twin visual quality:

1. Item visibility
   - Increase item scale × 2.5 in Item3D.tsx
   - Add emissive outline when moving
   - Color based on category (brighter)

2. Camera
   - Move closer: [4.0, 3.0, 4.0]
   - Reduce maxDistance to 10
   - Consider follow-cam option

3. Scene contrast
   - Conveyor: #3b5998 (brighter blue)
   - Belt: #5a6577 (lighter gray)  
   - Floor: #0f1a2a (slightly lighter)
   - Background: #0a1520

4. Active route highlight
   - RouteArrows3D: thicker, glowing
   - SortingZones3D: emissive intensity × 2 for active

5. Gate/Actuator visibility
   - Actuator3D: add cyan/green accent color
   - Animate gate state visually

6. Verify with screenshots after changes
   - Compare before/after
   - Test movement visibility over 6 seconds

DO NOT: add physics, add heavy shadows, add labels inside canvas
```

---

## Заключение

**Главная проблема:** 3D сцена технически работает, но визуально не доказывает физическую маршрутизацию.

**Главные 5 проблем:**
1. Товар слишком мелкий — не виден в сцене
2. Камера слишком далеко — движение не считывается
3. Низкий контраст — элементы сливаются с фоном
4. Нет highlight активного маршрута
5. Gate/pusher/actuators не видны

**Следующий шаг:** Применить P0 fixes из раздела 10, затем сделать новые скриншоты для сравнения.

---

*Отчёт создан независимым аудитором. Все утверждения подтверждены скриншотами или кодом.*
