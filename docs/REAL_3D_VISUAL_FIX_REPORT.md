# 3D Visual Fix Report

**Дата:** 2026-07-04  
**Фиксер:** Claude Opus 4.5  
**Ветка:** `dan_branch`  
**Источник аудита:** `docs/REAL_3D_AUDIT_REPORT.md`

---

## 1. Что было плохо по REAL_3D_AUDIT_REPORT

| Проблема | Уровень | Описание |
|----------|---------|----------|
| Товар слишком мелкий | P0 | Scale 0.12–0.45 м, камера далеко, движение не видно |
| Камера слишком далеко | P0 | Позиция [6.2, 4.8, 6.2], товар и движение не видны |
| Низкий контраст сцены | P0 | Conveyor #1e3a54 на фоне #050910 сливается |
| Gate/pusher не видны | P1 | Чёрные элементы теряются на тёмном фоне |
| Маршрут не очевиден | P0 | Route arrows есть, но визуально не выделяются |
| Активная зона не подсвечивается | P1 | Зоны B/C/D не реагируют на активность |

---

## 2. Что исправлено

### P0: Товар визуально заметен ✅

- **VISUAL_SCALE_MULTIPLIER = 2.5** — товар увеличен в 2.5 раза для демо
- **emissiveIntensity** увеличена с 0.2 до 0.35–0.55 в зависимости от состояния
- **Glow ring под товаром** — яркое кольцо показывает позицию
- **Moving state** — во время движения товар ярче (emissiveIntensity 0.55)
- **Цвета по категориям**: B (зелёный), C (оранжевый), D (фиолетовый)

### P0: Камера приближена ✅

- **Desktop**: с [6.2, 4.8, 6.2] → [4.0, 3.0, 4.0]
- **Simplified**: с [5.5, 4.2, 5.5] → [3.8, 2.6, 3.8]
- **FOV**: с 42 → 45
- **minDistance**: с 4 → 2.5
- **maxDistance**: с 14 → 10
- **Target**: [0.6, 0.4, 0] (ближе к рабочей зоне)

### P0: Контраст сцены повышен ✅

| Элемент | Было | Стало |
|---------|------|-------|
| Background | #050910 | #0a1520 |
| Floor | #07111d | #0f1a2a |
| Conveyor frame | #1e3a54 | #3b5998 |
| Belt | #334155 | #5a6577 |
| Side guards | #475569 | #6b7a8f |
| Rollers | #334155 | #8b9cb0 |
| Grid cells | #1e3a54 | #2a4a6a |
| Grid sections | #284762 | #3a6080 |

- **ambientLight**: с 0.55 → 0.7
- **directionalLight**: с 0.9 → 1.1
- **Добавлен hemisphereLight** для мягкого заполнения

### P0: Активный маршрут очевиден ✅

- **Толщина активного route**: с 0.06/0.14 → 0.12/0.22
- **emissiveIntensity активного route**: с 0.55 → 0.8
- **Неактивные routes**: тоньше (0.04/0.08), бледнее (opacity 0.3)
- **Добавлен glow layer** под активным route

### P1: Gate/pusher видны ✅

