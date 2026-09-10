# Исследование: как устроен LangGraph / LangSmith Studio

Документ фиксирует результаты разбора официальной документации и реверс-инжиниринга
установленных пакетов. Все факты ниже **проверены на живом сервере** (`langgraph dev`,
`langgraph-api 0.14.0`, `langgraph 1.2.11`, `langgraph-cli 0.4.31`, `langgraph-sdk 0.4.4`),
если не указано иное.

## 1. Ключевой вывод

**Studio — это не часть локального сервера.** Это SPA, размещённый на `smith.langchain.com`,
который по HTTP обращается к вашему локальному Agent Server:

```
langgraph dev  →  http://127.0.0.1:2024                 (API + /docs + /openapi.json)
Studio UI      →  https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

Формула URL зашита в `langgraph_api/cli.py`:

```python
studio_origin = studio_url or _get_ls_origin() or "https://smith.langchain.com"
full_studio_url = f"{studio_origin}/studio/?baseUrl={local_url}"
```

Отсюда три следствия:

1. Весь Studio целиком построен поверх **публичного, документированного HTTP API**.
   Никаких приватных каналов — всё, что делает Studio, воспроизводимо.
2. Схема `?baseUrl=` порождает **cross-origin**: страница на `https://smith.langchain.com`
   ходит на `http://127.0.0.1:2024`. Отсюда в сервере есть `CORS_ALLOW_ORIGINS` (по умолчанию `*`),
   `ALLOW_PRIVATE_NETWORK` + `PrivateNetworkMiddleware` (заголовок
   `Access-Control-Allow-Private-Network`), а в CLI — флаг `--tunnel`
   («*avoids issues with browsers or networks blocking localhost connections*»).
   Это ровно тот класс проблем, который снимает наша архитектура.
3. Есть флаг `langgraph dev --studio-url TEXT`, подменяющий origin Studio. Он оставлен
   как запасной вариант, но в основном режиме нам не нужен (см. `REQUIREMENTS.md`).

Проверено экспериментально: Studio из браузера **не смог** подключиться к локальному серверу
(`Failed to fetch`), а также вернул `403 Forbidden` без аккаунта LangSmith. То есть текущий
Studio требует и внешний origin, и облачный логин.

## 2. Точка встраивания: `http.app`

`langgraph_api/api/__init__.py` умеет загружать пользовательское Starlette/FastAPI-приложение,
путь к нему берётся из `langgraph.json`:

```json
{
  "dependencies": ["."],
  "graphs": { "agent": "./agent.py:graph" },
  "http": { "app": "./webapp.py:app" }
}
```

Механизм (`load_custom_app`) принимает как `path/to/file.py:app`, так и `module.path:app`,
и требует, чтобы объект был экземпляром `Starlette` (FastAPI подходит — он наследник).

Порядок сборки маршрутов в `langgraph_api/server.py`:

```python
app.router.routes = (
      unshadowable_meta_routes      # /ok, /metrics, /docs, /openapi.json — перекрыть нельзя
    + user_app                      # ← НАШИ маршруты, приоритет выше API
    + shadowable_meta_routes        # /, /info
    + [protected_mount]             # /assistants, /threads, /runs, /store, /mcp, /a2a
)
```

`/studio` не конфликтует ни с одной группой. **Проверено на живом сервере:**

| Проверка | Результат |
|---|---|
| `GET /studio` (наш SPA) | `200` |
| `GET /studio/static/app.js` (наша статика) | `200` |
| `POST /assistants/search` (штатный API) | `200` |
| `GET /docs` (штатные доки) | `200` |
| `fetch('../assistants/search')` из SPA, same-origin | `200`, вернул 1 ассистента |

Последняя строка — главная: SPA, отданный с `/studio`, обращается к API **относительным путём
на том же origin**. Ни CORS, ни preflight, ни `?baseUrl=`, ни PNA-заголовков.

## 3. Полный HTTP API (49 путей, снято с живого `/openapi.json`)

