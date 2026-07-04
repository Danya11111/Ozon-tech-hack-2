# UI/UX Redesign Audit

## 1. Что сейчас плохо

- Перегруженность: первый экран похож на engineering debug-dashboard.
- Horizontal scroll из-за `min-width: 1180px` и жёстких grid-колонок.
- Слабая адаптивность: mobile не в одну колонку, мелкие tap targets.
- Debug-dashboard вместо product demo: много панелей сразу.
- Мелкий текст (11–13px) и плотная типографика.
- Непонятный первый экран: не ясно, что это за система и как запустить демо.

## 2. Цель редизайна

Сделать чистый, адаптивный product demo для защиты хакатона: за 10 секунд понятно, что это, как запустить и какой результат показать. Инженерные панели сохранить, но спрятать ниже.

## 3. Новая информационная архитектура

1. Hero — смысл, CTA, цепочка Detection → Classification → Command → Routing
2. Product Demo — сцена + карточка результата + управление
3. Storyline Stepper — текущий этап цикла
4. Scenario Cards — jury-сценарии карточками
5. Criteria Cards — покрытие критериев OZON
6. Engineering Details — сворачиваемые техпанели

## 4. Компоненты: создать / изменить

| Компонент | Действие |
|-----------|----------|
| HeroSection | создать / доработать |
| ProductDemoSection | создать / доработать |
| StorylineStepper | создать / доработать |
| ScenarioCards | создать / доработать |
| CriteriaCards | создать / доработать |
| EngineeringDetails | создать / доработать |
| Header | упростить до product-nav |
| App | собрать product page |
| SorterScene | добавить `variant: full \| simple` |
| styles.css | responsive redesign |

## 5. В Engineering Details

StateMachinePanel, TimelinePanel, PidPanel, EventLog, MetricsPanel, SensorPanel, ScenarioPanel, OzonCriteriaPanel, SorterScene `variant="full"`.

## 6. Риски

- Не сломать domain logic / tests.
- Не потерять инженерные функции для жюри.
- Не затронуть nginx / соседние проекты.
- Сохранить обработчики start / step / reset / scenario select.

## 7. Definition of Done

- Нет horizontal scroll на 1920 / 1440 / 390.
- Hero понятен, CTA видны.
- Demo ведёт по цепочке Detection → Routing.
- Engineering Details свёрнуты по умолчанию.
- `npm run build` и `npm run test` проходят.
- Docker `owl` отдаёт страницу на `:3100` и доменах.
