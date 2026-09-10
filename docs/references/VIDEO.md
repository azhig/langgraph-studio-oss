# Видеогайд «LangSmith Studio v2» — покадровая расшифровка

Источник: <https://www.youtube.com/watch?v=Mi1gSlHwZLM> (8:08, официальный ролик LangChain).
Кадры снимались с шагом 4 с; текст — субтитры ролика в тот же момент (автоматические, местами
с повторами и опечатками распознавания — например «Langraph», «tavly»).

Сами PNG в репозиторий не клались, кроме шести отобранных (см. `README.md`) — по таймингу
ниже любой кадр переснимается за секунды. Отобранные помечены ссылкой.

| Время | Реплика | Кадр |
|---|---|---|
| 0:06 | days and return that back to the user. Next, |  |
| 0:10 | here. Our chat tab enables us to visualize |  |
| 0:14 | traditional chat UI to see how it would behave in multi-turn | [video-01-chat-mode.png](video-01-chat-mode.png) |
| 0:18 | is great to bring in business users and subject matter experts |  |
| 0:22 | information about Langraphph, we'll link to |  |
| 0:26 | As you can see, for this example, we went with a pretty simple React |  |
| 0:30 | We have a tably surge tool. Then we have our system prompt |  |
| 0:34 | as our model. And then we use the create react |  |
| 0:38 | our graph. In order to use studio to its full potential, we'll |  |
| 0:42 | sure that we have a langraph.json file created |  |
| 0:46 | langap.json file is a JSON configuration file |  |
| 0:50 | graphs, environment variables, and other settings required |  |
| 0:54 | Additionally, let's say maybe I want to update to a faster or better model. |  |
| 0:58 | do that here. Great. You'll see as |  |
| 1:02 | that, our server's been automatically reloading with these updates. Back in |  |
| 1:06 | Studio, we can test these changes live. Let's try and get the sports news again. |  |
| 1:10 | Great. You can |  |
| 1:14 | the NBA news first. This is expected since I asked it to in the prompt. |  |
| 1:18 | Additionally, if we drill into our LLM runs, we can see that we're using 37. |  |
| 1:22 | times within Studio before modifying your underlying |  |
| 1:26 | reflected in Studio, making iterations lightning fast. Now that our local |  |
| 1:30 | ahead and invoke our agent and visualize how it runs through our |  |
| 1:34 | — | [video-02-input-form-rerun-output.png](video-02-input-form-rerun-output.png) |
| 1:38 | — |  |
| 1:42 | view LLM run button, then click right here, | [video-05-view-llm-run.png](video-05-view-llm-run.png) |
| 1:46 | here, and that'll open up our thread and playground. Now that we're in our prompt playground, |  |
| 1:50 | things that we can do. We can go ahead and modify our system prompt. |  |
| 1:54 | and modify our system prompt. So, let's maybe ask it to tell a joke every time. |  |
| 1:58 | We can also go ahead and change our model. So, click here in the prompt |  |
| 2:02 | settings. We can change our provider. Let's try OpenAI. |  |
| 2:06 | Let's try OpenAI. Let's give GPT41 a chance. From here, we can rerun |  |
| 2:10 | And you'll see it's adding a joke after every headline. |  |
| 2:14 | one of the most powerful features of Studio, the seamless integration |  |
| 2:18 | the pencil icon here and we |  |
| 2:22 | happen maybe if we ask for music news instead. Click fork here |  |
| 2:26 | instead. Click fork here and it creates a new fork of this conversation. | [video-04-state-tree-fork.png](video-04-state-tree-fork.png) |
| 2:30 | evaluators to monitor its performance. Let's go ahead now and filter |  |
| 2:34 | a trace that we'd like to debug locally using Studio. So, for this application, I |  |
| 2:38 | relevance. So, we're able to filter down to find what were |  |
| 2:42 | application. Let's go ahead and dive into this trace |  |
| 2:46 | to why it got that score. Opening up this trace, you can see it got a |  |
| 2:50 | of 0.1 for relevance. As I dive into it, I can see that it got the |  |
| 2:54 | news related to college basketball. That's |  |
| 2:58 | assume that any user asking for the latest |  |
| 3:02 | referring to the NBA. So, let's go ahead and open up our |  |
| 3:06 | make some changes in order to debug this. Back in our underlying code, let's see |  |
| 3:10 | Looking at our tavly search tool, I can see |  |
| 3:14 | our underlying code. You can adjust and experiment |  |
| 3:18 | structural changes, and test your changes directly within Studio |  |
| 3:22 | Additionally, our search depth is at basic right now. Let's try advanced. |  |
| 3:26 | few things that we can do to modify our prompt. |  |
| 3:30 | today's date. So, maybe we want to ask the agent |  |
| 3:34 | year and what might be most relevant that time of year for sports. |  |
| 3:38 | Great. We made a bit of a toy example here, |  |
| 3:42 | agent that if it's the NBA playoffs, for example, in May, |  |
| 3:46 | related to the NBA first. If it's March, we should return NCAA |  |
| 3:50 | it's March Madness. Obviously, this is just a toy example, |  |
| 3:54 | your application to make it perform better. Now that we've made all the |  |
| 3:58 | ahead and see how we can test our production trace against this. As |  |
| 4:02 | runs, we can see that we're using 37. If you'd |  |
| 4:06 | times within Studio before modifying your underlying code, |  |
| 4:10 | live. Let's go ahead and jump back into Langmith. Back in Langmith, you'll see |  |
| 4:14 | here. We can go to this run in studio button, |  |
| 4:18 | we need to do is make sure that we have our local endpoint defined. |  |
| 4:22 | can clone the thread locally. Let's go ahead and clone the | [video-06-clone-thread.png](video-06-clone-thread.png) |
| 4:26 | that we have our thread clone locally, there's a few different things that we |  |
| 4:30 | can do. We can go back to the very beginning, modify our input, and rerun |  |
| 4:34 | from here and see how our agent's going to perform. |  |
| 4:38 | though it's just returned college basketball |  |
| 4:42 | figure out what it should return. So, let's go ahead and give it a try. |  |
| 4:46 | — |  |
| 4:50 | And you'll see it's adding a joke after every headline. |  |
| 4:54 | Studio, the seamless integration we have with our |  |
| 4:58 | responded about college basketball, we're able to continue the thread ask |  |
| 5:02 | actually, it changed the query to the latest NBA |  |
| 5:06 | it went off and made that tool call. You see, we |  |
| 5:10 | see, we also got 10 results and went a little bit deeper for each. |  |
| 5:14 | a very concise, well put together response, highlighting mostly |  |
| 5:18 | news. This is exactly the result we wanted to. And now we're able |  |
| 5:22 | those changes locally, debug them, iterate, and then eventually push |  |
| 5:26 | Lingraph Studio also comes standard with production deployments |  |
| 5:30 | about Langraph Platform, we'll be sure to |  |
| 5:34 | assume that any user asking for the latest basketball |  |
| 5:38 | referring to the NBA. So, let's go ahead and open up our code, and |  |
| 5:42 | workflow. Give it a try and let us know what you build with it. |  |
| 5:46 | docs below and join our community to share your experiences and get support. |  |
| 5:50 | five. Let's upgrade that to 10, maybe. Additionally, our |  |
| 5:54 | Additionally, our search depth is at basic right now. Let's try advanced. |  |
| 5:58 | few things that we can do to modify our prompt. |  |
| 6:02 | today's date. So, maybe we want to ask the agent to |  |
| 6:06 | year and what might be most relevant that time of year for sports. Let's |  |
| 6:10 | Great. We made a bit of a toy example here, but basically |  |
| 6:14 | agent that if it's the NBA playoffs, for example, in May, we should |  |
| 6:18 | related to the NBA first. If it's March, we should return NCAA |  |
| 6:22 | it's March Madness. Obviously, this is just a toy example, and |  |
| 6:26 | better. Now that we've made all the local changes |  |
| 6:30 | production trace against this. As you can see, |  |
| 6:34 | auto reloading as we've been making changes, so we're able to test |  |
| 6:38 | live. Let's go ahead and jump back into Langmith. Back in Langmith, you'll see |  |
| 6:42 | here. We can go to this run in studio button, click |  |
| 6:46 | we need to do is make sure that we have our local endpoint defined. We |  |
| 6:50 | can clone the thread locally. Let's go ahead and clone the thread locally. |  |
| 6:54 | there's a few different things that we can do. |  |
| 6:58 | beginning, modify our input, and rerun it. |  |
| 7:02 | from here and see how our agent's going to perform. Let's |  |
| 7:06 | though it's just returned college basketball news, |  |
| 7:10 | figure out what it should return. So, let's go ahead and give it a try. |  |
| 7:14 | — |  |
| 7:18 | You can see now |  |
| 7:22 | responded about college basketball, we're able to continue the thread ask |  |
| 7:26 | actually, it changed the query to the latest NBA basketball |  |
| 7:30 | it went off and made that tool call. You see, we also |  |
| 7:34 | see, we also got 10 results and went a little bit deeper for each. |  |
| 7:38 | a very concise, well put together response, highlighting mostly the NBA |  |
| 7:42 | news. This is exactly the result we wanted to. And now we're able to test those |  |
| 7:46 | iterate, and then eventually push those into |  |
| 7:50 | Lingraph Studio also comes standard with production deployments through Langraph |  |
| 7:54 | about Langraph Platform, we'll be sure to link to some more |  |
| 7:58 | Langraph Studio is available now and free to use. We can't wait to see how it |  |
| 8:02 | workflow. Give it a try and let us know what you build with it. |  |
| 8:06 | docs below and join our community to share your experiences and get support. |  |

## Карта ролика

| Время | Раздел |
|---|---|
| 0:06–0:22 | Обзор: Chat-вкладка, multi-turn, привлечение бизнес-пользователей |
| 0:26–0:38 | Пример агента: React-агент, Tavily-инструмент, системный промпт, модель |
| 0:42–0:54 | `langgraph.json` — графы, переменные окружения, настройки |
| 0:54–1:26 | Правка модели в коде → **автоперезагрузка сервера** → тест изменений вживую |
| 1:30–1:40 | Запуск агента, визуализация прохода по узлам |
| 1:42–2:10 | `View LLM run` → Playground: правка промпта, смена провайдера и модели, повтор |
| 2:14–2:26 | **Карандаш → Fork** — ветка разговора от выбранного шага |
| 2:30–3:06 | LangSmith: фильтрация трейсов по оценке, разбор низкой релевантности |
| 3:06–3:54 | Правка кода: параметры инструмента, глубина поиска, доработка промпта |
| 3:58–4:30 | `Run in Studio` → **Clone thread locally** — продовый тред в локальный сервер |
| 4:30–5:20 | Повторный прогон, продолжение треда, проверка результата |
| 5:20–8:08 | Итоги, деплой через LangGraph Platform |