### Assistants — конфигурации графа
```
POST   /assistants                          создать
POST   /assistants/search                   список (limit/offset/metadata/graph_id)
POST   /assistants/count
GET    /assistants/{id}                     получить
PATCH  /assistants/{id}                     изменить (создаёт новую версию)
DELETE /assistants/{id}
GET    /assistants/{id}/graph?xray=1        СТРУКТУРА ГРАФА для отрисовки
GET    /assistants/{id}/schemas             input/output/state/config/context схемы
GET    /assistants/{id}/subgraphs           подграфы
GET    /assistants/{id}/subgraphs/{ns}
POST   /assistants/{id}/versions            список версий
POST   /assistants/{id}/latest              откат/промоут версии
```

### Threads — состояние и история
```
POST   /threads                             создать
POST   /threads/search                      список (status/metadata/values)
POST   /threads/count
GET    /threads/{id}                        метаданные + status
PATCH  /threads/{id}
DELETE /threads/{id}
POST   /threads/{id}/copy                   дублировать
POST   /threads/prune
GET    /threads/{id}/state                  текущее состояние
POST   /threads/{id}/state                  ОБНОВИТЬ состояние → ФОРК
GET    /threads/{id}/state/{checkpoint_id}  состояние на чекпоинте
POST   /threads/{id}/state/checkpoint
GET    /threads/{id}/history                история (time travel)
POST   /threads/{id}/history                история с фильтрами
POST   /threads/{id}/commands
```

### Runs — запуски и стриминг
```
POST   /threads/{id}/runs                   фоновый запуск
GET    /threads/{id}/runs                   список запусков
POST   /threads/{id}/runs/stream            SSE-стрим (основной режим Studio)
POST   /threads/{id}/runs/wait              синхронно
GET    /threads/{id}/runs/{run_id}
DELETE /threads/{id}/runs/{run_id}
POST   /threads/{id}/runs/{run_id}/cancel   отмена (?action=interrupt|rollback)
GET    /threads/{id}/runs/{run_id}/join     дождаться результата
GET    /threads/{id}/runs/{run_id}/stream   переподключиться к стриму
GET    /threads/{id}/stream                 стрим по треду
POST   /threads/{id}/stream/events          event streaming v2
POST   /runs, /runs/stream, /runs/wait, /runs/batch, /runs/cancel   stateless
```

### Crons / Store / прочее
```
POST   /runs/crons, /runs/crons/search, /runs/crons/count
GET|PATCH|DELETE /runs/crons/{cron_id}
POST   /threads/{id}/runs/crons
GET|PUT|DELETE /store/items                 долговременная память
POST   /store/items/search, /store/namespaces
GET    /info    /ok    /metrics    /docs    /openapi.json
POST   /a2a/{assistant_id}                  agent-to-agent
GET|POST|DELETE /mcp/                       MCP-сервер
```

### Внутренние маршруты in-memory рантайма
Соответствуют кнопкам **Deploy** / **Logs** в нижней панели Studio
(`langgraph_runtime_inmem/routes.py`):
```
POST /deploy                          запустить `langgraph deploy`
GET  /deploy                          статус
GET  /deploy/{operation_id}/stream    SSE-лог деплоя
GET  /internal/debug/thread/{id}
POST /internal/truncate
```
Их origin-политика жёстко ограничена списком `smith.langchain.com` + localhost.

## 4. Форматы данных (снято живьём)

### 4.1 Структура графа — `GET /assistants/{id}/graph?xray=1`

Для графа из четырёх узлов (совпадает с эталонным скриншотом Studio):

```json
{
  "nodes": [
    {"id": "__start__", "type": "runnable", "data": {"name": "__start__"}},
    {"id": "agent",     "type": "runnable", "data": {"name": "agent"}},
    {"id": "action",    "type": "runnable", "data": {"name": "action"}},
    {"id": "__end__"}
  ],
  "edges": [
    {"source": "__start__", "target": "agent"},
    {"source": "action",    "target": "agent"},
    {"source": "agent", "target": "__end__", "data": "end",      "conditional": true},
    {"source": "agent", "target": "action",  "data": "continue", "conditional": true}
  ]
}
```

Правила отрисовки, которые отсюда следуют:
- `conditional: true` → **пунктирное** ребро, `data` → подпись на ребре (`continue`, `end`);
- обычное ребро → сплошная линия;
- `__start__` / `__end__` — служебные узлы с собственным оформлением;
- `?xray=1` разворачивает подграфы.

