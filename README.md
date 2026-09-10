# LangGraph Studio OSS

Открытая альтернатива LangSmith Studio. Интерфейс поднимается **на том же порту, что и ваш
Agent Server**, и доступен по пути `/studio`:

```
langgraph dev  →  http://127.0.0.1:2024/studio      ← интерфейс
                  http://127.0.0.1:2024/assistants  ← API там же
```

Ни облака, ни аккаунта, ни параметра `?baseUrl=`, ни запросов между origin.

## Зачем

Штатный Studio живёт на `smith.langchain.com` и обращается к вашему серверу снаружи.
Отсюда три проблемы, каждая из которых воспроизводится за минуту:

- браузер блокирует запрос с `https://smith.langchain.com` на `http://127.0.0.1:2024`;
- без аккаунта LangSmith интерфейс отвечает `403`;
- при обходе через `--tunnel` домен туннеля отвергается списком разрешённых.

Интерфейс, отданный тем же сервером, снимает все три разом.

## Установка

```bash
pip install langgraph-studio-oss
```

В `langgraph.json` вашего проекта:

```json
{
  "dependencies": ["."],
  "graphs": { "agent": "./agent.py:graph" },
  "http": { "app": "langgraph_studio_oss:app" }
}
```

Запустите `langgraph dev` и откройте <http://127.0.0.1:2024/studio>.

### Если свой `http.app` уже есть

```python
from langgraph_studio_oss import mount_studio
from my_project.webapp import app

mount_studio(app)                      # добавит /studio, ничего не сломав
mount_studio(app, path="/lg-studio")   # или на другом пути
```

### Если `langgraph.json` править нельзя

Тогда интерфейс поднимается отдельным процессом и сам проксирует API — origin
по-прежнему один, cross-origin не возникает:

```bash
pip install "langgraph-studio-oss[proxy]"
langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100
# → http://127.0.0.1:8100/studio
```

## Что умеет

- **Граф**: раскладка как в оригинале, условные рёбра, служебные узлы, перетаскивание,
  зум и мини-карта, подсветка работающего узла во время прогона.
- **Запуск**: форма по `input_schema` (YAML/JSON), `Submit`, `Cancel`, история ввода.
- **Треды**: список, переключение, лог хода тремя уровнями детализации, `View state`,
  относительное время, `Open thread via ID`, `Cancel all pending runs`.
- **Отладка состояния**: `Re-run from here`, правка состояния узла (`Fork`), переключение
  веток, ошибки прогона с `Continue`.
- **Прерывания**: `Before`/`After` на любом узле, `Interrupt on all`, продолжение с паузы,
  ответ на динамический `interrupt()`, запись значения от имени узла (`As Node`).
- **Ассистенты**: `Manage Assistants` — список, создание, правка с версиями, удаление,
  поля `config_schema`, настройки отдельного узла по шестерёнке, выбор графа.
- **Chat mode** для графов с типизированными сообщениями: лента, потоковый ответ,
  панель тредов, показ вызовов инструментов.
- **Memory**: просмотр и правка записей Store (ключ, пространство имён, значение).
- Светлая и тёмная темы, размеры и цвета сняты измерением с живого Studio.

## Состояние

Интерфейс собран и проверен на живом Agent Server (LangGraph API 0.14):
графовый режим, треды, прерывания, ассистенты, чат и Store.
Что осознанно не делаем — `Trace` и `Run experiment` (требуют LangSmith)
и `Deploy` (облачная платформа): кнопки остаются на месте с пояснением.

Требования, разбор API и визуальные референсы — в [`docs/`](docs/):

| Документ | О чём |
|---|---|
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Архитектура и ~70 требований с привязкой к эндпоинтам |
| [RESEARCH.md](docs/RESEARCH.md) | Разбор Agent Server API, форматы данных, механизм монтирования |
| [DESIGN-TOKENS.md](docs/DESIGN-TOKENS.md) | Дизайн-токены, снятые с живого Studio |
| [references/](docs/references/) | Скриншоты интерфейса и покадровая расшифровка видеогайда |
| [VIZLANG-NOTES.md](docs/VIZLANG-NOTES.md) | Уроки из открытых аналогов |

## Разработка

```bash
uv venv && uv pip install -e ".[dev]"
pytest                      # проверки серверной части

cd frontend && pnpm install
pnpm build                  # кладёт сборку в src/langgraph_studio_oss/static
```

## Лицензия

MIT.
