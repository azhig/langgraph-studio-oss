import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Pencil, User } from "lucide-react";
import { useStudio } from "@/store/studio";
import { getClient } from "@/api/client";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { CollapseGlyph, ExpandGlyph, SubgraphGlyph } from "@/features/graph/SubgraphFrame";
import { useRun, type LogEntry, type NodeEntry } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { nodePalette } from "@/features/graph/colors";
import { entriesFromHistory } from "./history";
import { asMessages, messageText, roleOf, ValueTree } from "./ValueTree";
import type { BranchInfo } from "./branches";
import { useNodeStateEditor } from "./EditNodeState";
import { InterruptBlock } from "./InterruptBlock";
import { ViewState } from "./ViewState";
import { relativeTime } from "./time";
import { Popover } from "@/components/Popover";
import { ErrorBlock } from "./ErrorBlock";

/**
 * Лог треда: чередование точек сохранения (строка со временем и действиями) и
 * записей узлов (аватар с первой буквой имени, название, содержимое).
 * Структура и размеры сняты с эталона — docs/DESIGN-TOKENS.md, «Лог треда».
 */
export function ThreadLog() {
  // Куда уходит заголовок первого хода: закреплённый блок над списком
  const [top, setTop] = useState<HTMLDivElement | null>(null);
  const history = useStudioStream().history;
  // История — то, что уже сохранено на сервере; live — шаги идущего прогона,
  // которых в истории ещё нет (она перечитывается после завершения).
  const live = useRun((s) => s.entries);
  const turns = useMemo(
    () => splitTurns([...entriesFromHistory(history), ...live]),
    [history, live],
  );
  // Разметка контейнеров повторяет эталон: он рисует лог виртуальным списком,
  // и тесты цепляются за его метки — scroller снаружи, список ходов внутри
  // Заголовок первого хода эталон держит отдельным закреплённым блоком сверху,
  // заголовки следующих ходов наезжают на него при прокрутке
  return (
    <div data-testid="virtuoso-scroller" className="flex flex-1 flex-col bg-bg-primary">
      <div className="flex flex-1 flex-col">
        <div ref={setTop} data-testid="virtuoso-top-item-list" className="sticky top-0 z-[1]" />
        <div data-testid="virtuoso-item-list" className="flex flex-1 flex-col">
          {turns.map((turn, i) => (
            <Turn
              key={turn.key}
              index={i + 1}
              entries={turn.entries}
              last={i === turns.length - 1}
              headerHost={i === 0 ? top : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TurnGroup {
  key: string;
  entries: LogEntry[];
}

/** Ход начинается точкой сохранения запуска (`source: "input"`). */
function splitTurns(entries: LogEntry[]): TurnGroup[] {
  const turns: TurnGroup[] = [];
  for (const e of entries) {
    if ((e.kind === "checkpoint" && e.turnStart) || !turns.length) turns.push({ key: e.key, entries: [] });
    turns[turns.length - 1].entries.push(e);
  }
  return turns;
}

function Turn({
  index,
  entries,
  last,
  headerHost = null,
}: {
  index: number;
  entries: LogEntry[];
  last: boolean;
  /** Куда перенести заголовок хода: у первого он живёт в закреплённом блоке. */
  headerHost?: HTMLDivElement | null;
}) {
  const [open, setOpen] = useState(true);
  // `Review` в сводке раскрывает один ход подробно, оставляя слайдер на месте
  const [reviewing, setReviewing] = useState(false);
  const detail = useRun((s) => s.detail);
  const { nextNodes, isLoading } = useStudioStream();
  // Тред стоит на прерывании: сервер знает, какой узел выполнит следующим
  const paused = !isLoading && nextNodes.length > 0;
  const lastEntry = [...entries].reverse().find((e): e is NodeEntry => e.kind === "node");
  // Продолжить эталон предлагает под последней записью хода: под сорвавшимся узлом
  // после ошибки и под узлом, перед которым тред встал на статическом прерывании.
  // Динамический `interrupt()` продолжают ответом в самой записи, кнопки там нет.
  const failed = [...entries].reverse().find((e): e is NodeEntry => e.kind === "node" && Boolean(e.error));
  const lastError = failed?.key;
  const lastErrorText = failed?.error;
  const awaitingAnswer = Boolean(lastEntry?.interrupts?.length);
  const continueAt = lastError ?? (paused && !awaitingAnswer ? lastEntry?.key : undefined);

  // Незавершённый ход эталон подсвечивает фирменным фоном — и шапку, и сводку
  const halted = last && (paused || Boolean(lastError));
  // Фирменный фон эталон показывает только в свёрнутом виде хода
  const highlight = halted && detail === 0 && !reviewing;
  // Каждая строка лога — отдельный элемент списка, как в виртуальном списке эталона
  return (
    <>
      {(() => {
        const header = (
          <TurnHeader
            index={index}
            open={open}
            halted={highlight}
            summary={detail === 0 && !reviewing}
            sticky={!headerHost}
            onToggle={() => setOpen((v) => !v)}
          />
        );
        return headerHost ? createPortal(header, headerHost) : header;
      })()}
      {open && detail === 0 && !reviewing && (
        <div className={`w-full px-7 pb-3 ${highlight ? "bg-bg-brand-secondary" : "bg-bg-primary"}`}>
          <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
            <TurnSummary
              entries={entries}
              halted={halted}
              error={lastErrorText}
              onReview={() => setReviewing(true)}
            />
          </button>
        </div>
      )}
      {open &&
        (detail > 0 || reviewing) &&
        entries.map((e) =>
          e.kind === "checkpoint" ? (
            <Checkpoint
              key={e.key}
              ts={e.ts}
              checkpointId={e.checkpointId}
              values={e.values}
              root={e.root || e.turnStart}
              snapshot={{
                values: e.values ?? null,
                next: e.next ?? [],
                tasks: e.tasks ?? [],
                metadata: e.metadata ?? {},
              }}
            />
          ) : (
            // На среднем уровне раскрыты ввод и последний отработавший узел,
            // на верхнем — все записи разом
            <NodeRecord
              key={e.key}
              entry={e}
              defaultOpen={openByDefault(e, detail, e.key === lastEntry?.key)}
              canContinue={last && e.key === continueAt}
              lastOfTurn={e.key === lastEntry?.key}
            />
          ),
        )}
    </>
  );
}

/**
 * Что раскрыто на старте. Эталон разворачивает ввод и записи, изменившие не только
 * `messages`; со второго уровня — все записи, с третьего — вместе со значениями.
 */
function openByDefault(entry: NodeEntry, detail: number, lastOfTurn: boolean): boolean {
  if (detail >= 2) return true;
  // На среднем уровне эталон держит раскрытыми ввод и последнюю запись хода
  return entry.node === "__start__" || lastOfTurn;
}

function TurnHeader({
  index,
  open,
  halted = false,
  summary = false,
  sticky = false,
  onToggle,
}: {
  index: number;
  open: boolean;
  halted?: boolean;
  /** Ход показан сводкой: эталон рисует шеврон вправо. */
  summary?: boolean;
  /** Заголовок внутри списка липнет к верху и наезжает на закреплённый блок. */
  sticky?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex w-full cursor-pointer flex-col gap-2 ${sticky ? "sticky top-0 z-[2]" : ""} ${
        halted ? "bg-bg-brand-secondary" : "bg-bg-primary"
      }`}
      onClick={onToggle}
    >
      <div className="border-t border-border-secondary px-6 pt-3">
        <div className="flex w-full items-center gap-2 pb-4">
          <div data-testid="turn-toggle" className="flex w-full items-center justify-center gap-2 bg-transparent">
            {open && !summary ? (
              <ChevronDown size={16} className="text-text-quaternary" />
            ) : (
              <ChevronRight size={16} className="text-text-quaternary" />
            )}
            <h4 className="text-sm font-normal uppercase leading-[1.2] tracking-wide text-text-quaternary">
              Turn {index}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Нижнее положение слайдера: ход сворачивается до пары `Input` / `Output` —
 * что отправили и что получили, без узлов и времени. Если ход не доигран —
 * встал на прерывании или сорвался, — вместо результата эталон показывает
 * `Pending` (или текст ошибки) и строку «Execution paused» с кнопкой `Review`,
 * которая раскрывает этот ход целиком, не трогая слайдер.
 */
function TurnSummary({
  entries,
  halted,
  error,
  onReview,
}: {
  entries: LogEntry[];
  halted: boolean;
  error?: string;
  onReview: () => void;
}) {
  const nodes = entries.filter((e): e is NodeEntry => e.kind === "node");
  const input = nodes.find((e) => e.node === "__start__")?.updates;
  const output = [...nodes].reverse().find((e) => e.node !== "__start__" && e.updates)?.updates;
  return (
    <div className="flex flex-col gap-3 px-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold leading-[1.15] tracking-tighter text-text-secondary">Input</span>
        {/* В сводке эталон показывает ввод одной строкой без пузыря */}
        <div className="line-clamp-1 flex flex-col justify-start gap-2 text-sm text-text-tertiary">
          <Updates updates={input} bare />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold leading-[1.15] tracking-tighter text-text-secondary">Output</span>
        {error ? (
          <div className="flex flex-row items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">Error: </span>
            <span className="truncate text-sm text-text-error-secondary">{error}</span>
            <CircleAlert size={24} strokeWidth={1.5} className="shrink-0 rounded-full bg-bg-error p-0.5 text-text-error-secondary" />
          </div>
        ) : halted ? (
          <span className="text-sm text-text-secondary">Pending</span>
        ) : (
          <div className="line-clamp-1 flex flex-col justify-start gap-2 text-sm text-text-tertiary">
            <Updates updates={output} bare />
          </div>
        )}
      </div>
      {halted && (
        <div className="flex w-full items-center gap-1.5">
          <span className="rounded-md border border-border-secondary p-1">
            <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-text-secondary" />
          </span>
          <span className="text-xs font-semibold text-text-primary">Execution paused.</span>
          <span className="text-xs text-text-tertiary">Review to continue.</span>
          <button type="button" className="btn btn-primary ml-auto !rounded-sm" onClick={onReview}>
            Review
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Что записал узел. Если это только `messages`, эталон рисует их карточками
 * «роль + текст»; в сводке хода — те же карточки, но без пузыря (`bare`).
 */
function Updates({ updates, bare = false }: { updates?: Record<string, unknown>; bare?: boolean }) {
  const content = Object.entries(updates ?? {});
  if (!content.length) return <span className="text-sm text-text-tertiary">None</span>;
  const messages = content.length === 1 && content[0][0] === "messages" ? asMessages(content[0][1]) : null;
  return (
    <div className="flex flex-col gap-2">
      {messages
        ? messages.map((m, i) => (
            <div
              key={i}
              className={
                bare
                  ? "flex flex-col gap-2"
                  : "flex w-fit max-w-full flex-col gap-2 rounded-md bg-bg-secondary px-4 py-1"
              }
            >
              <span className="text-xs font-semibold uppercase text-text-tertiary">{roleOf(m)}</span>
              <span className="whitespace-pre-wrap text-sm leading-[1.65] tracking-tight text-text-primary">
                {messageText(m.content)}
              </span>
            </div>
          ))
        : content.map(([key, value]) => <Value key={key} name={key} value={value} />)}
    </div>
  );
}

function Checkpoint({
  ts,
  checkpointId,
  values,
  nested = false,
  root = false,
  snapshot,
}: {
  ts: number;
  checkpointId?: string;
  values?: unknown;
  /** Полный снимок точки для вкладки JSON. */
  snapshot?: Record<string, unknown>;
  /** Внутри подграфа строка времени уже вложена в колонку родителя. */
  nested?: boolean;
  /** Самая первая точка треда: перезапуск с неё эталон не предлагает. */
  root?: boolean;
}) {
  const { branches, setBranch, rerunFrom, isLoading } = useStudioStream();
  const fork = checkpointId ? branches[checkpointId] : undefined;
  return (
    <div className={`flex flex-col gap-2 bg-bg-primary py-1.5 ${nested ? "" : "px-6"}`}>
      <div
        data-testid="checkpoint-entry"
        className="group mr-4 flex items-center rounded-md p-1.5 transition-colors hover:bg-bg-tertiary"
      >
        <div className="flex w-full flex-col items-start gap-2">
          <div className="mr-4 flex w-full min-w-0 flex-row items-center gap-3">
            {fork && <ForkNav fork={fork} onSelect={setBranch} />}
            <span className="whitespace-nowrap text-xs text-text-tertiary">
              <RelativeTime ts={ts} />
            </span>
            <div className="invisible ml-auto flex items-center gap-3 group-hover:visible focus-within:visible">
              <Popover
                width={600}
                maxHeight="50vh"
                align="screen-end"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    aria-label="View state"
                    aria-haspopup="dialog"
                    className="btn btn-ghost h-[26px] !px-2"
                    onClick={toggle}
                  >
                    View state
                  </button>
                )}
              >
                {() => <ViewState checkpointId={checkpointId} values={values} snapshot={snapshot} />}
              </Popover>
              {!root && <span className="size-1 rounded-full bg-text-quaternary" />}
              {!root && (
              <button
                type="button"
                className="btn btn-ghost h-[26px] !px-2 disabled:text-text-disabled"
                disabled={!checkpointId || isLoading}
                aria-label="Re-run from here"
                onClick={() => checkpointId && void rerunFrom(checkpointId)}
              >
                Re-run from here
              </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Развилка: переключение между ветками, которые растут из одной контрольной точки. */
function ForkNav({ fork, onSelect }: { fork: BranchInfo; onSelect: (branch: string) => void }) {
  const total = fork.options.length;
  const btn = "btn btn-ghost btn-icon !p-1 text-text-secondary disabled:text-text-disabled";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Previous fork"
          className={btn}
          disabled={fork.index <= 1}
          onClick={() => onSelect(fork.options[fork.index - 2])}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          title="Next fork"
          className={btn}
          disabled={fork.index >= total}
          onClick={() => onSelect(fork.options[fork.index])}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
      <span className="whitespace-nowrap text-xs text-text-tertiary">
        Fork <span className="tabular-nums">{fork.index}</span> of{" "}
        <span className="tabular-nums">{total}</span>
      </span>
    </div>
  );
}

function NodeRecord({
  entry,
  defaultOpen,
  canContinue = false,
  depth = 0,
  lastOfTurn = false,
}: {
  entry: NodeEntry;
  defaultOpen: boolean;
  canContinue?: boolean;
  /** Последняя запись хода: у неё эталон правку состояния не предлагает. */
  lastOfTurn?: boolean;
  /** Глубина вложенности: записи подграфа липнут ниже родительской строки. */
  depth?: number;
}) {
  const theme = useStudio((s) => s.theme);
  // Пока запись не трогали руками, она следует правилу эталона: раскрыты ввод и
  // последний шаг, остальное сворачивается по мере появления новых записей.
  const headCheckpointId = useStudioStream().headCheckpointId;
  // Прерывание ждёт ответа только в последней точке треда: в более ранних записях
  // оно уже закрыто, и форму ответа показывать не нужно
  const active = Boolean(entry.checkpointId && entry.checkpointId === headCheckpointId);
  const [manual, setManual] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const editor = useNodeStateEditor(entry, () => setEditing(false));
  const open = manual ?? defaultOpen;
  const setOpen = (fn: (v: boolean) => boolean) => setManual(fn(open));
  const palette = nodePalette(entry.node, theme);
  const [h, s, l] = palette.tone;
  const content = Object.entries(entry.updates ?? {});
  const system = entry.node === "__start__";

  // Наведение на запись подсвечивает её узел на холсте и гасит остальные — как в эталоне
  const setHoverNode = useRun((s) => s.setHoverNode);
  const isSubgraph = useStudio((s) => s.subgraphs.includes(entry.node));
  // Шаги подграфа в логе раскрываются отдельно от рамки на холсте
  const [steps, setSteps] = useState(false);
  // Липкие заголовки вложены друг в друга: у подграфа своя ступенька
  const stickyTop = 46 + depth * 24;
  const stickyZ = 5 - depth;
  return (
    <div
      className={`flex flex-col gap-2 bg-bg-primary py-1.5 ${depth ? "" : "px-6"}`}
      onMouseEnter={() => !system && setHoverNode(entry.node)}
      onMouseLeave={() => setHoverNode(undefined)}
    >
      <div className="relative mr-4 grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex flex-col items-center pt-0.5">
          <span
            className={`sticky flex size-5 items-center justify-center border text-center text-[10px] font-semibold uppercase ${
              entry.subgraphNs ? "rounded" : "rounded-full"
            }`}
            style={{
              top: stickyTop,
              zIndex: stickyZ,
              color: palette.text,
              backgroundColor: `hsla(${h}, ${s}%, ${l}%, 0.2)`,
              borderColor: palette.border,
            }}
          >
            {entry.subgraphNs ? (
              <SubgraphGlyph className="size-3" />
            ) : system ? (
              <User size={12} strokeWidth={1.8} />
            ) : (
              entry.node.slice(0, 1)
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div
            className="group sticky flex h-6 items-center gap-1.5 bg-bg-primary"
            style={{ top: stickyTop, zIndex: stickyZ }}
          >
            <button
              type="button"
              aria-label={open ? "Collapse node" : "Expand node"}
              className="btn btn-ghost btn-icon !p-1 text-text-secondary"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </button>
            {isSubgraph ? (
              // Узел-подграф: вместо аватара — значок справа от имени, клик раскрывает
              // и сворачивает подграф на холсте, как в эталоне
              <button
                type="button"
                aria-label={steps ? "Hide subgraph steps" : "See subgraph steps"}
                title={steps ? "Hide subgraph steps" : "See subgraph steps"}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded"
                onClick={() => setSteps((v) => !v)}
              >
                <span className="text-sm font-medium leading-[1.15] tracking-tighter">{entry.node}</span>
                {steps ? (
                  <CollapseGlyph className="invisible size-6 rounded-md p-1 text-text-secondary group-hover:visible hover:bg-bg-tertiary" />
                ) : (
                  <ExpandGlyph className="invisible size-6 rounded-md p-1 text-text-secondary group-hover:visible hover:bg-bg-tertiary" />
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium leading-[1.15] tracking-tighter">{entry.node}</span>
              </div>
            )}
            {editing && editor.actions}
            {entry.checkpointId && !editing && open && !entry.error && !lastOfTurn && (
              <div className="invisible flex items-center gap-2 text-text-secondary group-hover:visible focus-within:visible">
                <button
                  type="button"
                  aria-label="Edit node state"
                  className="btn btn-ghost btn-icon !p-1"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
          {editing && editor.body}
          {steps && entry.subgraphNs && <SubgraphLog ns={entry.subgraphNs} depth={depth + 1} />}
          {!editing && open && content.length > 0 && <Updates updates={entry.updates} />}
          {entry.error && <ErrorBlock message={entry.error} />}
          {active &&
            entry.interrupts?.map((it, i) => (
              <InterruptBlock key={it.id ?? i} node={entry.node} interrupt={it} />
            ))}
        </div>
      </div>
      {canContinue && <ContinueRow />}
    </div>
  );
}

/**
 * Вложенный лог подграфа. Историю его шагов сервер отдаёт по пространству имён
 * задачи (`<узел>:<id задачи>`) — тот же `POST /threads/{id}/history`, только с
 * `checkpoint.checkpoint_ns`. Записи рисуются теми же компонентами, что и верхний
 * уровень, но липнут ступенькой ниже.
 */
function SubgraphLog({ ns, depth }: { ns: string; depth: number }) {
  const threadId = useStudioStream().threadId;
  const detail = useRun((s) => s.detail);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!threadId) return;
    let stale = false;
    void getClient()
      .threads.getHistory(threadId, { limit: 100, checkpoint: { checkpoint_ns: ns } })
      .then((history) => {
        // `getHistory` отдаёт от новых к старым, а лог читается сверху вниз
        if (!stale)
          setEntries(entriesFromHistory([...history].reverse() as ThreadState<Record<string, unknown>>[]));
      })
      .catch(() => setEntries([]));
    return () => {
      stale = true;
    };
  }, [threadId, ns]);

  if (!entries.length) return null;
  const lastNode = [...entries].reverse().find((e) => e.kind === "node")?.key;
  return (
    <div className="flex flex-col">
      {entries.map((e) =>
        e.kind === "checkpoint" ? (
          <Checkpoint key={e.key} ts={e.ts} checkpointId={e.checkpointId} values={e.values} nested />
        ) : (
          <NodeRecord
            key={e.key}
            entry={e}
            depth={depth}
            defaultOpen={detail === 2 || e.node === "__start__" || e.key === lastNode}
          />
        ),
      )}
    </div>
  );
}

/** Под сорвавшимся шагом эталон предлагает продолжить: кнопка и чип следующего узла. */
function ContinueRow() {
  const theme = useStudio((s) => s.theme);
  const { continueRun, nextNodes, isLoading } = useStudioStream();
  const node = nextNodes[0];
  if (!node) return null;
  const palette = nodePalette(node, theme);
  const [h, s2, l] = palette.tone;
  return (
    <div className="flex items-center gap-2 pl-6">
      <button
        type="button"
        className="btn btn-primary !rounded-sm"
        disabled={isLoading}
        onClick={() => void continueRun()}
      >
        Continue
      </button>
      <ArrowRight size={16} strokeWidth={1.5} className="text-text-tertiary" />
      <span className="inline-flex items-center gap-2">
        <span
          className="rounded-md border px-2 text-sm font-medium leading-relaxed"
          style={{
            color: palette.text,
            backgroundColor: `hsla(${h}, ${s2}%, ${l}%, 0.2)`,
            borderColor: palette.border,
          }}
        >
          {node}
        </span>
      </span>
    </div>
  );
}

/** Краткая запись значения для сводки хода: список сообщений — как `[...]`. */
function shortValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? "[...]" : "[]";
  if (value && typeof value === "object") return Object.keys(value).length ? "{...}" : "{}";
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Значение состояния в записи лога. Эталон рисует его тем же деревом, что и в
 * поповере `View state`: строка «шеврон + ключ», значение ниже, всё сворачивается;
 * список `messages` разбирается на сообщения с ролями.
 */
function Value({ name, value, flat = false }: { name: string; value: unknown; flat?: boolean }) {
  // На двух верхних уровнях слайдера эталон разворачивает и содержимое значений
  const detail = useRun((s) => s.detail);
  // В сводке хода эталон показывает плоские пары: ключ и краткое значение
  if (flat) {
    return (
      <div className="flex w-full items-center gap-3 text-sm">
        <span className="font-mono text-text-secondary">{name}</span>
        <span className="min-w-0 truncate text-text-tertiary">{shortValue(value)}</span>
      </div>
    );
  }
  return (
    <div className={flat ? "w-full" : "w-fit max-w-full rounded-md bg-bg-secondary px-4 py-1"}>
      <ValueTree name={name} value={value} leafBelow defaultOpen={detail >= 2} />
    </div>
  );
}

/** Время пересчитывается раз в пять секунд, чтобы «сейчас» не застывало. */
function RelativeTime({ ts }: { ts: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((v) => v + 1), 5000);
    return () => window.clearInterval(t);
  }, []);
  return <>{relativeTime(ts)}</>;
}