### 4.2 Схемы — `GET /assistants/{id}/schemas`

Возвращает `graph_id`, `input_schema`, `output_schema`, `state_schema`, `config_schema`,
`context_schema` — обычный JSON Schema. Именно из `input_schema` Studio строит форму **Input**,
из `config_schema` — панель **Configurable**.

Критично: аннотации из кода **доезжают до схемы как есть**:

```json
"system_prompt": {
  "type": "string",
  "default": "You are a helpful AI assistant.",
  "description": "System prompt",
  "langgraph_nodes": ["agent"],
  "langgraph_type": "prompt"
}
```

- `langgraph_nodes` — к каким узлам графа привязано поле. Даёт иконку-шестерёнку на узле.
- `langgraph_type: "prompt"` — поле рендерится как редактор промпта (многострочный).

### 4.3 SSE-стрим — `POST /threads/{id}/runs/stream`

`stream_mode` принимает массив. Реальная последовательность событий:

```
event: metadata      {"run_id": "...", "attempt": 1}
event: checkpoints   {config, parent_config, values, metadata:{step,source}, next, tasks}
event: debug         {step, timestamp, type: "checkpoint"|"task"|"task_result", payload}
event: tasks         {id, name, input, triggers, metadata}          ← вход в узел
event: updates       {"agent": {"messages": [...]}}                 ← дельта по узлу
event: tasks         {id, name, error, result, interrupts}          ← выход из узла
event: values        {"messages": [...]}                            ← полное состояние
```

Как это ложится на UI:
- `tasks` (вход) → подсветка активного узла в графе;
- `tasks` (выход) → снятие подсветки, показ результата/ошибки;
- `checkpoints.next` → какие узлы пойдут следующими;
- `updates` → дельты для лога треда;
- `values` → полное состояние для панели справа;
- `messages` (отдельный режим) → потокенный стрим для chat mode.

### 4.4 История и форк

`POST /threads/{id}/history` возвращает список чекпоинтов, каждый с полями
`checkpoint`, `parent_checkpoint`, `values`, `next`, `tasks`, `metadata{step, source}`,
`interrupts`, `created_at`. Связи `parent_checkpoint → checkpoint` образуют **дерево**,
по которому строится time travel и ветвление.

Пример живой истории:

```
step=3  src=loop   next=[]         tasks=[]
step=2  src=loop   next=[agent]    tasks=[agent]
step=1  src=loop   next=[action]   tasks=[action]
step=0  src=loop   next=[agent]    tasks=[agent]
step=-1 src=input  next=[__start__] tasks=[__start__]
```

**Форк** (кнопка *Edit node state* → *Fork*) — это `POST /threads/{id}/state`:

```json
{ "checkpoint": {"checkpoint_id": "<чекпоинт, от которого ветвимся>"},
  "values":     {"messages": [...]},
  "as_node":    "agent" }
```

Ответ — новый `checkpoint_id`, дочерний к указанному. Проверено: форк создаётся.
*Re-run from here* — то же самое, но без `values`.

### 4.5 Прерывания (breakpoints)

Запуск с `"interrupt_before": ["action"]` (или `interrupt_after`) останавливает граф.
Проверено:

```
GET /threads/{id}         → {"status": "interrupted"}
GET /threads/{id}/state   → {"next": ["action"], "tasks": [{"name": "action", ...}]}
```

Продолжение — новый run с `"input": null` (кнопка **Continue**).
Динамические `interrupt()` из графа приходят в поле `interrupts` у задач и чекпоинтов.

### 4.6 Ассистенты

```json
{ "assistant_id": "fe096781-...", "graph_id": "agent", "config": {}, "context": {},
  "metadata": {"created_by": "system"}, "name": "agent", "version": 1,
  "created_at": "...", "updated_at": "...", "description": null }
```

Для каждого графа из `langgraph.json` сервер автоматически создаёт **default assistant**.
`PATCH` создаёт новую версию; `POST /assistants/{id}/versions` — список версий;
`POST /assistants/{id}/latest` — откат на версию.

