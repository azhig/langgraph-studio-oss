# Studio Design Tokens (measured)

Values were captured from the live Studio via the browser's computed styles — not eyeballed
from screenshots. Dark theme, `html.dark`, Chrome 152.

The full dump of all 481 variables is in `references/studio-tokens.json`.
This document contains only what is needed for implementation, plus the patterns.

> We do not copy someone else's stylesheets. Below are measured values (facts about how the
> product looks); we write our own CSS based on them.

## Foundation

| Purpose | Value |
|---|---|
| UI font | `Inter, -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, …` |
| Code font | `monospace` (in the input editor) |
| App background | `#09090f` (`--bg-primary`) |
| Primary text | `#f5f8fb` (`--text-primary`) |

### Surfaces

```
--bg-surface-level-1: #09090f     app background
--bg-surface-level-2: #111521     panels
--bg-surface-level-3: #1b2030     raised elements, hover
--bg-surface-level-4: #282e42     control borders, selection
--bg-elevated:        #0d0f18     buttons, popovers
--bg-elevated-hover:  #1b2030
--border-default:     #393f55
```

### Text

```
--text-primary:    #f5f8fb        --text-tertiary:    #cbd5e1
--text-secondary:  #e2e8f0        --text-quaternary:  #8790ab
--text-disabled:   #555d78        --text-placeholder: #555d78
--text-link:       #5fbef8
```

### Accent (brand)

```
--bg-brand:         #0078f1       primary blue
--bg-brand-hover:   #006ddd
--bg-brand-subtle:  #0c336a
--border-brand:     #006ddd
--text-brand-secondary: #008dff   ("Connected" and links)
```

### Statuses

```
error:   bg #55160c  strong #f04438  text #fecdca
success: bg #053321  strong #75e0a7  text #acefc6
warning: bg #4c2400  strong #fec84b  text #fedf89   (light: bg #fffaeb, icon #cd6002)
```

### Geometry and timing

```
--radius-xs: 3px   --radius-sm: 4px   --radius-md: 6px
--radius-lg: 8px   --radius-xl: 12px  --radius-full: 9999px

--duration-fast: .1s   --duration-normal: .2s
--duration-slow: .3s   --duration-slower: .5s

--shadow-sm: 0 1px 3px #00000080, 0 1px 2px #0006
--shadow-md: 0 4px 6px -1px #00000080, 0 2px 4px -1px #0006
--shadow-lg: 0 10px 15px -3px #00000080, 0 4px 6px -2px #0000004d
```

## Graph nodes

Key observation: **node colors do not come from the theme palette; they are set inline** and
form a single scheme — the border, background and text are derived from one base tone, and the
outgoing edges get the same tone.

### Scheme

| Role | How it is derived |
|---|---|
| Border | base tone, opaque |
| Background | same tone with `alpha = 0.1` |
| Text | lightened variant of the tone |
| Outgoing edges | border tone with `alpha = 0.8` |
| Handle dot | filled with the border tone, icon in a darkened tone |

### Measured values

**Service nodes `__start__` and `__end__`**

```
classes:  border p-2 font-medium rounded-full
radius:   9999px            (pill)
padding:  8px
font:     14px / 500
text:     #ffffff
bg:       rgba(255,255,255,0.1)
border:   1px solid #999999
```

**Regular node (`agent`)**

```
classes:  rounded-md border p-2 font-medium
radius:   6px
padding:  8px
font:     14px / 500
text:     #daafe9
bg:       rgba(179,91,210,0.1)
border:   1px solid #b35bd2
dot:      12px, circle, bg #b35bd2, icon #511b64, positioned at the top-right corner with a -4px offset
```

**Tool node (`action`)**

```
text:     #b1d1e7
bg:       rgba(158,197,224,0.1)
border:   1px solid #64a3ce
radius:   6px
```

Note: the regular node radius is **6 px**, not 8 as it appeared from screenshots.

**Node width** depends not on the text width but on the name length: `64 px + 7 px × number of characters`
(`__start__` 9 characters → 127, `agent` → 99, `action` → 106, `__end__` → 113, `execute_action` → 162).
Height is always 32 px. The width is set on the React Flow node itself; the inner block is `w-full`.

### Node color from the name

The color does not come from the palette and does not depend on the node "type" (`tools` is not light blue
"because it is a tool"): it is derived deterministically from the name, so identical names in different
graphs are colored identically. The rule was reconstructed from measurements of eleven nodes (`agent`, `action`,
`planner`, `tools`, `research`, `execute_action`, `summarize`, `tool_node`, `call_model`, `human_review`, `x`)
and is reproduced in `frontend/src/features/graph/colors.ts` to within one RGB unit:

1. name → 32-bit FNV-1a-style hash (multiplication in double arithmetic, without `Math.imul` — otherwise the colors differ);
2. one step of a linear congruential generator (`1664525·h + 1013904223 mod 2³²`);
3. hue = fractional part of `(r × 0.618033988749895) × 360°`, saturation `50 + r mod 21`,
   lightness `40 + r mod 51` — this is the base tone in HSLA;
4. derivatives: fill — tone with alpha 0.1 (0.2 when selected); border — lightness capped at 60%;
   text — lightness 80% (dark theme) / 40% (light); minimap — lightness capped at 40% / 60%;
   edges — border color with alpha 0.8, arrowhead — border color; gear dot — border (lightness ≤ 45%
   on hover) and glyph with lightness ≤ 25% (≤ 20% on hover); pause hatching — text with alpha 0.15.

Service nodes `__start__` / `__end__` get white (dark theme) or black (light theme) instead of a tone, and the
same rules apply to them: the `#999` border in the dark theme is white with lightness capped at 60%.
Edges and arrowheads of service nodes use the original white/black, not the border.

Conditional edge labels (`data`): a pill `rounded-md border px-2 text-sm font-medium` with text at
lightness 80/40%, fill with alpha 0.2 and a border ≤ 60% of the source tone.

### Hatching for interrupts

A layer `repeating-linear-gradient(45deg, transparent 0 10px, currentColor 10px 20px)` is placed over the node
with `mix-blend-mode: hard-light`; the color is the node text with alpha 0.15 (i.e. the same tone as the label:
lightness 40% in the light theme, 80% in the dark theme). It is shown opaque (`opacity: 1`):
the top half (`top-0 h-1/2 rounded-t-md`) for `Before`, the bottom half (`bottom-0 h-1/2 rounded-b-md`)
for `After`, the whole node (`inset-0 rounded-md`) for both. Measured on a 99×32 node: layer 97×15,
offset 1 px from the top (or 16 px for `After`).

The hatching indicates an **enabled interrupt**, not a paused thread: it appears immediately
when selected in the `Interrupts` menu and stays until the pause is removed. During the pause itself the canvas
is not dimmed — nodes and edges remain at full strength.

### React Flow handles

```
size:    6×6px, round
bg:      #1a192b
border:  1px solid #ffffff
```

## Layout

