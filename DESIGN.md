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

## Type

- Geist for everything readable. Headings 600, tracking -0.02em to -0.04em, `text-wrap: balance`.
- Geist Mono only for flags, points, timers, codenames, hashes, file names, and ASCII states (`[x]`, `[ ]`, `[~]`, `[live]`, `[locked]`). Never for labels or buttons.
- Never draw bars with `#` in Geist Mono; it ligates. Use the Meter component.

## Components

- **ChallengeCard** (`cards.tsx`): category, points, title, difficulty pips + label, ASCII status. 3px difficulty stripe on the left edge. States: open, solved, weekly (accent border), progress.
- **Meter**: 20 pixel cells; any non-zero value shows at least one. Tone accent (top 3, you) or ink.
- **Pips / Difficulty**: three 4x10 bars in the difficulty color, always next to the written label.
- **Identicon**: 5x5 mirrored pixels hashed from the codename (`lib/pixel.ts`). The signed-in player's is yellow.
- **InfoTip**: 400ms delay on first open, instant for neighbors, scale 0.97 to 1 over 150ms, focusable, Escape closes.
- **Heatmap**: one 8x8 Bayer-dithered square per day, Monday-first columns, current week outlined in yellow.
- **RaceChart**: pixel-stepped rank lines (leader yellow and thick, ranks 2-3 bone, the rest at 30%), square markers at 20:00 snapshots, solves-per-hour bars with yellow first-blood caps, end table with movement. Hovering a name isolates its line.
- **Radar**: dithered polygon of solved/total per category.
- **Countdown**: four unit cells in Geist Mono, a 7-day week meter, red in the final hour. Digits swap without animation.
- **Hexdump** (landing hero): a challenge file with the flag's bytes lit in yellow.
- **Backgrounds**: `gradient-ascii.jsx` (React Bits, recolored, gradient and glow at 0; hides itself if WebGL is lost) and `faulty-terminal.tsx` (canvas 2D block glyphs, written for dfCTF). Both pause off-screen and hold still under reduced motion.

## Motion

Easing token `--ease-out: cubic-bezier(.23, 1, .32, 1)`. Only transform, opacity, and filter animate.

| Where | Motion | Why |
| --- | --- | --- |
| Buttons | active scale 0.96, 150ms ease-out; disabled never scales | feedback |
| Hero | GradientASCII drift; hexdump scramble, scan, highlight once per visit | explanation |
| Correct flag | verdict decodes (40ms/char), then +pts fades up 300ms with 8px rise and 4px blur | state change |
| Wrong flag | input shakes 4px, 280ms; danger border | feedback |
| FAQ | grid-template-rows 0fr to 1fr, 250ms | state change |
| Ticker | linear 48s loop, pauses on hover | ambient, landing only |

Rejected: per-section fade-ups, card hover lifts in the library, countdown digit flips, tab transitions, animated chart drawing. Under `prefers-reduced-motion`, movement stops and fades remain. Hover styles live under `(hover: hover) and (pointer: fine)`.

## Data behind the visuals

`GET /api/v1/community` (public: codenames, titles, counts) feeds the landing page. `GET /api/v1/leaderboard?range=week|all` (signed in) feeds the leaderboard, the library stats strip, and progress. Both are computed from `solves` and `xp_ledger` in `src/server/community.ts`. The weekly challenge is the newest published challenge tagged `weekly`; weeks run Monday 00:00 to Sunday 23:59 server time.