### 4.7 `GET /info`

```json
{ "version": "0.14.0", "langgraph_py_version": "1.2.11",
  "flags": {"assistants": true, "crons": true, "langsmith": false, ...},
  "host": {"kind": "self-hosted", ...} }
```

Используется для отображения статуса сервера и включения/выключения фич по флагам.

## 5. Функциональность Studio (по официальной документации)

Источник: `docs.langchain.com/langsmith/use-studio`, `.../studio`, `.../observability-studio`.

### Graph mode — полный режим

**Input**
- Форма строится по `input_schema`; кнопка **View Raw** переключает в JSON-редактор.
- Стрелки ↑/↓ листают ранее отправленные входы.

**Run settings**
- **Settings** / **Manage Assistants** в левом нижнем углу: выбор ассистента и его версии,
  переключатель **Active**. Пункт **Default configuration** отражает конфиг из кода;
  правки применяются к рантайму, но не создают ассистента, пока не нажать **Create new assistant**.
- Переключатель стриминга — в выпадающем меню рядом с **Submit**.
- **Interrupt**: выбрать узел и before/after → точка останова. Возобновление — **Continue**.

**Submit / Cancel** — запуск добавляется в выбранный тред; если тред не выбран, создаётся новый.

**Threads**
- Выпадающий список тредов сверху правой панели, **+ New Thread**.
- Слайдер детализации сверху; сворачивание/разворачивание ходов, узлов и ключей состояния.
- Переключатель **Pretty** / **JSON**.

**Edit thread history**
- ✏️ **Edit node state** → правка вывода узла → **Fork**.
- **Re-run from here** — форк без изменения состояния (например, под другого ассистента).

**Работа с промптами**
- Шестерёнка на узлах, у которых есть привязанные конфиг-поля (`langgraph_nodes`);
  редактирование → сохранить в текущую версию ассистента или создать новую.
- **View LLM Runs** на узле → список LLM-вызовов → открыть в **Playground**.

**LangSmith-интеграции**
- **Run experiment** (правый верхний угол) → выбор датасета/сплита → **Start**, прогресс в бейдже.
- **Add to Dataset** → выбор узлов → правка input/output → **Add to dataset**.
- Клонирование удалённых тредов в локальный агент из трейса LangSmith.

**Deploy** — деплой в LangSmith Cloud в один клик (нижняя панель).

### Chat mode — упрощённый режим
Доступен только для графов, чьё состояние включает/расширяет `MessagesState`.
- Ввод внизу панели диалога, кнопка **Send message**, ответ стримится.
- **Cancel** прерывает запуск.
- Переключатель **Show tool calls**.
- Треды — в правой панели, создание через **+**.
- ✏️ под человеческим сообщением → правка → форк ветки.
- Иконка retry под сообщением ИИ → перегенерация.
- Переключение ассистентов — выпадающим списком сверху.

### Нижняя панель локального режима
`Online` + адрес сервера слева; справа — **Deploy**, **Configure**, **Open in VSCode**, **Logs**.

## 6. Внешние проекты и что они дают

| Компонент | Лицензия | Пригодность |
|---|---|---|
| `langgraph-sdk` (Python) | MIT | Бэкенд-клиент, если понадобится серверная прослойка |
| `@langchain/langgraph-sdk` (npm 1.10.2) | MIT | **Транспорт фронта — подключаем как зависимость.** Экспорты: `.`, `./react`, `./ui`, `./auth`, `./utils`; хук `useStream` берёт на себя SSE, треды, ветвление |
| `vkfolio/Vizlang` | MIT | Источник инженерных уроков. Код не заимствуем — см. `VIZLANG-NOTES.md` |
| `langchain-ai/agent-chat-ui` | MIT | Образец chat mode для подглядывания глазами: Next.js + Tailwind + shadcn/ui. Графы не рисует |
| Сам Studio | закрытый исходник | Только как визуальный эталон |

### 6.1 VizLang — краткая справка

Репозиторий `github.com/vkfolio/Vizlang`, MIT, TypeScript, webview ~3900 строк, последний
push — июнь 2026. Девиз: *«No cloud service. No API keys. No accounts. Everything runs locally.»* —
цель совпадает с нашей.

