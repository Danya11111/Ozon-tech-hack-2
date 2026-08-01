> **HISTORICAL / SUPERSEDED:** This document records an earlier project stage. Canonical Track 3 rules are exclusive bounds **> 10×10×10** and **< 450×320×320** mm, roundness **K > 0.8** (`doc-1783095831` pp.5–8; `src/domain/classifier.ts`). Values 10×10×2 / K≥0.7 below are obsolete.

# 3D REBUILD SPEC — Главная страница как Full-Screen Demo

**Дата:** 2026-07-06  
**Цель:** Очистить главную, оставить только Play + непрерывное 3D demo. Детали в /details.

---

## 1. Target UX

**Главная страница (/):**
- Full-screen 3D demo viewport
- Одна кнопка Play (крупная, центр/низ экрана)
- 8 сценариев проигрываются автоматически подряд без ручного вмешательства
- Минимальный overlay: текущий сценарий, категория, прогресс
- Ссылка "Details" → /details

**Цель восприятия:**
- Пользователь за 5 секунд понимает: это 3D demo сортировки
- За 60 секунд видит все 8 сценариев без клика
- Жюри сразу видит физическую маршрутизацию B/C/D

---

## 2. Main Page Scope

**Что остаётся на главной:**
| Компонент | Назначение |
|-----------|------------|
| SorterDigitalTwin | Full-screen 3D canvas |
| Play/Pause кнопка | Запуск/пауза автодемо |
| Mini HUD overlay | Сценарий, категория, step, progress bar |
| "Details" link | Переход на /details |

**Что удаляется с главной:**
| Компонент | Куда идёт |
|-----------|-----------|
| Header | Упрощённый вариант (только logo + Details link) |
| HeroSection | Удаляется полностью (контекст понятен из 3D) |
| ProductDemoSection | Интегрируется в full-screen режим |
| StorylineStepper | → /details |
| ScenarioCards | → /details |
| CPriorityExplanation | → /details |
| CriteriaCards | → /details |
| EngineeringDetails | → /details |
| Footer | Минимизируется или удаляется |

---

## 3. Details Page Scope

**Новая страница /details содержит:**
- HeroSection (адаптированная, короткая)
- ScenarioCards (все 9 сценариев)
- CPriorityExplanation
- CriteriaCards
- EngineeringDetails (полные панели)
- StorylineStepper
- Оригинальный демо-режим со step-by-step управлением

**Это "документация для жюри":**
- Таблицы критериев
- Пояснения правил классификации
- Ручной просмотр отдельных сценариев
- Timeline, PID, Event Log

---

## 4. 8-Scenario Playback Sequence

**Рекомендуемый порядок показа (без jam и emergency для чистого потока):**

| # | Scenario ID | Название | Категория | Что показывает | Длительность |
|---|-------------|----------|-----------|----------------|--------------|
| 1 | `normal_flow` | Normal flow | B/C/D mix | Базовый поток, все маршруты | ~12s |
| 2 | `oversized_item` | Oversized | C | Габариты FAIL → C | ~6s |
| 3 | `round_object` | Round object | D | Roundness K≥0.7 → D | ~8s |
| 4 | `c_priority` | C priority | C | Негабарит + круглый = C | ~5s |
| 5 | `boundary_dimensions` | Boundary | B/C | Граничные размеры | ~8s |
| 6 | `close_items` | Close items | B/B/D | Очередь, spacing warning | ~10s |
| 7 | `low_confidence` | Low confidence | B/D | CV fallback, warning | ~6s |
| 8 | `normal_flow` | Final loop | B/C/D | Повтор normal для loop | ~12s |

**Общее время:** ~67 секунд на полный цикл

**Альтернатива с fault/emergency (если жюри хочет видеть):**
- Заменить #8 на `jam` или `emergency_stop`
- Добавить визуальную индикацию FAULT

---

## 5. 3D Scene Composition