- **Support posts**: цвет #7a8a9f (светлее), размер увеличен
- **Cross bar**: добавлена верхняя перекладина gate
- **Gate plate**: увеличена, emissive всегда активен
- **Pusher C**: ярко-оранжевый (#fbbf24 active / #d97706 inactive)
- **Pusher D**: ярко-фиолетовый (#d8b4fe active / #a78bfa inactive)
- **emissiveIntensity pushers**: 0.2 inactive → 0.6 active

### P1: Зоны подсвечиваются ✅

- **Активная зона**: opacity 0.6, emissiveIntensity 0.7
- **Неактивная зона**: opacity 0.2, emissiveIntensity 0.1
- **Highlight ring**: добавлено яркое кольцо над активной зоной
- **Roll-cage floor highlight**: подсветка пола активной корзины

### P1: Датчики видны ✅

- **Pole**: цвет #6b7a8f (светлее), размер 0.1
- **Sensor head**: увеличен до 0.32×0.2×0.26
- **Lens indicator**: добавлена "линза" датчика
- **Detection beam**: увеличен и ярче
- **Scan line effect**: добавлена визуальная линия сканирования

---

## 3. Какие файлы изменены

| Файл | Изменения |
|------|-----------|
| `src/components/ThreeD/Item3D.tsx` | VISUAL_SCALE_MULTIPLIER, glow ring, emissive boost |
| `src/components/ThreeD/SorterDigitalTwin.tsx` | Camera position, lighting, background, floor |
| `src/components/ThreeD/Conveyor3D.tsx` | Brighter colors, larger elements |
| `src/components/ThreeD/Actuator3D.tsx` | Gate structure, pusher visibility |
| `src/components/ThreeD/RouteArrows3D.tsx` | Thicker routes, glow layer |
| `src/components/ThreeD/SortingZones3D.tsx` | Active zone highlighting |
| `src/components/ThreeD/SensorRig3D.tsx` | Brighter sensors, detection effects |

---

## 4. До/После

### Товар

| Аспект | До | После |
|--------|-----|-------|
| Scale | 0.12–0.45 м | 0.30–1.125 м (×2.5) |
| emissiveIntensity | 0.2 | 0.35–0.55 |
| Glow ring | нет | есть |
| Moving highlight | нет | есть |

### Камера

| Аспект | До | После |
|--------|-----|-------|
| Position (desktop) | [6.2, 4.8, 6.2] | [4.0, 3.0, 4.0] |
| FOV | 42 | 45 |
| minDistance | 4 | 2.5 |

### Контраст

| Элемент | До (hex) | После (hex) |
|---------|----------|-------------|
| Background | #050910 | #0a1520 |
| Conveyor | #1e3a54 | #3b5998 |
| Belt | #334155 | #5a6577 |

### Маршруты

| Аспект | До | После |
|--------|-----|-------|
| Active thickness | 0.06/0.14 | 0.12/0.22 |
| Active emissive | 0.55 | 0.8 |
| Glow layer | нет | есть |

### Механизмы

| Элемент | До | После |
|---------|-----|-------|
| Gate posts | #475569, 0.04 | #7a8a9f, 0.06 |
| Gate plate | 0.08×0.05 | 0.1×0.08 |
| Pusher active emissive | 0.35 | 0.6 |

---

## 5. Evidence screenshots

| Файл | Описание |
|------|----------|
| `desktop_3d_idle_after_fix.png` | 3D сцена в idle, конвейер и зоны видны |
| `desktop_3d_autodemo_t0.png` | Auto demo t=0, товар виден |
| `desktop_3d_autodemo_t3.png` | Auto demo t=3s |
| `desktop_3d_autodemo_t6.png` | Auto demo t=6s |
| `desktop_proof_panel_after_fix.png` | Proof panel с Category/Command/Target |
| `laptop_1440_after_fix.png` | Laptop viewport, 2D fallback |
| `mobile_390_fallback_after_fix.png` | Mobile viewport, 2D fallback |

**Screenshots location:** `docs/visual_fix_screenshots/`

---

## 6. Остаточные ограничения

1. **Движение между t=0/t=3/t=6** — state-machine может быть в одном состоянии если цикл ещё не завершился
2. **Browser MCP WebGL** — некоторые браузерные эмуляции могут не поддерживать WebGL
3. **Laptop 1440px** — показывает 2D fallback из-за двухколоночного layout (ширина demo секции < 640px)
4. **Physics engine** — не подключен (по требованию)

---

## 7. Честный вердикт

| Критерий | Статус | Комментарий |
|----------|--------|-------------|
| Товар визуально заметен | ✅ ГОТОВО | ×2.5 scale, glow ring, emissive |
| Камера приближена | ✅ ГОТОВО | [4.0, 3.0, 4.0], minDistance 2.5 |
| Конвейер контрастный | ✅ ГОТОВО | #3b5998 на #0a1520 |
| Gate/pusher видны | ✅ ГОТОВО | Brighter colors, emissive |
| Активный route очевиден | ✅ ГОТОВО | Thick, glow, high emissive |
| Активная зона подсвечена | ✅ ГОТОВО | Highlight ring, floor glow |
| Labels не мешают | ✅ ГОТОВО | cleanView по умолчанию |
| Build green | ✅ ГОТОВО | npm run build успешен |
| Tests green | ✅ ГОТОВО | 43 тестов passed |
| Docker green | ✅ ГОТОВО | owl-web-1 running |
| Domains 200 | ✅ ГОТОВО | arhipovdan.ru, www.arhipovdan.ru |
| No console errors | ✅ ГОТОВО | Проверено через CDP |

**Общий вердикт: ГОТОВО к защите**

3D Digital Twin теперь визуально доказывает работу ПАК:
- Товар виден
- Конвейер контрастный
- Gate/pusher видны
- Маршрут очевиден
- Зоны подсвечиваются

---

## 8. Build/Test/Docker результаты

```
npm run build: ✅ успешно (568ms)
npm run test: ✅ 43 tests passed (519ms)
docker: ✅ owl-web-1 running
curl http://127.0.0.1:3100/: ✅ 200 OK
curl https://arhipovdan.ru/: ✅ 200 OK
curl https://www.arhipovdan.ru/: ✅ 200 OK
```

---

## 9. Команды для commit/push

```bash
cd /opt/arhipovdan/app
git status
git add .
git commit -m "fix: improve 3D digital twin visual clarity

- Increase item visual scale ×2.5 with glow ring
- Move camera closer [4.0, 3.0, 4.0]
- Improve scene contrast (brighter conveyor, floor)
- Add glow to active routes
- Enhance gate/pusher visibility
- Add highlight rings to active zones
- Brighten sensors with detection effects

Based on REAL_3D_AUDIT_REPORT.md P0/P1 fixes."
git push origin dan_branch
```