Стек, к которому мы пришли независимо, у них тот же: React Flow, dagre, React, Tailwind,
Radix UI, Vite, zustand. Это подтверждает выбор.

Архитектура при этом принципиально другая:

```
VizLang:  VS Code extension ──мост──▶ свой загрузчик и исполнитель графа на Python
Наш:      браузер ──HTTP/SSE──▶ Agent Server API (/threads, /runs/stream)
```

VizLang читает граф из исходника и исполняет сам, Agent Server API не использует. Поэтому
тредов, чекпоинтов, ассистентов и форков в нашем смысле у него нет.

**Код не заимствуем** — ни строчки. Проект полезен как источник инженерных уроков: какие
задачи возникают при отрисовке графа LangGraph и какие из них неочевидны. Разбор —
в [`VIZLANG-NOTES.md`](VIZLANG-NOTES.md).

## 7. Живой UI Studio — что видно только на референсах

Материал: `docs/references/` — скриншоты, снятые автоматизацией Chrome на нашем локальном графе,
и `docs/references/VIDEO.md` — 121 кадр официального ролика «LangSmith Studio v2» с шагом 4 с,
каждый кадр сопровождён репликой из субтитров.

Снято автоматизацией Chrome на нашем локальном графе. Отличия от того, что описано в документации:

| Находка | Значение |
|---|---|
| Переключатель **`Interact │ Trace`** | Правая панель имеет два режима, а не «Pretty/JSON», как сказано в доках |
| Вкладка **Trace** пуста без `LANGSMITH_API_KEY` («No runs found»), внутри — `Turns` и `Feedback / Input / Output` | Trace — целиком облачная функция; локально нереализуема |
| Кнопка **`Memory`** прямо в панели графа, рядом с `Interrupts` | Store — заметная функция первого уровня, а не второстепенная |
| Формат ввода — **`YAML`** по умолчанию, переключатель `YAML ▾` и `RAW` | Мы предполагали JSON. Нужен YAML-редактор с валидацией |
| Ошибка парсинга показывается **под редактором**: `Error YAMLParseError: … at line 1, column 9` | Живая валидация ввода — обязательна |
| Бейдж **`Required`** / `Optional` у поля ввода | Берётся из `required` в `input_schema` |
| **`Used in node: (A)`** — кружок с буквой рядом с полем конфига | Так рисуется `langgraph_nodes` |
| **`Recursion limit`** в модалке ассистента (значение 25) | Встроенное поле, которого нет в `config_schema` |
| Модалка ассистентов: слева список + `+ New`, справа форма, внизу `Cancel` / `Create New Assistant`, тумблер `Active` | Точная раскладка |
| Диалог `Interrupts`: строки узлов с чекбоксами `Before` / `After` + пункт `Interrupt on all` | Точная раскладка |
| Лог треда: заголовок `TURN 1`, записи «иконка + ▸ + имя узла», внутри карточки `HUMAN` / `AI`, относительное время («8 секунд назад») | Структура лога |
| Стрелки **↑ ↓** рядом с заголовком `Input` | История отправленных входов |
| Слева у графа вертикальная панель: zoom in, zoom out, fit, reset | Панель инструментов |
| Бейдж **`● Connected`** и кнопка `Deploy` в шапке | Индикация соединения |
| Цвета узлов: `__start__` и `__end__` — **серые**; `agent` — фиолетовый с точкой-хэндлом; `action` — голубой | Уточнение палитры |

## 7. Источники

- https://docs.langchain.com/langsmith/studio
- https://docs.langchain.com/langsmith/use-studio
- https://docs.langchain.com/langsmith/observability-studio
- https://docs.langchain.com/langsmith/assistants
- https://docs.langchain.com/langsmith/custom-routes
- https://docs.langchain.com/langsmith/local-dev-testing
- https://docs.langchain.com/langsmith/double-texting
- https://docs.langchain.com/langsmith/event-streaming
- https://docs.langchain.com/langsmith/cli
- Исходники: `langgraph-api 0.14.0`, `langgraph-runtime-inmem 0.34.0`, `langgraph-cli 0.4.31`
