# dfCTF design system

A typical capture-the-flag platform, built with care. ASCII and 1-bit dither are the graphic language; the product stays a familiar CTF board. Figma source: https://www.figma.com/design/3WwMlVB5ByR3tAtYLh6f7f (page "Redesign: landing + library"). Code: `src/app/globals.css`, `src/components/ui.tsx`, `src/components/viz.tsx`, `src/components/cards.tsx`, `src/lib/pixel.ts`.

## Rules that hold everywhere

- Wordmark is text only: **dfCTF** in Martian Mono ExtraBold. No logo mark.
- Flag format is always written `dfCTF{...}` (lowercase df, uppercase CTF). Matching accepts any capitalization of the prefix.
- No campus theme, no themed metaphors. No gradients as decoration, no glow, no `transition: all`.
- Yellow means flag, points, or the primary action. Difficulty has its own three colors. Red is for errors and Hard.
- Every visualization, grid, and stat gets an InfoTip (i). Challenges do not.

## Color tokens (dark default, light opt-in via `data-theme="light"`)

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | #101113 | #f4f4f1 | page ground |
| `--surface` | #17181b | #ffffff | panels, cards |
| `--surface-2` | #1e2024 | #ecece7 | selected, empty meter cells |
| `--line` / `--line-strong` | #2b2e33 / #3e424a | #d9d8d2 / #b9b8b0 | structure |
| `--text` / `--muted` / `--faint` | #ece8df / #a09d95 / #8a877f | #121214 / #55544f / #6b6a64 | text (faint passes AA) |
| `--accent` / `--accent-text` | #ffd23f / #ffd23f | #ffd23f / #7a5c00 | flag yellow |
| `--danger` | #ff6b5b | #c2321f | errors |
| `--easy` / `--medium` / `--hard` | #6fcf97 / #f2994a / #eb5757 | #1e8e4e / #b5651d / #c0392b | difficulty |

Radius is 2px everywhere. Elevation is borders; shadows only on floating menus, tooltips, and the arena composition.

Styling: Tailwind v4 utilities (theme and utilities only, no Preflight) build the landing page; dfCTF tokens are Tailwind colors (`bg-surface`, `text-muted`, `border-line`, `text-accent-ink`). The hand-written CSS sits in the `legacy` cascade layer below utilities, so a utility always wins. Landing frame: one 1440px column with a hairline per section; gray rails, small squares where a section line meets them, and a dot grid appear only on screens wide enough to leave a gutter. No bracketed or uppercase section labels, and no icon-in-a-box tiles. Side-by-side cells pin their last block to the bottom so neither side leaves dead space.

## Type

- Geist for everything readable. Headings 600, tracking -0.02em to -0.04em, `text-wrap: balance`.
- Geist Mono only for flags, points, timers, codenames, hashes, file names, and ASCII states (`[x]`, `[ ]`, `[~]`, `[live]`, `[locked]`). Never for labels or buttons.
- Never draw bars with `#` in Geist Mono; it ligates. Use the Meter component.

## Components