**Что уже есть и работает:**
```
├── SorterDigitalTwin.tsx (главная сцена)
│   ├── Conveyor3D.tsx (лента конвейера)
│   ├── SensorRig3D.tsx (камера, лазер, ultrasonic)
│   ├── Actuator3D.tsx (gate, pusher C, pusher D)
│   ├── SortingZones3D.tsx (зоны B/C/D, roll-cages)
│   ├── Item3D.tsx (товар с реальными STL)
│   ├── RouteArrows3D.tsx (стрелки маршрутов)
│   └── SceneLabels3D.tsx (метки A/B/C/D)
```

**Реальные STL модели (6 шт, ~1.2 MB total):**
| Файл | Размер | Категория | SKU |
|------|--------|-----------|-----|
| `bottle.stl` | 319 KB | D | SKU-007 |
| `box-300.stl` | 29 KB | B | SKU-001 |
| `box-400.stl` | 27 KB | C | SKU-004 |
| `cylinder.stl` | 108 KB | D | SKU-008 |
| `lunchbox.stl` | 566 KB | B | SKU-002 |
| `plate.stl` | 125 KB | D | SKU-006 |

**Procedural fallback (без STL):**
- SKU-003 (Detergent) → box primitive
- SKU-005 (Pouf) → cylinder primitive
- SKU-009 (Pen) → thin box primitive
- SKU-010, SKU-011 → box/cylinder primitives

---

## 6. Camera Storyboard

**Использовать существующие presets из demoDirector.ts:**

| Demo Step | Camera Preset | Что видно |
|-----------|---------------|-----------|
| intro | `overview` | Вся сцена A/B/C/D |
| spawn_item | `overview` | Товар появляется в A |
| move_to_detection | `detectionCloseup` | Движение к камере |
| detection_scan | `detectionCloseup` | Bbox, CV scan |
| dimensions_check | `gateCloseup` | Накопитель, stop-gate |
| roundness_check | `gateCloseup` | Проверка формы |
| decision | `gateCloseup` | Решение B/C/D |
| command_sent | `gateCloseup` | ROUTE_TO_* |
| actuator_move | по категории | Gate/Pusher движение |
| route_item | `routingB/C/D` | Товар уходит в зону |
| result | `resultB/C/D` | Товар в целевой зоне |
| reset_or_next | `overview` | Подготовка к следующему |

**Переходы камеры:**
- Плавная интерполяция (lerp) между presets
- Длительность перехода: 400-600ms
- OrbitControls отключены во время автодемо

---

## 7. Asset Readiness

**STL модели — готовы ✅**
- 6 моделей в `/public/models/`
- Все протестированы, загружаются
- Fallback primitives для остальных

**Items — готовы ✅**
- 11 SKU в `items.ts`
- Параметры соответствуют input_info (10×10×2mm, K≥0.7)

**Scenarios — готовы ✅**
- 9 сценариев в `scenarios.ts`
- Все работают с текущей simulation

**DemoDirector — готов ✅**
- Camera presets определены
- Step sequence есть
- Auto playback реализован

**Что нужно доработать:**
- [ ] Multi-scenario playlist (сейчас один сценарий)
- [ ] Camera transitions (lerp между presets)
- [ ] Full-screen режим без UI chrome
- [ ] Loop mode для 8 сценариев

---

## 8. File Plan

### Новые файлы:

| Файл | Назначение |
|------|------------|
| `src/pages/MainPage.tsx` | Новая главная с full-screen 3D |
| `src/pages/DetailsPage.tsx` | Страница деталей |
| `src/components/DemoOverlay.tsx` | Минимальный HUD для главной |
| `src/components/PlayButton.tsx` | Крупная кнопка Play |
| `src/domain/demoPlaylist.ts` | Playlist из 8 сценариев |

### Изменения в существующих:

