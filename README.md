# OWL PRIME — Ozon Tech Track 3

## О проекте

OWL PRIME — инженерный контур предварительной сортировки товаров: веб-цифровой двойник конвейерной линии, классификация B/C/D, физическая маршрутизация в симуляции, рабочий CV-прототип на RealSense D415 и экспериментальный физический стенд.

Это не сертифицированный промышленный ПАК, а воспроизводимое решение хакатона: цифровой twin на проде, CV-прототип в репозитории, CAD/ассеты и документация для проверки судьями.

## Состав решения

1. **Web digital twin** — React/Three.js симуляция конвейера, измерения, classifier, diverters.
2. **CV-прототип** — `cv/`: RealSense D415 + OpenCV → габариты / круг → B/C/D.
3. **CAD и runtime 3D** — авторский FreeCAD и GLB/STL для деплоя.
4. **Физический стенд** — лента, рама, камера над полотном, электроника/SCADA.
5. **Документация** — `/documentation`, `docs/ENGINEERING.md`.
6. **Презентация** — `presentation/Owl_Prime_Ozon_Tech_Track_3_FINAL.pdf`.

## Демо

**Production:** https://ozon-tech-sorter.ru

| Route | Назначение |
|---|---|
| `/` | Непрерывная симуляция |
| `/documentation` | Инженерный статус |
| `*` | Редирект на `/` |

- **Desktop:** интерактивный WebGL 3D.
- **Mobile:** облегчённый 2D fallback (как в текущем baseline).

Идентичность сборки: `/version.json`.

## Основные возможности

- непрерывный CAD-конвейер и STL-товары;
- цифровой этап камеры / измерения;
- rule-based classifier B/C/D;
- CAD-дивертеры LEFT/RIGHT (−45° / +45°);
- физика Rapier (лента 1 м/с);
- CV-прототип depth→B/C/D (не в live web);
- инженерная документация в приложении.

## Правила классификации

Официальные границы (`official_sources/doc-1783095831.pdf`), реализованы в web (`src/domain/classifier.ts`) и CV (`cv/classify.py`):

1. Габариты строго **> 10×10×10 мм** и **< 450×320×320 мм**, иначе → **C**.
2. Если габариты OK и **K > 0.8** (круг) → **D**.
3. Иначе → **B**.
4. **C-priority:** негабарит + круг → только **C**.
5. Граница: **K = 0.8 не круг** (→ B, не D). Одинаково в web и CV.

## Архитектура

**Web**

```
Product → measurement (digital) → classifier → route → twin → B/C/D receiver
```

**CV**

```
RealSense D415 → depth → segmentation → L×W×H + K → B/C/D → optional MQTT
```

CV **не подключён** к https://ozon-tech-sorter.ru. Общее — домен правил B/C/D, не live-канал кадров.

## Технологии

| Слой | Стек |
|---|---|
| Web | React, TypeScript, Three.js / R3F, Rapier, Vite, Vitest, Playwright |
| CV | Python, OpenCV, RealSense D415 (V4L2), optional MQTT (`paho-mqtt`) |

## Структура репозитория

```
.github/           CI
3d_models/         Авторский CAD (conveer.FCStd)
cv/                CV-прототип RealSense + OpenCV
docs/              Engineering notes
e2e/               Playwright smoke/routes
input_info/        Официальные входные пакеты
official_sources/  PDF с границами classifier
presentation/      Финальная презентация (один PDF)
public/            Runtime GLB/STL/draco
src/               Web twin
```

Конфиги деплоя: `Dockerfile`, `docker-compose.server.yml`, `nginx.conf`, `package.json`.

## Запуск web

Node.js 20+.

```bash
npm ci
npm run dev          # http://127.0.0.1:3100
npm test -- --run
npm run build
npm run preview      # http://127.0.0.1:3100
```

## Запуск CV

Python 3.10+. Live-режим требует Intel RealSense D415 и ffmpeg.

```bash
cd cv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml   # MQTT выключен по умолчанию

# без камеры:
python test_classify.py
python test_geometry.py

# с камерой:
./demo.sh                 # HUD http://127.0.0.1:8080/
./run.sh --preview --no-mqtt --no-motor
```

Подробности: [`cv/README.md`](cv/README.md). `npm` CV-зависимости не ставит.

## Конфигурация

- `.env` **не** коммитится.
- Web: опционально `VITE_BUILD_COMMIT` / `VITE_BUILD_BRANCH` / `VITE_BUILD_RELEASE` для `/version.json`.
- CV: `cv/config.example.yaml` → локальный `cv/config.yaml` (gitignored). MQTT/motor/routing **disabled by default**. Секреты не хранить в Git.

## CAD и модели

| Файл | Роль |
|---|---|
| `3d_models/conveer.FCStd` | Авторский CAD |
| `public/models/sorter/conveyor-clean.glb` | Runtime конвейер |
| `public/models/*.stl` | Модели товаров |

Крупные материалы для сдачи дополнительно зеркалируйте в облако; runtime-ассеты для деплоя остаются в Git.

## Физика (текущий main)

- скорость ленты **1.0 м/с**;
- timestep **1/60 с**;
- CCD для лёгких/тонких тел;
- diverters −45° / +45°;
- полный contact-only junction sorting **не fully validated**.

## Проверка

```bash
npm ci && npm test -- --run && npm run build
# E2E: preview :3101 + e2e/routes.spec.ts + e2e/smoke.spec.ts

cd cv && python -m compileall . && python test_classify.py && python test_geometry.py
```

Актуальный релиз: unit **196/196**, build PASS, focused E2E PASS, CV compile + unit без камеры PASS. Прод: `/` и `/documentation` → 200.

## Ограничения

- инженерный прототип, не industrial-certified ПАК;
- CV не live-интегрирован в web;
- live CV требует D415; на CI — только unit/compile;
- параметры симуляции требуют калибровки на стенде;
- mobile — 2D lite fallback;
- облачная ссылка на доп. материалы — по решению владельца.

## Материалы

- Презентация: [`presentation/Owl_Prime_Ozon_Tech_Track_3_FINAL.pdf`](presentation/Owl_Prime_Ozon_Tech_Track_3_FINAL.pdf)
- Production: https://ozon-tech-sorter.ru
- Cloud folder: `[ДОБАВИТЬ ССЫЛКУ]`

## Статус

**`main` — каноническое полное решение.** Другие ветки исторические и не нужны для запуска web или CV.