- **ChallengeCard** (`cards.tsx`): ASCII status and points on top, the title, then difficulty pips + label and solve count. No colored edge stripe; difficulty color lives only in the pips. Category shows only on standalone cards (the board already groups by category). States: open, solved (title recedes to muted), weekly (accent border), progress.
- **Challenge dialog**: opening a challenge shows a native `<dialog>` over the current page (description, files, flag, walkthrough, solvers). The URL keeps `?challenge=` for deep links; Escape, the close button, or the backdrop close it and return focus to the card. Full-screen sheet under 560px.
- **Loaders**: `Spinner` is a 3x3 pixel ring with one lit cell chasing its tail (buttons); `Loading` is a 12-cell meter with a light sweeping through it (content). Both are CSS-only. Boot and gate screens sit on the ASCII light field.
- **Meter**: 20 pixel cells; any non-zero value shows at least one. Tone accent (top 3, you) or ink.
- **Pips / Difficulty**: three 4x10 bars in the difficulty color, always next to the written label.
- **Identicon**: 5x5 mirrored pixels hashed from the codename (`lib/pixel.ts`). The signed-in player's is yellow.
- **InfoTip**: 400ms delay on first open, instant for neighbors, scale 0.97 to 1 over 150ms, focusable, Escape closes.
- **Heatmap**: one 8x8 Bayer-dithered square per day, Monday-first columns, current week outlined in yellow. Keep cell sizes a multiple of 8 (16, 24) so the dither pixels stay crisp. With a start date, month labels run along the top and each day shows its date on hover. The leaderboard's solve grid uses the same dithered squares.
- **RaceChart**: pixel-stepped rank lines (leader yellow and thick, ranks 2-3 bone, the rest at 30%), square markers at 20:00 snapshots, solves-per-hour bars with yellow first-blood caps, end table with movement. Hovering a name isolates its line.
- **Radar**: dithered polygon of solved/total per category.
- **Countdown**: four joined cells (days, hours, minutes, seconds) of Geist Mono digits that roll to their new value on a 0-9 strip (380ms ease-out, no roll under reduced motion), then a Monday-to-Sunday week meter. Red in the final hour.
- **Status** (Authoring): an 8px square that fills as the challenge moves on, plus the word: empty for Draft (muted), half for In review (yellow, the only state waiting on someone), full for Live (text color), a dash for Archived (faint). Never bracketed badges. One status tab row with counts filters the table.
- **Backgrounds**: the landing hero uses `gradient-ascii.jsx` (React Bits GradientASCII, WebGL 2, horizon shape in the flag-yellow ramp, glow 0), falling back to `ascii-field.tsx` (canvas 2D) when WebGL 2 is missing or the GPU drops the context. Boot and gate screens use `ascii-field.tsx`; the closing band uses `faulty-terminal.tsx`. All pause off-screen and hold still under reduced motion.
- **Resources** (Tutorials & Resources): page head like Rules (no eyebrow, no stats row, no section numbers). The index is a LineSidebar (React Bits, adapted in `line-sidebar.tsx`; Rules uses the same one with the same `PAGE_INDEX` sizing, as a plain list below 700px): real links, markers and ticks in `--line-strong`, the item nearest the pointer or keyboard focus shifts 10px and turns `--accent-text`, and the section on screen stays lit. It groups the 7 challenge categories, then "Going further"; no index numbers. Below 900px it becomes a static two-column list without markers. Every guide starts closed as a row (tool name, platform, `[+]`); a link to a guide's id opens it and its Go deeper list. Go deeper previews list guide names separated by semicolons. Back to top only shows below 900px, where the index stops being sticky.
- **Navigation**: the wordmark always leads home (the landing page, `/?view=home` when signed in). Settings lives in the profile menu, not the tab row. The landing footer has no oversized wordmark. Rules and Resources are tabs inside the app (instant, no reload, app header stays); the public /rules and /resources pages render the same content, add a **Home** back link beside the wordmark, and links to them use Next's `Link`. Signed in, landing links to either open the tab. Your score (#rank, points) sits under your codename in the profile button.

## Motion

Easing token `--ease-out: cubic-bezier(.23, 1, .32, 1)`. Only transform, opacity, and filter animate.

| Where | Motion | Why |
| --- | --- | --- |
| Buttons | active scale 0.96, 150ms ease-out; disabled never scales | feedback |
| Hero | ASCII field drift and decode-in | ambient |
| Challenge dialog | opacity + 8px rise, 180ms ease-out; backdrop fades | spatial |
| Loaders | opacity-only pixel trail / sweep; under reduced motion a slow pulse | state |
| Correct flag | verdict decodes (40ms/char), then +pts fades up 300ms with 8px rise and 4px blur | state change |
| Wrong flag | input shakes 4px, 280ms; danger border | feedback |
| FAQ | grid-template-rows 0fr to 1fr, 250ms | state change |
| Ticker | linear 48s loop, pauses on hover | ambient, landing only |

Rejected: per-section fade-ups, card hover lifts in the library, tab transitions, animated chart drawing. (The weekly countdown rolls its digits on request; see Countdown. The landing's live numbers, challenges published, categories covered, flags this week and the activity totals, roll in with the same Counter once loaded, at their text size.) Under `prefers-reduced-motion`, movement stops and fades remain. Hover styles live under `(hover: hover) and (pointer: fine)`.

## Data behind the visuals

`GET /api/v1/community` (public: codenames, titles, counts) feeds the landing page. `GET /api/v1/leaderboard?range=week|all` (signed in) feeds the leaderboard, the library stats strip, and progress. Both are computed from `solves` and `xp_ledger` in `src/server/community.ts`. The weekly challenge is the newest published challenge tagged `weekly`; weeks run Monday 00:00 to Sunday 23:59 server time.
