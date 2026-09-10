# Визуальные референсы Studio

Курируемый набор: только уникальные состояния интерфейса, без дублей.
Каждый файл сопровождён списком того, ради чего он здесь.

## Снято на нашем локальном графе

Автоматизация Chrome (Playwright по CDP) поверх `langgraph dev` с графом
`__start__ → agent ⇄ action → __end__`. Чистые кадры без наложений.

| Файл | Что показывает |
|---|---|
| `studio-01-graph-light.png` | Общий вид, светлая тема. Шапка `Studio / agent ▾`, переключатель `Graph│Chat`, `Deploy`, `● Connected`, `Interact│Trace`, `Run experiment`. Слева вертикальная панель зума (in / out / fit / reset), кнопки `Memory` и `Interrupts` |
| `studio-02-graph-dark.png` | То же в тёмной теме. Узлы: `__start__`/`__end__` серые «таблетки», `agent` фиолетовый с точкой-хэндлом, `action` голубой; условные рёбра пунктиром |
| `studio-03-interrupts-dialog.png` | Диалог `Interrupts`: строки узлов с чекбоксами `Before` / `After`, пункт `Interrupt on all` |
| `studio-04-memory-store.png` | Панель `Memory` — полный CRUD Store: слева список («No items found»), справа форма `Add new item` с `Key`, `Namespace`, `Value` (YAML), кнопки `Reset` / `Save` |
| `studio-05-assistants-modal.png` | `Manage Assistants`: слева список + `+ New` с бейджем `● Active`, справа форма — `Assistant ID`, `Assistant Name`, `System Prompt` с пометкой **`Used in node: (A)`**, `Model`, `Recursion limit`; внизу `Cancel` / `Create New Assistant`, тумблер `Active` |
| `studio-06-input-yaml-error.png` | Панель `Input` в режиме редактора: `View Raw`, бейдж `Required`, формат `YAML ▾` / `RAW`, **живая ошибка парсинга** под полем |
| `studio-07-thread-log.png` | Лог треда (`Interact`): `TURN 1`, записи «аватар + ▸ + имя узла», карточки `HUMAN` / `AI`, относительное время, слайдер детализации, стрелки ↑↓ истории ввода |
| `studio-08-trace-tab.png` | Вкладка `Trace`: панель `Turns` и `Feedback / Input / Output`. Без `LANGSMITH_API_KEY` — «No runs found»; подтверждает, что вкладка целиком облачная |

## Кадры официального ролика «LangSmith Studio v2»

Источник: <https://www.youtube.com/watch?v=Mi1gSlHwZLM>. Здесь только те состояния,
которых нет в наших снимках. Полная покадровая расшифровка — в `VIDEO.md`.

| Файл | Время | Что показывает |
|---|---|---|
| `video-01-chat-mode.png` | 0:14 | **Chat mode** целиком: `HUMAN` справа компактно, `AI` слева широко с копированием и retry, панель `Threads` с превью первых сообщений и `+ New`, `Scroll to top`, круглая `Cancel` со спиннером в поле ввода, `mode=chat` в URL |
| `video-02-input-form-rerun-output.png` | 1:34 | Панель `Input` **в режиме формы**: `💬 Messages` + кнопка **`+ Message`** (значит `View Raw` переключает форму ↔ YAML). В логе — **`View state`** и **`Re-run from here`**, `agent ✏️ View LLM run`, секция **`OUTPUT`** внизу |
| `video-03-paused-node-interrupt.png` | 2:00 | **Прерывание**: счётчик **`Interrupts 1`**, приостановленный узел `tools` подсвечен, остальные приглушены, внизу кнопка `Cancel`. Под записями — иконки **fork** и **edit** |
| `video-04-state-tree-fork.png` | 2:26 | **Дерево состояния** с раскрытием (`0 → 0 → messages → 1 → AI`), переключатель веток **`← → Fork 2 of 2`**, карточка вызова инструмента с аргументами (`query`, `answer`, `response_time`, `results`), аватары узлов `(A)` и `(T)` |
| `video-05-view-llm-run.png` | 1:42 | Переход `View LLM run` → Playground (облачная функция) |
| `video-06-clone-thread.png` | 4:22 | `Run in Studio` → `Clone thread locally` — копирование продового треда в локальный сервер (облачная функция) |

## Чего в наборе нет

Полная пачка из 121 кадра ролика осталась во временной папке сессии и в репозиторий не попала —
в `VIDEO.md` сохранены тайминги и реплики, по ним кадр всегда можно переснять.