| Файл | Изменение |
|------|-----------|
| `src/App.tsx` | Роутинг: / → MainPage, /details → DetailsPage |
| `src/main.tsx` | Добавить React Router |
| `src/domain/demoDirector.ts` | Добавить playlist support, camera lerp |
| `src/components/ThreeD/SorterDigitalTwin.tsx` | Full-screen mode prop |
| `src/styles.css` | Стили для full-screen, overlay, play button |

### Удаление/перемещение:

| Компонент | Действие |
|-----------|----------|
| `HeroSection.tsx` | Перенести в DetailsPage |
| `ScenarioCards.tsx` | Перенести в DetailsPage |
| `CriteriaCards.tsx` | Перенести в DetailsPage |
| `CPriorityExplanation.tsx` | Перенести в DetailsPage |
| `EngineeringDetails.tsx` | Перенести в DetailsPage |
| `StorylineStepper.tsx` | Перенести в DetailsPage |

---

## 9. Risks / Open Questions

### Риски:

| Риск | Митигация |
|------|-----------|
| WebGL context lost на mobile | 2D fallback уже есть (ThreeFallback.tsx) |
| Тяжёлые STL на слабых устройствах | Fallback primitives, DPR снижение |
| Камера дёргается при быстрых переходах | Easing функция, плавный lerp |
| Жюри хочет ручной контроль | Ссылка на /details с полным контролем |
| React Router добавляет bundle | Минимальный импакт (~10KB gzipped) |

### Open Questions:

| Вопрос | Рекомендация |
|--------|--------------|
| Включать ли jam/emergency в playlist? | Нет для чистого показа, да для полноты |
| Показывать ли FPS? | Нет на главной, да в /details |
| Звук/музыка? | Нет, лишняя зависимость |
| Автозапуск при загрузке? | Нет, ждать клика Play |
| Loop бесконечно или остановка? | Loop по умолчанию, стоп по клику |

---

## 10. Step 2 Implementation Checklist

### Phase 1: Routing Setup
- [ ] Установить react-router-dom
- [ ] Создать базовый роутинг в App.tsx
- [ ] Создать пустые MainPage.tsx и DetailsPage.tsx

### Phase 2: Details Page
- [ ] Перенести компоненты из App.tsx в DetailsPage
- [ ] Сохранить всю текущую функциональность
- [ ] Проверить работоспособность /details

### Phase 3: Demo Playlist
- [ ] Создать demoPlaylist.ts с 8 сценариями
- [ ] Добавить playlist mode в demoDirector.ts
- [ ] Автопереключение сценариев по завершении

### Phase 4: Main Page
- [ ] Создать full-screen layout
- [ ] Интегрировать SorterDigitalTwin без HUD
- [ ] Добавить PlayButton.tsx
- [ ] Добавить DemoOverlay.tsx (минимальный)

### Phase 5: Camera Transitions
- [ ] Добавить lerp для camera position
- [ ] Добавить lerp для camera target
- [ ] Синхронизировать с demoDirector steps

### Phase 6: Polish
- [ ] Стили для full-screen
- [ ] Mobile responsive
- [ ] Тестирование всех 8 сценариев
- [ ] Performance check (target: 30+ FPS)

### Phase 7: QA
- [ ] Desktop 1920×1080: Play → 8 сценариев → loop
- [ ] Laptop 1440×900: То же
- [ ] Mobile 390×844: Fallback или simplified 3D
- [ ] /details: Полная функциональность

---

## Summary

**Текущее состояние:**
- 3D сцена работает
- Все компоненты готовы
- STL модели загружены
- DemoDirector с camera presets есть

**Что нужно сделать:**
- Роутинг (/ и /details)
- Playlist из 8 сценариев
- Full-screen режим главной
- Camera lerp transitions
- Минимальный overlay

**Оценка трудозатрат:**
- Phase 1-2: ~1 час
- Phase 3-4: ~2 часа
- Phase 5-6: ~1 час
- Phase 7: ~30 минут

**Total: ~4-5 часов**