dagre, `rankdir: TB`, `nodesep: 50`, `ranksep: 50` (these are dagre's defaults), node sizes —
as above. Back edges (`action → agent`) are passed to dagre as is: its built-in cycle removal step
reverses them itself. Positions are normalized to the origin. Reference coordinates for the graph
`__start__ → agent ⇄ action → __end__`: `(82.75, 0)`, `(96.75, 82)`, `(163, 164)`, `(0, 164)` —
reproduced exactly only on dagre 0.8.5 / @dagrejs/dagre 1.1.x.

Fitting: `fitView` with `maxZoom: 1` — a small graph is shown at 1:1 scale, a large one is not enlarged.

## Edges

| Type | Values |
|---|---|
| Regular (from `__start__`) | `stroke: rgba(255,255,255,0.8)`, width `1px`, no dashes |
| Regular (from a tool node) | `stroke: rgba(100,163,206,0.8)` — the source node's tone |
| Conditional | `stroke: rgba(179,91,210,0.8)`, **`stroke-dasharray: 3px 1px`** |

So the line style encodes conditionality and the color encodes the source. Conditional edge labels are not shown by default.

The edge identifier in the markup is `<source>-<target>` without a sequence number (`data-testid="rf__edge-agent-action"`);
a number is added only to a repeated pair with the same endpoints.

**Arrowhead**: marker `markerWidth/Height 30`, `markerUnits: strokeWidth`, `orient: auto-start-reverse`,
polyline `-5,-4 0,0 -5,4 -5,-4` filled with the source border color (no stroke).

**Entry and exit points.** React Flow handles are hidden; the points are computed geometrically: an edge leaves through
the bottom edge of the source (the top edge if the target is above) and enters through the top edge of the target; the point on the edge is
the intersection of the segment between the node centers with that edge. Hence edges to neighbors on the left/right leave
not from the center but shifted toward the target (`agent → __end__` starts at x = 128.7 with a center at 146.25).

**Shape.** A single edge is a React Flow cubic curve (`getBezierPath`, control points at
half the vertical distance). A pair of opposing edges (`agent → action` and `action → agent`) is
two quadratic arcs with shared endpoints; the control point is shifted from the midpoint in x by half the
vertical distance in the direction of travel and in y by half the horizontal distance against the direction of travel,
so the arcs diverge symmetrically.

## Minimap

78 × 52 px to the left of the zoom buttons, in the same row as `Memory` / `Interrupts`. Background `rgba(255,255,255,0.1)`
(dark) / `rgba(0,0,0,0.1)` (light), mask `rgba(0,0,0,0.6)` / `rgba(255,255,255,0.6)`,
node rectangles with `rx: 12`, color — see "Node color from the name". Zoom buttons: 26 × 26, 34 px pitch.

## Controls

| Element | Values |
|---|---|
| **Submit** | bg `#006ddd`, border `1px solid #0078f1`, text `#ffffff`, height `35px`, radius `6px 0 0 6px` — rounded only on the left, because the dropdown menu button is attached on the right |
| **Manage Assistants** | bg `#0d0f18`, border `1px solid #1b2030`, radius `6px`, height `34px` |
| **Memory / Interrupts** | transparent bg, border `1px solid #282e42`, radius `6px`, height `38px` |
| **Connected** | text `#008dff`, border `1px solid #006ddd`, radius `4px`, height `30px` |

## Light theme

Full dump — `references/studio-tokens-light.json` (the same 481 variables).

```
--bg-primary:   #fff        --text-primary:    #0f172a
--bg-secondary: #f5f8fb     --text-secondary:  #334155
--bg-tertiary:  #edf2f7     --text-tertiary:   #475569
--bg-elevated:  #fff        --text-quaternary: #64748b
--border-default: #cbd5e1   --bg-brand:        #006ddd
```

### Important: the node tone does not depend on the theme

The base tone is the same in both themes — `#b35bd2` for a regular node, `#64a3ce` for
a tool node. Only the derivatives change:

| Node | Dark | Light |
|---|---|---|
| `agent` — text | `#daafe9` (lightened) | `rgb(130,44,160)` (darkened) |
| `action` — text | `#b1d1e7` | `rgb(49,112,155)` |
| `__start__` / `__end__` | white on `rgba(255,255,255,0.1)`, border `#999` | black on `rgba(0,0,0,0.1)`, border `#000` |
| Edges | inherit the source tone, alpha 0.8 | same; from a service node — `rgba(0,0,0,0.8)` |

The node background is `alpha 0.1` of the tone everywhere; the conditional edge dash pattern is `3px 1px` everywhere.
So it is enough to store one tone per node and derive the rest as a function of the theme.

## Text scale

Studio sizes differ from Tailwind defaults, so they are defined as tokens:

```
text-xs           13px          (12px in Tailwind by default)
text-sm           14px
tracking-snug     -0.02em       buttons, 13px → -0.26px
tracking-tighter  -0.04em       node name in the log, 14px → -0.56px
tracking-wide     +0.03em       TURN heading, 14px → +0.42px
```

## Run: highlighting

During execution the reference dims everything except the running node. The node wrapper is
`w-full text-center backdrop-blur-sm transition-all duration-300 ease-in-out`, and the following is
added to it:

| State | Values |
|---|---|
| Running node | `opacity: 1`, `transform: scale(1.05)` |
| Other nodes | `opacity: 0.1` |
| All edges | `opacity: 0.2` (300 ms transition) |
| Error or cancellation | a badge to the right of the node: `absolute left-full top-1/2 ml-2 -translate-y-1/2`, inside `rounded-md border border-error bg-error-secondary px-2 py-1` with a `size-2` icon and `8px/500` text |

There is no CSS animation here: the values change via a transition on class change.
While a run is in progress, the body of the `Input` card is hidden entirely — only the footer remains,
where a single `Cancel` button (`rounded-md`) with a `size-4 animate-spin` spinner replaces `Submit`.

## Value editor

The reference uses CodeMirror 6; measured values:

| Element | Values |
|---|---|
| Container | bg `--bg-surface-level-2`, radius `8px`, `cursor: text` |
| Content | `padding: 12px`, `monospace 13px/18.2px` — one line yields a height of `42.2px` |
| Gutter | width `52px`, numbers `padding: 0 4px 0 8px`, `min-width: 32px`, right-aligned, color `--text-quaternary` |
| Main text | `#3760bf` (light) / `#7982a9` (dark) |
| Literals (strings, numbers, `true`) | `#587539` (light) / `#9ece6a` (dark) |
| Bottom bar | `border-t`, bg `--bg-surface-level-2`, `YAML ▾` on the left (`JSON` / `YAML` menu), `RAW` and copy on the right |

Card header: `Input`, `↑ ↓` arrows (history of submitted values),
`View Raw` ↔ `View Rendered` (the whole input as a single JSON editor) and a collapse chevron.

## Thread log and dialogs

| Element | Values |
|---|---|
| Log markup | scroller `thread-log` → `virtuoso-scroller` → pinned `virtuoso-top-item-list` (current turn heading) and `virtuoso-item-list` (flat list of rows: checkpoints and node entries, each a separate element) |
| `TURN N` heading | `14px/400`, line-height `1.2` (16.8px), tracking `+0.42px`, uppercase, color `--text-quaternary`; block `px-6 pt-3 border-t`, the heading itself is not `sticky` — the "stickiness" comes from the pinned block on top |
| Entry | `px-6 py-1.5`; checkpoint — `p-1.5 rounded-md hover:bg-primary-hover mr-4` |
| Relative time | `13px`, color `--text-tertiary`; `Intl.RelativeTimeFormat` in the browser language |
| `View state` / `Re-run from here` | `13px`, appear on hover (`invisible … group-hover:visible`) |
| Node entry | grid `grid-cols-[auto,1fr] gap-x-3`; avatar `size-5 rounded-full border text-[10px] font-semibold uppercase`, sticky at `top: 46px` |
| Avatar colors | text and border — from the node tone, background — tone with alpha `0.2` |
| Node name | `14px/500`, tracking `-0.56px`, line-height `16.1px` |
| Message card | `rounded-md bg-surface-level-2 px-4 py-1 w-fit`; role — `13px/600` uppercase `--text-tertiary`; text — `14px`, line-height `1.65`, tracking `-0.35px` |
| Line heights | in the reference `text-xs` — 13px/18px, `text-sm` — 14px/20px (Tailwind defaults differ, so they are set explicitly) |
| Expansion | depends on the detail slider (below) |

### Detail slider

A slider in the top-right corner (`absolute right-0 top-[80px] w-[120px]`) switches between three log views:

| Level | What is shown |
|---|---|
| 0 | Turn summary: `Input` and `Output` labels with values, no nodes or times. Values are rendered with the same tree as in a node entry: messages as "role + text" cards, but without a bubble; container `line-clamp-1` |
| 1 (default) | Node entries; exactly two are expanded — the input (`__start__`) and the last entry of the turn; the rest are collapsed regardless of what they recorded |
| 2 | The same entries, all expanded |

### Execution errors

When a node fails, the reference does not hide it in the console: the failed step is visible both on the canvas
and in the log, and the run can be continued from the same point.

| Element | Values |
|---|---|
| Node badge | to the right of the node (`absolute left-full top-1/2 ml-2 -translate-y-1/2`), `rounded-md border px-1 py-0.5`, border `--border-error`, bg `--bg-error-secondary`, text `--text-error-secondary` 12px/500 with an icon |
| Canvas highlighting | the failed node stays bright, the others dim to 10%, edges to 20% (the same state as during a run) |
| Log banner | `w-full rounded-sm bg-error py-0.5 pl-1.5 pr-1`; icon — 16 px circle on `--bg-error-subtle`, color `--text-error-tertiary` |
| Banner text | 12px/16px: the `Error` label (weight 500, `--text-error-secondary`, in the dark theme `--text-error-tertiary`) and the message (in the dark theme `--text-error-primary`); collapsed to one line with an ellipsis |
| Banner buttons | `Copy error` and `Show full error message` — `p-0.5 rounded-xs`, 14 px icons; the second expands the full text and rotates the chevron |
| Continue row | below the banner: `Continue` button (`primary`, 13px, `py-1 px-2`, radius 4), 16 px arrow `--text-tertiary` and the next-node chip — `rounded-md border px-2 text-sm font-medium`, colors from the node tone (bg — tone with alpha 0.2) |

An input form parse error is a different matter: it stays in the footer of the `Input` card
and does not go into the log.

The turn summary (bottom slider position) for an unfinished turn looks like this:
container `flex flex-col gap-3 px-7`; instead of `Output` values — either `Pending`
(14px `--text-secondary`) or `Error: ` (14px, weight 500) with the exception text
(`--text-error-secondary`) and a 24 px round icon (`bg --bg-error`, `p-0.5`).
Below is a row `flex items-center gap-1.5`: a 16 px icon in a frame (`rounded-md border p-1`),
`Execution paused.` (13px, weight 600) and `Review to continue.` (13px `--text-tertiary`),
with a `Review` button on the right — it expands this turn in detail without touching the slider.

### Hover

| Element | Values |
|---|---|
| Node card | appears after 330 ms to the right of the node (`w-auto max-w-[300px]`), radius 8, bg `--bg-elevated`, shadow; bottom margin 12 px |
| Name in the card | chip 14px/500 `px-2 py-1`, node tone colors (bg — tone with alpha 0.15), radius 6 (a ring for service nodes) |
| Neighbor rows | grid `grid-cols-[auto,1fr] gap-x-3 gap-y-2`; `Source` / `Target` labels — 14px `--text-tertiary` with a 12 px margin; neighbor chips — 12px |
| Checkboxes in the card | after a `border-t`, `px-3 pt-1 -mb-2 mt-3`, 16 px square (radius 4) and a 12px `--text-tertiary` label, 8 px gap; checked — border `--bg-brand`, fill `--bg-brand-tertiary`, lucide `Check` checkmark 16 px with stroke 2 (the `Interrupts` menu uses the same square, 6 px gap) |
| Highlighting from the log | hovered node — `opacity: 1` and `scale(1.05)`, the others — `opacity: 0.3` (0.1 during a run); for a subgraph both the frame and the nested nodes are highlighted |
| Nested node card | short name and neighbors, no interrupt checkboxes |

### Subgraphs

| Element | Values |
|---|---|
| Collapsed node | a regular node with a 16 px icon on the left; on hover the icon changes to "expand", cursor — pointer |
| Frame | covers the area of the nested nodes + 35 px on the sides and 25 px on top and bottom; visually raised by 24 px (`-top-6`) for the heading, radius 8, node tone colors (bg alpha 0.1), `z-index: -1` |
| Frame heading | 16 px icon and 13px/500 name in the tone color, 8 px top margin |
| Nested nodes | labeled without the subgraph prefix, the tone is computed from the short name |
| Layout | rows are spread apart by 25 px around the frame: the row pitch at its boundary is 107 px instead of 82 px |
| Log entry | 20 px square avatar (radius 4) with a 12 px icon instead of a letter; to the right of the name — a 24 px button (`p-1`, radius 6), hidden until the row is hovered |
| Nested log | inside the expanded entry: subgraph checkpoints and nodes as regular components, sticky headings at `top: 70px`, `z-index: 4` |

### Interrupts

| Element | Values |
|---|---|
| `Interrupts` button | `h-38px`, `rounded-md border border-secondary px-2.5 py-1.5 text-sm`, 24 px icon; to the right of the label — the number of enabled pauses |
| Menu | width by content (`min-width: 160px`), padding `4px`, radius `6px`; node row — 42 px: name 16px/24px on the left, `Before` / `After` checkboxes on the right (`gap-6`, 8 px bottom margin) |
| Checkbox | 16 px square, radius 4, border `--border-secondary`; checked — bg `--bg-brand-tertiary`, border `--bg-brand`, checkmark; label 13px `--text-tertiary`, `gap-1.5`, `py-2` |
| Bottom item | 36 px, `Interrupt on all`; with at least one pause enabled — `Clear all` (removes both `before` and `after`) |
| `Interrupt` block in the log | `rounded-md border border-brand-subtle bg-brand-tertiary p-3 text-sm`; `Interrupt` label — `font-medium uppercase --text-brand-primary`; below it a value tree: key in monospace with a chevron, value under the key (`14px`, `line-height: 1.65`, `--text-primary`), keys in alphabetical order |
| Response form | `rounded-md border border-secondary bg-secondary`; heading "Provide a value to resume execution for {node}" — 16px/24px, `px-3 py-2`, `font-medium tracking-tighter`; on the right `Interrupt ID:` (12px) and a round copy button (`rounded-full bg-tertiary px-2 py-1`, 12 px icon) |
| Form bottom | the same bar as the input field (`YAML ▾ … RAW ⧉`), with a `Resume` button at its right end (`primary`, 13px, radius 4, 16 px icon) in an `m-3` container |
| `As Node` | while the thread is paused, next to `Submit` instead of the "More options" arrow: an `As Node` label (14px `--text-tertiary`) and a node select — `h-34px`, `rounded-md border border-default px-2.5 py-1.5 text-sm`; list item — `px-2 py-1.5`, 16 px checkmark on the left |

### Forks and state editing

| Element | Values |
|---|---|
| Fork switcher | on the left of the checkpoint row: two `p-1 rounded-sm` buttons with 16 px icons (`Previous fork` / `Next fork`, disabled at the ends) and a `Fork N of M` label — 13px `--text-tertiary`, numbers in tabular digits (`tabular-nums`) |
| Where it is shown | only where the fork begins — otherwise the label would repeat on every step of the fork |
| `Re-run from here` | appears on row hover; running from this point creates a new fork |
| State editing | an `Edit node state` pencil in the entry header (visible on hover); the entry turns into a form: `View Raw`, `Cancel`, `Fork` and value fields — the same element as in the `Input` card |
| `Fork` | writes the values on behalf of the node at its checkpoint (`POST /threads/{id}/state` with `as_node`) and switches the log to the created fork |

### Assistants

| Element | Values |
|---|---|
| Modal | 960×640 (`w-[60rem] h-[40rem]`), radius 8, bg `--bg-elevated`, `z-index: 3000`; backdrop — `rgba(0,0,0,0.5)`, `z-index: 2999` |
| Layout | content inset by 16 px (`p-4`), `grid grid-cols-[2fr,5fr]` — 265 / 663 of the 928 px left inside; left column `rounded-l-xl` with a right border `--border-secondary` |
| List heading | `ASSISTANTS` — 14px/500 `--text-secondary`, `pt-2 px-2`; a `+ New` button next to it |
| Assistant row | `p-2`, name 14px/500 `--text-tertiary`; active — a `4px` bar on the left in `--border-brand` and a `--bg-brand-tertiary` fill |
| `Active` badge | `rounded-full border border-brand px-2 py-1`, 13px/500 `--text-brand-primary`, 8 px dot |
| Form header | name 20px/600 (`max-w-[250px] truncate`), `Active` toggle 32×16 with a 12 px thumb, description 14px `--text-secondary`, below `⧉ Assistant ID` |
| Field | label 14px (`capitalize`), description 12px `--text-tertiary`, editor — `rounded-lg border p-2 px-2.5 text-sm`; `Assistant Name` — compact `rounded-sm px-2 py-1 text-xs` |
| Node avatar | 20 px circle, border and fill from the node tone (alpha 0.2), 10px/600 uppercase letter |
| No `config_schema` | notice + a raw `configurable` editor instead of fields: `flex items-center gap-2 rounded-md border border-transparent px-4 py-3` on `--bg-warning`; 16 px warning triangle in `--text-warning-secondary` with a 4 px right margin, text 13px/1.2 `-0.02em` `--text-secondary` in a block with 20 px line boxes, docs link on the right 14px/1.5 `--text-link` (dark — `--text-brand-secondary`) with a 14 px external-link icon at a 2 px gap; the editor below is the usual `YAML v … RAW` panel, 16 px away |
| Footer | `sticky bottom-0 px-4`, `Delete Assistant` on the left (only for the user's own assistant), `Cancel` and `Create New Assistant` / `Save` on the right |
| Node settings | 896 px window (`w-[56rem]`), height by content (`max-h-[90vh]`); header `p-4`: avatar + `{node} Configuration` 16px/600, description 12px `--text-quaternary`, close cross on the right; at the bottom a `View full assistant settings` link, `Cancel` and `Save` |
| Graph picker | 215 px panel, `p-2 gap-2`; heading `Select a graph` 14px/500 `--text-quaternary`; row — `w-full rounded-md p-2 text-sm font-medium`, checkmark on the current one |

### Chat mode

| Element | Values |
|---|---|
| Feed | `mx-auto max-w-[1000px] px-12 gap-12` inside the scrollable area |
| Message | model response — `w-full max-w-[800px] gap-1`; human message — `ml-auto w-fit` (width by content, right-aligned) |
| Actions under the card | a `gap-2` row, appears on hover: for the human `Copy` and `Edit` on the right, for the model `Copy` and `Regenerate` on the left; 26×26 buttons |
| Thread label in the list | the text of the first message regardless of role; a thread without messages is labeled `New Thread` |
| Card | radius 8; human — `border-2` in `--border-brand` and `--bg-brand` bg with alpha 0.1; others — `--border-muted` border, `--bg-primary` bg |
| Card header | `px-4 py-3`, role label 12px/600 uppercase `--text-tertiary`, `font-variant: small-caps` |
| Text | `px-4 py-3` on a `border-t`, 14px, `line-height: 1.65`, `letter-spacing: -0.01em` |
| Input field | `rounded-xl border border-default p-4 gap-4`, width up to 1000 px; textarea 14px, height from 40 px up to 20% of the screen |
| Bar under the input | `Show tool calls` toggle 40×20 (16 thumb), `Upload files or images` button, a 32 px round send button on the right |
| `Threads` panel | 250 px wide, left border; heading 14px/500, `New` and close buttons; row — 12px/500 `--text-secondary` with an ⓘ icon on the right |

### State values

| Element | Values |
|---|---|
| Tree | row "20 px chevron + key in monospace", value under the key (14px, `line-height: 1.65`); a collapsed branch shows `[...]` / `{...}` |
| Scalar | key and value on one line `grid-cols-[auto,1fr]`; the value is a block `<p>` in a `min-w-[30px]` column (which is why it is separated by a line break in the log text) |
| Messages | a `messages` list item is labeled with the role (`Human`, `AI`, `Tool`) in bold; the reference does not show a text preview next to the key, only an `ID` chip on the right (`rounded-full border px-1 text-xs`), visible on hover |
| Expanded message | no bubble: `flex flex-col gap-2 whitespace-pre-wrap`, role 13px/600 uppercase `--text-tertiary`, text 14px `line-height: 1.65` below. The `rounded-md bg-bg-secondary px-4 py-1` bubble remains only on the message card in the node entry itself |
| Expansion | in the `View state` panel the tree and messages are expanded immediately; in the log — according to the slider level |
| In the log | the value is wrapped in `w-fit rounded-md bg-bg-secondary px-4 py-1`; at levels 0–1 branches are collapsed, from level 2 expanded |
| `View state` | 600 px panel, height up to half the screen; header `p-4` on one line: "Viewing checkpoint:", copy icon, id in monospace. The panel is flush with the right edge of the window (right edge = `innerWidth`), top — 3 px below the button. Scrolls as a whole: the header and tabs scroll away with the content |
| Tabs | inactive — `--text-primary`, active — `--text-brand-secondary` and a `border-b-2` underline of the same color, regular weight |
| `JSON` tab | the whole snapshot (`values`, `next`, `tasks`, `metadata`) — **not in an editor**, but as highlighted text (see below): a 450 px tall block with its own scrolling, a `YAML ▾ … RAW ⧉` bar below it |
| `Show full editor` | replaces the text with a code editor: 52 px gutter with line numbers and section folding, monospace 13px/18.2px, height exactly `30vh` with internal scrolling. Button tooltip — "Show full editor to collapse sections and show line numbers" |
| Value highlighting | `Fira Code` 14px/21px, padding `12px 13px`. Light theme: key `#015692`, string `#54790d`, number/date/`null` `#b75501`, list dash `#535a60`, empty `{}` and `[]` `#2f3337`. Dark: `#88aece`, `#b5bd68`, `#f08d49`, `#cccccc`, `#ffffff` |
| Time tooltip | hovering "N minutes ago" in the checkpoint row shows "Checkpoint: `<id>`" — a card to the left of the time with an 8 px gap, `p-2`, border `--border-secondary`, radius 6, 13px text |

### Hover tooltips

The reference draws them with its own component, not the native `title`: delay ≈700 ms, card
`rounded-md p-2 text-sm` on `--bg-elevated` with a shadow, below the element.

| Where | Text |
|---|---|
| Graph picker | `Graph: <graph_id>` |
| Thread picker | `Thread: <thread_id>` |
| Detail slider | `Set the level of detail for the thread log.` |
| Connection state | `Server connection settings` |
| `Run experiment` | `Enable tracing via the LANGSMITH_API_KEY environment variable to run an experiment` |

`Re-run from here`, `Edit node state` and `New Thread` have no tooltips — only an `aria-label`.

### `Configure Studio connection` dialog (`Connected` button)

| Element | Values |
|---|---|
| Sheet | 600 px, radius 8, height by content; header `p-4`: title 14px/600, subtitle 13px `leading-tight` `--text-tertiary`, 26 px close cross on the right |
| Form | `p-4 pt-0`, 20 px gap between blocks; field label 13px/500 `leading-tight`, field `px-3 py-2` radius 6 (height 39) |
| Custom Headers | row: name (field), value (monospace, hidden like a password, 32×36 eye toggle), 34×34 delete button; below a `+ Custom Header` button (`btn-outline`, 26 px) |
| Footer | `Docs` on the left (35 px, `btn-outline`), `Cancel` and `Connect` (`btn-primary`) on the right, 8 px gap |
| Differences | `Base URL` is editable only in proxy mode (the target changes the server via `PUT api/connection`); in mounted mode the field is read-only with a tooltip; there is no `Advanced Settings` section (Allowed Domains for LangSmith tunnels) |

The reference's `leading-tight` equals 1.2 (13px → 15.6px), not Tailwind's default 1.25 — set in `styles/theme.css`.

### Popover panels

Width `288px` (`w-72`), bg `--bg-elevated`, radius `6px`, shadow. Rendered via a portal
over the page (`z-index: 1300`) — the interface panels clip their content by `overflow`.

| Panel | Content |
|---|---|
| Thread picker | list: `32px` state circle (idle / busy / interrupted / error), identifier with copy, below `graph_id · relative time`; at the bottom `Load more` and `Open thread via ID` |
| `View state` | header `Viewing checkpoint: <id>` (`sticky`, `border-b`, `p-4`), `Values` / `JSON` tabs (`gap-5 px-4 pt-4`, active — `border-b-2` and `font-medium`), body `p-4` |
| Value tree | row `[20px chevron] key`, key in monospace `14px/500`, value — `--text-tertiary`; nesting indented by `20px` |
| Modal overlay | `rgba(0,0,0,0.7)` |
| Assistants modal | bg `#0d0f18`, radius `8px` |
| `Active` badge | transparent bg, border `1px solid #006ddd`, radius `9999px` |
| `Save` button (Memory) | bg `#006ddd`, border `1px solid #0078f1`, radius `4px` |

## Shell

| Element | Values |
|---|---|
| Panel header | `h-[55px] p-2 gap-2`, bg `--bg-primary`; the `Memory / Interrupts` row below it — `border-t p-4` |
| Left panel | bg `--bg-surface-level-2` (`#111521` / `#f5f8fb`); right — `--bg-primary` with `border-l` |
| Panel divider | invisible, 50/50 by default, draggable |
| `Studio` | 16 px icon + 13px/500 text, tracking -0.26px |
| `Graph│Chat`, `Interact│Trace` | container `border p-0.5 gap-0.5 rounded-sm` on `--bg-surface-level-1`; button `px-2 py-1` 13px/500; active — `--bg-surface-level-4` fill; unavailable — `--text-disabled` |
| Header buttons (`Deploy`, `Connected`) | 13px, `py-1 px-2`, radius 4, height 30, brand border and text, shadow `0 1px 2px var(--shadow-color-subtle)` |
| `Run experiment` | 14px, height 35, radius 6, bg `--bg-brand-tertiary`, text `--text-brand-disabled` (always unavailable locally) |
| `Input` card | `mx-4 mb-5`, `rounded-xl border`, bg `--bg-primary`, `shadow-lg`, `max-h-[50vh]`; body `gap-2 p-3.5`; footer `sticky bottom-0 border-t p-3.5` |
| `Input` heading | 20px/600, line-height 30, tracking -0.8px |
| Field row | `-mx-2 grid grid-cols-[1fr,auto] gap-4 p-2`: 20 px icon + 16px/500 capitalize name; `Required` badge — `rounded-md border px-1 py-0.5` 14px |
| Editor | `rounded-md border` frame; 42 px area, 52 px gutter, font 13px/18.2px `"Fira Code", monospace`; 35 px bottom bar on `--bg-surface-level-2` with a `YAML ▾` button (26 px) and `RAW` + copy |
| Detail slider | `absolute right-0 top-[80px] w-[120px] px-4`; track `h-1.5 rounded-full` on `--bg-surface-level-4`, fill `--bg-control-active`, 16 px white thumb with a 2 px border |
| Empty state | 56 px square `rounded-xl border` with an icon, heading 20px/600, caption 16px `--text-tertiary` |

The `Chat` tab is active only if the `messages` field in the input schema is typed with LangChain messages
(references to `AIMessage`, `HumanMessage`, etc. in `$defs`); for `Annotated[list, add_messages]` without
types the reference disables it.

### Memory (`Memory`)

| Element | Values |
|---|---|
| Left column | `min-w-[300px]`, 35% share, `rounded-l-xl`; heading `Memory` 20px/600 (`p-4 pb-2`), an `Add new item` button at the bottom |
| Tree | namespaces as a tree of segments: row `p-2 gap-2` 14px with a chevron, nested — indented `ml-4 mt-1 gap-1` |
| Badge | number of items in this namespace: `rounded bg-surface-level-2 px-1 text-xs`, only if there are items |
| Row actions | copy path (appears on hover) and a 26×26 `Filter` button |
| Item | key on the left, relative time on the right 13px `--text-tertiary`; **the time here is in English**, regardless of the browser language (in the log — by locale) |
| `Namespace` field | placeholder `Root...` |

### Message builder

| Element | Values |
|---|---|
| Card | `py-1` wrapper, inside `editable-message-N`; the card itself `rounded-lg border px-4 py-3`, 72 px tall with an empty body |
| Header | role picker — 82×26 button (`px-2 py-1`, 13px), on the right an action row `flex items-center gap-1`, each button 26×26 |
| Actions | `Add multimodal content` (paperclip), `Delete message`, `Copy`, drag handle — appear on hover |
| Body | `contenteditable` 14px/20px: a text paragraph and attachment images in one flow |
| Attachments panel | 350 px (`p-4`, `gap-2`): an "Upload a file or drag and drop" button 318×74 with a 40 px square and a 13px label, an `OR` separator, an `Embed link` row with an `Enter URL...` field (36 px) and a 75×36 `Embed` button |
| Value format | without attachments `content` is a string; with attachments — a list of blocks `[{type: text}, {type: image_url, image_url: {url}}]` |

## What remains to be measured

Chat mode (the second mode): dialog cards are captured the same way when the screen is implemented.
The expanded value tree in the log (not messages, but arbitrary state fields) has been captured only
structurally — exact spacing is refined at stage E3 together with `Pretty` / `JSON`.
