# dfCTF design system

A typical capture-the-flag platform, built with care. ASCII and 1-bit dither are the graphic language; the product stays a familiar CTF board. Figma source: https://www.figma.com/design/3WwMlVB5ByR3tAtYLh6f7f (page "Redesign: landing + library"; see [Landing revamp](#landing-revamp-approved-not-built-yet) for the approved next landing page). Code: `src/app/globals.css`, `src/components/ui.tsx`, `src/components/viz.tsx`, `src/components/cards.tsx`, `src/lib/pixel.ts`.

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
- **Challenge dialog**: opening a challenge shows a native `<dialog>` over the current page. Two underline tabs (APG tabs: arrow keys, Home/End, roving focus) split it: **Challenge** (description, files, flag, walkthrough) and **Solvers** with its count (first blood, the full list, Refresh, Show more), so a long solver list never buries the flag form. The URL keeps `?challenge=` for deep links; Escape, the close button, or the backdrop close it and return focus to the card. Full-screen sheet under 560px.
- **Loaders**: `Spinner` is a 3x3 pixel ring with one lit cell chasing its tail (buttons); `Loading` is a 12-cell meter with a light sweeping through it (content). Both are CSS-only. When a whole tab is loading (board, leaderboard, Resources, Authoring, Competitions), `Loading backdrop` centers the same loader in a bordered panel over the ASCII light field, glowing up from the bottom edge like the boot screen; smaller loads (dialogs, panels) stay plain. Boot and gate screens sit on the ASCII light field.
- **Meter**: 20 pixel cells; any non-zero value shows at least one. Tone accent (top 3, you) or ink.
- **Pips / Difficulty**: three 4x10 bars in the difficulty color, always next to the written label.
- **Identicon**: 5x5 mirrored pixels hashed from the codename (`lib/pixel.ts`). The signed-in player's is yellow.
- **InfoTip**: 400ms delay on first open, instant for neighbors, scale 0.97 to 1 over 150ms, focusable, Escape closes.
- **Heatmap**: one 8x8 Bayer-dithered square per day, Monday-first columns, current week outlined in yellow. Keep cell sizes a multiple of 8 (16, 24) so the dither pixels stay crisp. With a start date, month labels run along the top and each day shows its date on hover. The leaderboard's solve grid uses the same dithered squares.
- **RaceChart**: pixel-stepped rank lines (leader yellow and thick, ranks 2-3 bone, the rest at 30%), square markers at 20:00 snapshots, solves-per-hour bars with yellow first-blood caps, end table with movement. Hovering a name isolates its line.
- **Radar**: dithered polygon of solved/total per category.
- **Countdown**: four joined cells (days, hours, minutes, seconds) of Geist Mono digits that roll to their new value on a 0-9 strip (380ms ease-out, no roll under reduced motion), then a Monday-to-Sunday week meter. Red in the final hour.
- **DecryptedText** (`decrypted-text.jsx`, React Bits, MIT, adapted without the Motion dependency): the sign-in headline ("Read between the bytes.") decodes once when it comes into view, letters settling left to right out of flag-yellow glyphs at 45ms each; each letter keeps its real width, so nothing shifts. Screen readers get the real text at once; reduced motion shows it without scrambling. Keep it to rare, on-theme moments, never on text people see many times a day. The smaller `DecodeText` in `ui.tsx` stays on the "correct" flag verdict.
- **Status** (Authoring): an 8px square that fills as the challenge moves on, plus the word: empty for Draft (muted), half for In review (yellow, the only state waiting on someone), full for Live (text color), a dash for Archived (faint). Never bracketed badges. One status tab row with counts filters the table.
- **Backgrounds**: the landing hero uses `gradient-ascii.jsx` (React Bits GradientASCII, WebGL 2, horizon shape in the flag-yellow ramp, glow 0), falling back to `ascii-field.tsx` (canvas 2D) when WebGL 2 is missing or the GPU drops the context. Boot and gate screens use `ascii-field.tsx`; the closing band uses `faulty-terminal.tsx`. All pause off-screen and hold still under reduced motion.
- **Resources** (Tutorials & Resources): the public page and signed-in tab share one library (`resource-library.tsx`) that sets its own spacing, so both read alike. No eyebrow, no stats row. A first visit gets the welcome panel (what to do on the left, the Beginner foundations route on the right); a returning learner gets **Your learning** in its place: one box with an accent edge, the topic being read in large type, where they stopped (section N of 7 with a meter), Continue reading as the page's one primary button, and the current path's route; under it three cells for topics read, bookmarks (count, then each with its yellow bookmark and a remove button), and sync status. Topics group under Beginner and Intermediate headings that use the difficulty pips (one green, two orange). The whole card opens the topic; the bookmark sits above it.
- **Route** (learning paths): one stop per topic on a 2px track. A stop is the heatmap's 16px dithered square: outlined when not started, outlined in yellow when it is Up next, half-dense yellow while you are Reading it, solid once Read; the track turns ink between read stops. The state is always written beside the topic. Learning paths sit in one bordered panel, one row per path (title, summary, meter, Start/Continue/Review), left to right on wide screens and top to bottom below 900px; the row of the path you are on takes `--surface-2`. Only color transitions on hover; nothing animates on load.
- **Topic pages**: breadcrumbs carry the path and position, then the title, the plan (what you'll learn, and prerequisites only when there are some), Bookmark topic, and the sections. Mark topic read sits at the end, before Previous/Next. The topic index is a LineSidebar (React Bits, adapted in `line-sidebar.tsx`, with the `PAGE_INDEX` sizing Rules also uses): real links, theme-colored markers, a 10px pointer/focus shift, and the active section lit. Below 900px it becomes a static two-column list. Rules uses a sticky **Sections** disclosure below 700px, positioned below the public header or signed-in tab bar. Its links have at least 44px touch targets; choosing one closes the list and focuses its section. Escape or **Close sections** returns focus to the disclosure, and leaving the menu closes it. Guides and exercises start closed with `[+]`, restore the reader's saved state, and direct links reveal their guide. Anonymous progress stays local; signed-in progress syncs to an account with an explicit option to import anonymous browser progress.
- **Navigation**: the wordmark always leads home (the landing page, `/?view=home` when signed in). Settings lives in the profile menu. Rules and Resources are tabs inside the app, guarded by the draft discard check. Public /rules and /resources pages retain the full shared site header. Signed-in landing links to Rules and Resources open their app tabs. Your score (#rank, points) sits under your codename in the profile button.

## Motion

Easing token `--ease-out: cubic-bezier(.23, 1, .32, 1)`. Only transform, opacity, and filter animate.

| Where | Motion | Why |
| --- | --- | --- |
| Buttons | active scale 0.96, 150ms ease-out; disabled never scales | feedback |
| Hero | ASCII field drift and decode-in | ambient |
| Challenge dialog | opacity + 8px rise, 180ms ease-out; backdrop fades | spatial |
| App views | incoming main content fades with a 20px slide in navigation order, 220ms ease-out; the header stays still and the old view leaves at once, so nothing waits on the motion | spatial |
| Landing, sign-in, app | incoming screen fades, 220ms ease-out | continuity |
| Loaders | opacity-only pixel trail / sweep; under reduced motion a slow pulse | state |
| Correct flag | verdict decodes (40ms/char), then +pts fades up 300ms with 8px rise and 4px blur | state change |
| Wrong flag | input shakes 4px, 280ms; danger border | feedback |
| FAQ | grid-template-rows 0fr to 1fr, 250ms | state change |
| Ticker | linear 48s loop, pauses on hover | ambient, landing only |

Rejected: per-section fade-ups, card hover lifts in the library, animated chart drawing. (The weekly countdown rolls its digits on request; see Countdown. The landing's live numbers, challenges published, categories covered, flags this week and the activity totals, roll in with the same Counter once loaded, at their text size.) Under `prefers-reduced-motion`, movement stops and fades remain. Hover styles live under `(hover: hover) and (pointer: fine)`.

## Landing revamp (approved, not built yet)

The rules above describe the live site until this ships. Then fold this section into them and retire what it replaces. Figma source: https://www.figma.com/design/3WwMlVB5ByR3tAtYLh6f7f/dfCTF?node-id=82-3286 (page "Landing revamp: sideways prototype"; its codenames, counts, and titles are sample data).

- **Layout**: at 1024px wide and 640px tall or more, normal scrolling moves the page sideways: a tall wrapper, a sticky full-height stage, and a track moved with `translate3d` from `window.scrollY`, with no scroll hijacking and no arrow buttons. Smaller viewports and reduced motion stack vertically. The footer is a normal vertical section after the track.
- **Frame**: replaces the 1440px column. It stays fixed at every desktop size while content moves through it, with corner markers, the header, a pixel progress meter, the section label, and the Pause motion control.
- **Type**: the hero and closing `dfCTF` use custom pixel lettering, shipped as a web font so they stay real text. Other headings use Tektur. Geist stays for reading at 14px or larger, with 20px leads. Geist Mono stays for its existing uses. Martian Mono stays on the wordmark only. Alternative fonts are kept in the Figma file.
- **Braces**: the signature render is 3D `{ }` in ASCII and 1-bit dither, scrubbed by scroll and playing in reverse when scrolled back. It holds what matters at each stop: the headline, the warm-up card, the lead figure, the countdown, and finally the flag. Art is masked around text.
- **Category art**: an accordion with one category open. Each illustration shows what that category hunts for, and yellow marks the answer. Art is vector or canvas pixels, never text screenshots or blurred rasters.
- **Pixel field**: yellow squares in three tones from `--accent-text`, so they hold up in light theme. They stream into the braces, rise off the How it works cards, drain through the week meter, sparkle on the histogram, and burst once on a solve.
- **Motion**: sideways travel uses `cubic-bezier(0.77, 0, 0.175, 1)`. This revamp lifts the old rejection of ambient motion for the landing page only, subject to the accessibility rules below. Per-section fade-ups stay rejected.

## Accessibility

Target WCAG 2.2 AA. These hold everywhere, and the landing revamp must meet them before it ships.

Measured contrast against `--bg` and `--surface` (dark, then light):

| Pair | Dark | Light | Result |
| --- | --- | --- | --- |
| `--text` | 15.45, 14.52 | 16.98, 18.71 | passes 4.5:1 |
| `--muted` | 6.97, 6.55 | 6.89, 7.59 | passes 4.5:1 |
| `--faint` | 5.27, 4.95 | 4.92, 5.43 | passes 4.5:1 |
| `--accent-text` | 13.08, 12.29 | 5.67, 6.25 | passes 4.5:1 |
| `--line-strong` | 1.87, 1.76 | 1.81, 1.99 | fails 3:1 as a control boundary |
| `--line` | 1.39 | 1.30 | decorative dividers only |

- **Control boundaries**: an input or outlined button needs a 3:1 boundary. `--line-strong` alone does not meet this. This gap exists on the live site and needs a token decision.
- **Motion**: anything that moves on its own for more than 5 seconds needs a visible, keyboard-operable pause control. Reduced motion stops travel, loops, and scrubbing. Nothing flashes more than three times per second. Decorative motion pauses off screen and in hidden tabs.
- **Real text**: headlines are real text. Decorative lettering ships as a web font, not as an image. Canvas and art are hidden from assistive technology and hold no unique information; charts carry a text summary.
- **Keyboard**: every pointer path has a keyboard path, focus is always visible, and a focused control is never hidden behind fixed chrome. Focus moves never change layout: accordions and tabs open on click, Enter, or Space.
- **Scroll stages**: the sideways track must keep source order equal to visual order, bring focused controls into view, stay in sync when the browser scrolls for focus or find in page, and support hash links without `scrollIntoView`.
- **Color**: state never relies on color alone. Difficulty pips, verdicts, and meters keep a written label.
- **Live updates**: timers do not announce every tick. Only meaningful changes reach a live region.
- **Reflow and targets**: content works at 200% zoom and 320px wide with no horizontal page scrolling. Targets are at least 24 by 24 CSS pixels, and 44 on touch where density allows.

## Data behind the visuals

`GET /api/v1/community` (public: codenames, titles, counts) feeds the landing page. `GET /api/v1/leaderboard?range=week|all` (signed in) feeds the leaderboard, the library stats strip, and progress. Both are computed from `solves` and `xp_ledger` in `src/server/community.ts`. The weekly challenge is the newest published challenge tagged `weekly`; weeks run Monday 00:00 to Sunday 23:59 server time.
