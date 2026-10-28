"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Community } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { countdownParts, weekEnd } from "@/lib/week";
import AsciiField from "./ascii-field";
import FaultyTerminal from "./faulty-terminal";
import GradientASCII from "./gradient-ascii";
import { ChallengeCard } from "./cards";
import { busiestDay, Countdown, DitherArt, Heatmap, HeatLegend, Ticker } from "./viz";
import { api, clock, DecodeText, Identicon, InfoTip, Meter, Notice, useTheme, Wordmark } from "./ui";

const PITCH: Record<string, string> = {
  "General skills": "Linux, encodings, and the terminal habits every other category builds on.",
  OSINT: "Find what’s hiding in plain sight: metadata, public posts, fictional people.",
  Steganography: "Data tucked inside images and audio, past what any viewer shows you.",
  Forensics: "Logs, packet captures, and disk images. Reconstruct what happened.",
  "Web exploitation": "Cookies, requests, and access control, studied from saved transcripts.",
  "Binary exploitation": "Read memory and debugger output, then bend a program to your will.",
  Miscellaneous: "Puzzles that refuse to fit anywhere else.",
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const TEXTURES: ((x: number, y: number) => number)[] = [
  x => x / 320 * 0.9, (x, y) => clamp(1 - Math.hypot(x - 160, y - 40) / 150) * 0.9, (x, y) => 0.5 + 0.4 * Math.sin(x / 18 + Math.sin(y / 9) * 2),
  (x, y) => ((Math.floor(x / 40) + Math.floor(y / 20)) % 2 ? 0.7 : 0.12), (x, y) => clamp((x + y * 2) / 400) * 0.9, (x, y) => 0.45 + 0.45 * Math.sin(Math.hypot(x - 60, y - 40) / 7),
  (x, y) => (Math.floor(x / 32) % 2 ? 0.8 : 0.1 + 0.3 * (y / 80)),
];

const RULES: [string[], string, string][] = [
  [[".......##", "......#.#", ".....#.#.", "....#.#..", "...#.#...", "..#.#....", ".###.....", ".##......", "#........"], "Original challenges", "Written for dfCTF by DFC Developers and community authors, so the flag isn’t one search away."],
  [["#########", "#.......#", "#.......#", "#.....#.#", "#....#..#", ".#.#.#.#.", ".#..#..#.", "..#...#..", "...###..."], "Tested before it ships", "A second person solves every challenge before it goes live. No broken flags."],
  [[".........", "###...###", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#..#.#..#", "####.####", "....#....", "........."], "Walkthroughs after the solve", "Capture the flag and the author’s write-up unlocks, so every solve ends with something learned."],
  [["..####.#.", ".#....##.", "#....###.", "#........", "#........", "#.......#", ".#.....#.", "..#####..", "........."], "Retry for free", "Wrong answers never cost points. Guess, learn, and try again."],
  [["...##....", "..###....", ".####....", "...##....", "...##....", "...##....", "...##....", ".######..", ".######.."], "Points, once", "Your first correct flag earns the points. Re-solving won’t farm more."],
  [["...###...", ".#..#..#.", "#...#...#", "#.......#", "####.####", "#.......#", "#...#...#", ".#..#..#.", "...###..."], "Fictional targets only", "Every system is built for practice. Never attack one you don’t own."],
];
function PixelIcon({ rows }: { rows: string[] }) {
  let d = ""; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") d += `M${x} ${y}h1v1h-1z`; }));
  return <svg className="pixel-icon" width="36" height="36" viewBox="0 0 9 9" aria-hidden="true" shapeRendering="crispEdges"><path d={d} /></svg>;
}

const FAQ: [string, string][] = [
  ["What is a CTF?", "Capture the flag is a security game. Each challenge hides a short secret string, the flag, inside something: a file, a web page, a program. Your job is to find it. On dfCTF every flag looks like dfCTF{...}."],
  ["Do I need experience?", "No. Every category has easy starters, and each solve unlocks a walkthrough that explains the intended approach."],
  ["What tools do I need?", "A laptop, a terminal, and a text editor. Some challenges are easier with free tools like Wireshark or CyberChef, and the description says when."],
  ["Is this legal?", "Yes. Every target is fictional and built for practice. You download files and work on your own machine; you never attack a real system."],
  ["How do points work?", "Each challenge has a point value. Your first correct flag earns it once. Wrong answers never cost points."],
  ["Who makes the challenges?", "DFC Developers and community authors. A second person solves every challenge before it is published."],
];

const STEPS: [string, string][] = [
  ["Pick a challenge", "Filter the board by category and difficulty. Easy ones take about fifteen minutes."],
  ["Read and download", "Open the challenge, read the brief, and grab any files it comes with."],
  ["Work it locally", "Your editor, your terminal, your tools. Nothing runs in the browser."],
  ["Submit the flag", "The server checks it instantly. A first solve earns the points and unlocks the walkthrough."],
];

// One wide column of content between two gray rails, as on drafting paper. The rails and the dot grid
// only appear once the screen is wider than the column, so there is always a gutter to put them in.
const FRAME = "mx-auto w-full max-w-[1440px] min-[1520px]:border-x min-[1520px]:border-line";
const H2 = "text-[clamp(2rem,3.4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-balance";
const LEAD = "max-w-2xl text-lg leading-relaxed text-muted text-pretty";
const PAD = "px-5 sm:px-8";

/** Small squares where a section's top line meets the frame rails. Only where the rails exist. */
function Marks() {
  const mark = "pointer-events-none absolute -top-[3px] z-10 hidden size-[7px] bg-faint min-[1520px]:block";
  return <><i aria-hidden="true" className={`${mark} -left-[4px]`} /><i aria-hidden="true" className={`${mark} -right-[4px]`} /></>;
}

function SectionHead({ id, title, children, side }: { id: string; title: ReactNode; children?: ReactNode; side?: ReactNode }) {
  return <div className={`${PAD} flex flex-wrap items-end justify-between gap-x-12 gap-y-6 pb-10 pt-14 lg:pt-16`}>
    <div className="grid max-w-3xl gap-4"><h2 id={id} className={H2}>{title}</h2>{children ? <p className={LEAD}>{children}</p> : null}</div>
    {side}
  </div>;
}

/** "4m ago", "3h ago", "2d ago" for the recent-solves timeline. */
function ago(at: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}

/** The hero's moving ASCII light. React Bits' WebGL field, with the canvas field as a fallback where WebGL 2 is missing. */
function HeroField() {
  const theme = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    const probe = document.createElement("canvas").getContext("webgl2");
    setWebgl(!!probe);
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  // If the GPU drops the context mid-visit, the browser paints a sad face; switch to the canvas field instead.
  // The component removes its own canvas before losing the context on unmount, so those events are ignored here.
  useEffect(() => {
    const el = host.current;
    if (!el || !webgl) return;
    const lost = (e: Event) => { if ((e.target as Node).isConnected) setWebgl(false); };
    el.addEventListener("webglcontextlost", lost, true);
    return () => el.removeEventListener("webglcontextlost", lost, true);
  }, [webgl]);
  if (webgl === null) return null;
  return <div ref={host} aria-hidden="true" className="absolute inset-0 -z-20">
    {/* Ramp order: shadow edge, brightest rim, then fading out with distance, so the light hugs the horizon instead of washing the card white. */}
    {webgl ? <GradientASCII colors={["#6b4d00", "#ffd23f", "#9c7400", "#2a2000"]} shape="horizon" characters=" .:-=+x*#%" cellSize={16} density={0.8} gradientOpacity={0.22} glyphOpacity={0.9} glow={0} grain={0.04} flicker={0.15} dpr={1.5} lightMode={theme === "light"} />
      : <AsciiField ox={0.62} oy={0.1} rx={0.7} ry={0.9} fadeFrom={-1} fadeTo={0} />}
  </div>;
}

const DEMO = "dfCTF{b4se64_is_n0t_encrypt10n}";
function TryOne({ createAccount, signedIn }: { createAccount: () => void; signedIn: boolean }) {
  const [flag, setFlag] = useState(""); const [result, setResult] = useState<"correct" | "wrong" | null>(null); const [hint, setHint] = useState(false); const [attempt, setAttempt] = useState(0);
  function check(e: FormEvent) { e.preventDefault(); setAttempt(a => a + 1); setResult(flag.trim().replace(/^dfctf\{/i, "dfCTF{") === DEMO ? "correct" : "wrong"); }
  return <div className="mini" id="try">
    <div className="mini-head"><h3>Warm-up</h3><span className="muted">General skills, Easy</span><span className="spacer" /><span className="mono accent strong">50 pts</span></div>
    <div className="mini-body">
      <p>Someone left this in a config file. It looks scrambled, but it isn’t encrypted.</p>
      <div className="mini-code"><code>ZGZDVEZ7YjRzZTY0X2lzX24wdF9lbmNyeXB0MTBufQ==</code></div>
      {result === "correct" ? <div className="verdict verdict-correct" role="status"><span className="mono" aria-hidden="true">[x]</span><DecodeText text="correct" className="mono strong" /><span className="fade-up mono strong">+50 pts</span><span className="muted">That one was practice. The real board is waiting.</span><button type="button" className="button button-primary" onClick={createAccount}>{signedIn ? "Open the challenges" : "Create an account"}</button></div>
        : <form className="flag-row" onSubmit={check}>
          <label className="sr-only" htmlFor="try-flag">Flag</label>
          <input id="try-flag" key={attempt} className={`flag-input${result === "wrong" ? " shake is-wrong" : ""}`} value={flag} onChange={e => { setFlag(e.target.value); setResult(null); }} placeholder="dfCTF{...}" autoComplete="off" spellCheck={false} aria-invalid={result === "wrong" || undefined} aria-describedby={result === "wrong" ? "try-verdict" : undefined} />
          <button className="button button-primary" disabled={!flag.trim()}>Check flag</button>
        </form>}
      {result === "wrong" ? <p id="try-verdict" className="verdict verdict-wrong mono" role="alert"><span aria-hidden="true">[ ] </span>incorrect. Nothing was deducted; try again.</p> : null}
      {result !== "correct" ? <button type="button" className="text-button" aria-expanded={hint} onClick={() => setHint(v => !v)}><span className="mono" aria-hidden="true">{hint ? "[-]" : "[+]"}</span>{hint ? "Hide the hint" : "Show a hint"}</button> : null}
      {hint && result !== "correct" ? <p className="muted">The two <code>=</code> at the end are padding, a giveaway for Base64. Try <code>echo ... | base64 -d</code> in a terminal.</p> : null}
    </div>
  </div>;
}

/** This week's challenge, in the hero's lower right corner across from the headline. */
function WeeklyNote({ title, endsAt }: { title: string; endsAt: string }) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => { const tick = () => { const p = countdownParts(new Date(endsAt).getTime() - Date.now()); setLeft(`${p.days} days ${p.hours} hours left`); }; tick(); const t = window.setInterval(tick, 60_000); return () => window.clearInterval(t); }, [endsAt]);
  return <a href="#this-week" className="grid min-w-56 gap-1 self-end rounded-xs border border-line-strong bg-bg/85 px-4 py-3 transition-colors hover:border-muted">
    <span className="text-[13px] text-muted">This week’s challenge</span><strong className="text-base font-semibold text-fg">{title}</strong>{left ? <span className="text-[13px] text-faint">{left}</span> : null}
  </a>;
}

/** The public home page in one framed column. Signed-in players reach it from the wordmark; `enter` then replaces the sign-in actions. */
export default function Landing({ signIn, createAccount, enter }: { signIn: () => void; createAccount: () => void; enter?: (view: "practice" | "leaderboard", challenge?: string) => void }) {
  const [data, setData] = useState<Community | null>(null);
  const [faq, setFaq] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setData(await api<Community>("/api/v1/community")); }
    catch { setError("Could not load the latest standings and activity. Please try again."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const endsAt = useMemo(() => data?.weekly?.endsAt ?? weekEnd().toISOString(), [data]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), Math.max(0, new Date(endsAt).getTime() + 1 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [endsAt, load]);
  const [range, setRange] = useState<"week" | "all">("week");
  const board = (range === "week" ? data?.top : data?.topAll) ?? [];
  const signedIn = !!enter;
  const start = signedIn ? "Open challenges" : "Start solving";

  // Live numbers. Activity days run Monday-first, so the last partial week is this week.
  const days = data?.activity.days ?? [];
  const totalActivity = data ? days.reduce((a, b) => a + b, 0) : undefined;
  const weekSolves = data ? days.slice(Math.floor(Math.max(0, days.length - 1) / 7) * 7).reduce((a, b) => a + b, 0) : undefined;
  const covered = data?.totals.categories.filter(c => c.easy + c.medium + c.hard > 0).length;
  const busiest = data ? busiestDay(days, data.activity.start) : null;
  const leader = data?.top[0]?.codename;
  const unknown = error ? "—" : "…";
  const stats: [string, ReactNode][] = [
    ["Challenges published", data ? data.totals.challenges : unknown],
    ["Categories with challenges", data ? `${covered} of ${CATEGORIES.length}` : unknown],
    ["Flags captured this week", weekSolves ?? unknown],
    ["Leading this week", data ? leader ? <span className="flex min-w-0 items-center gap-2.5"><Identicon name={leader} size={24} /><span className="truncate">{leader}</span></span> : "Nobody yet" : unknown],
  ];
  const faqItem = ([q, a]: [string, string], i: number) => <div key={q} className="faq-item" data-open={faq === i || undefined}>
    <h3><button type="button" aria-expanded={faq === i} aria-controls={`faq-${i}`} onClick={() => setFaq(faq === i ? -1 : i)}>{q}<span className="mono" aria-hidden="true">{faq === i ? "[-]" : "[+]"}</span></button></h3>
    <div className="faq-answer" id={`faq-${i}`} role="region" aria-label={q}><div><p>{a}</p></div></div>
  </div>;

  return <div className="landing min-h-screen bg-bg text-fg min-[1520px]:bg-[radial-gradient(circle_at_1px_1px,var(--line)_1px,transparent_0)] min-[1520px]:bg-size-[20px_20px]">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className={`${FRAME} ${PAD} flex h-16 items-center gap-6`}>
        <a className="brand-link" href={signedIn ? "/?view=home" : "/"} aria-label="dfCTF home"><Wordmark /></a>
        <nav aria-label="Sections" className="mx-auto hidden items-center gap-1 lg:flex">{[["#leaderboard", "Leaderboard"], ["#this-week", "This week"], ["#categories", "Categories"], ["/rules", "Rules"], ["#faq", "FAQ"]].map(([href, label]) => <Link key={href} href={href} className="rounded-xs px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg">{label}</Link>)}</nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">{signedIn ? null : <button className="button button-ghost max-sm:hidden" onClick={signIn}>Sign in</button>}<button className="button button-primary" onClick={createAccount}>{start}</button></div>
      </div>
    </header>

    <main id="landing-main" className={`${FRAME} bg-bg`}>
      {error ? <div className={`${PAD} border-b border-line py-4`}><Notice type="error">{error} <button className="text-button" onClick={load} disabled={busy}>Try again</button></Notice></div> : null}

      <section aria-labelledby="hero-title" className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="relative isolate flex min-h-[560px] flex-col justify-end overflow-hidden rounded-xs border border-line-strong bg-surface lg:min-h-[660px]">
          <HeroField />
          {/* A neutral scrim under the words, so they stay readable over the moving field. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--bg)_28%,transparent_78%)]" />
          <div className="grid gap-8 p-5 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 id="hero-title" className="text-[clamp(2.6rem,6.4vw,6rem)] font-semibold leading-[1] tracking-[-0.05em]">Solve security challenges.<br />Capture the flag.</h1>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-fg/80 text-pretty sm:text-xl">dfCTF is a capture-the-flag platform. Every challenge hides a flag inside a file, a web request, or a running program. Find it, submit it, and climb the leaderboard.</p>
              <div className="cta-row mt-8"><button className="button button-primary button-large" onClick={createAccount}>{start}</button><a className="button button-secondary button-large bg-bg/60" href="#try">Try one now</a></div>
            </div>
            {data?.weekly ? <WeeklyNote title={data.weekly.title} endsAt={data.weekly.endsAt} /> : null}
          </div>
        </div>
      </section>

      {data?.recent.length ? <div className="relative border-t border-line"><Marks /><Ticker events={data.recent} /></div> : null}

      <section aria-label="dfCTF right now" className="relative border-t border-line">
        <Marks />
        <dl className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="flex min-w-0 flex-col-reverse justify-end gap-3 bg-bg px-5 py-7 sm:px-8">
          <dt className="text-[13px] text-muted">{label}</dt>
          <dd className="ms-0 min-w-0 font-mono text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</dd>
        </div>)}</dl>
      </section>

      <section aria-labelledby="try-title" className="relative grid border-t border-line lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Marks />
        <div className={`${PAD} flex flex-col justify-between gap-8 py-14 lg:py-16`}>
          <div className="grid gap-4"><h2 id="try-title" className={H2}>Try one right now.</h2><p className={LEAD}>No account needed. This string hides a flag. Decode it, paste the flag, and see what solving feels like.</p></div>
          <p className="text-sm text-faint">{data ? `Solved it? ${data.totals.challenges} real challenges are waiting on the board, and they get harder.` : "Solved it? The real challenges get harder."}</p>
        </div>
        <div className="border-t border-line p-4 sm:p-8 lg:border-l lg:border-t-0 lg:py-16"><TryOne createAccount={createAccount} signedIn={signedIn} /></div>
      </section>

      <section id="how" aria-labelledby="how-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="how-title" title="Your first flag in four steps.">Every challenge works the same way, from the easiest warm-up to the hardest binary.</SectionHead>
        <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">{STEPS.map(([title, body], i) => <li key={title} className="grid content-start gap-3 bg-bg px-5 py-9 sm:px-8">
          <h3 className={`text-xl font-semibold tracking-[-0.015em] ${i === 3 ? "text-accent-ink" : ""}`}>{title}</h3>
          <p className="text-[15px] leading-relaxed text-muted">{body}</p>
        </li>)}</ol>
      </section>

      <section id="leaderboard" aria-labelledby="lb-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="lb-title" title="Every flag moves you up the board." side={<button className="button button-secondary" onClick={signIn}>See the full leaderboard</button>}>Earn points for new solves. Compare this week’s standings, follow the all-time board, and see when players are capturing flags.</SectionHead>
        <div className="grid gap-px border-t border-line bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 bg-bg">
            <div className="flex min-h-14 flex-wrap items-center gap-2.5 border-b border-line px-4 py-2.5 sm:px-6"><h3 className="text-base font-semibold">Standings</h3><InfoTip text="Points earned in this range. Ties go to whoever reached the score first." /><span className="spacer" /><div className="segmented small" role="group" aria-label="Range">{([["week", "This week"], ["all", "All time"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div></div>
            {board.length ? <ol className="standings"><li className="standings-head" aria-hidden="true"><span>#</span><span /><span>Player</span><span /><span className="num">Solves</span><span className="num">Points</span></li>{board.map(s => <li key={s.codename} className={s.rank <= 3 ? "top" : ""}><span className="rank mono">{String(s.rank).padStart(2, "0")}</span><Identicon name={s.codename} /><span className="mono name">{s.codename}</span><Meter value={s.points} max={board[0].points} tone={s.rank <= 3 ? "accent" : "ink"} label={`${s.points} points`} /><span className="mono num muted">{s.solves}</span><span className="mono num strong">{s.points.toLocaleString()}</span></li>)}</ol>
              : <p className="muted p-6">{!data ? error ? "Standings are temporarily unavailable." : "Loading standings…" : range === "week" ? "No points yet this week. The first solve puts a name at the top." : "The board fills up as flags land."}</p>}
          </div>
          <section aria-labelledby="act-title" className="flex min-w-0 flex-col bg-bg">
            <div className="flex min-h-14 items-center gap-2.5 border-b border-line px-4 sm:px-6"><h3 id="act-title" className="text-base font-semibold">Solves across dfCTF</h3><InfoTip text="Each square is one day across all players, Monday at the top. More lit pixels means more flags captured that day. The outlined column is this week." /></div>
            <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
              <div className="heat-wrap">{data ? <Heatmap days={days} start={data.activity.start} cell={24} gap={3} weekdays label="Solves per day, last 20 weeks" /> : <div className="skeleton heat-skeleton" />}
                <div className="heat-foot"><span className="faint">20 weeks ago to this week</span><HeatLegend /></div>
              </div>
              {/* Three equal stats: same value size, same label size, tops aligned. */}
              <div className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-5">
                <p className="stat content-start gap-1.5"><strong className="text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">{totalActivity?.toLocaleString() ?? "—"}</strong><span className="text-[13px]">solves in 20 weeks</span></p>
                <p className="grid content-start gap-1.5"><span className="text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">{weekSolves ?? "—"}</span><span className="text-[13px] text-muted">solves this week</span></p>
                <p className="grid content-start gap-1.5"><span className="text-2xl font-semibold leading-none tracking-[-0.02em]">{busiest ? busiest.label : "—"}</span><span className="text-[13px] text-muted">{busiest ? `busiest day, ${busiest.count} ${busiest.count === 1 ? "solve" : "solves"}` : "busiest day"}</span></p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section id="this-week" aria-labelledby="week-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="week-title" title="This week’s featured challenge.">When a weekly challenge is published, you’ll find it here. Solve it before Sunday 23:59 Philippine time to earn points on that week’s board.</SectionHead>
        <div className="grid gap-px border-t border-line bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6 bg-bg p-4 sm:p-6">
            <p className="label-dot">{data?.weekly ? "This week closes in" : "The week closes in"}</p>
            <Countdown endsAt={endsAt} />
            {data?.weekly ? <div className="mt-auto grid gap-4 [&_.card]:w-full"><ChallengeCard title={data.weekly.title} category={data.weekly.category} xp={data.weekly.xp} difficulty={data.weekly.difficulty} solveCount={data.weekly.solveCount} state="weekly" /><button className="button button-primary justify-self-start" onClick={enter ? () => enter("practice", data.weekly!.id) : signIn}>Open this week’s challenge</button></div>
              : <div className="mt-auto grid justify-items-start gap-3 rounded-xs border border-dashed border-line-strong p-5"><p className="font-semibold">No weekly challenge yet</p><p className="text-sm text-muted">The next one appears here when it drops. Until then, the whole board is open.</p><button className="button button-secondary" onClick={createAccount}>{start}</button></div>}
          </div>
          <section aria-labelledby="recent-title" className="flex min-w-0 flex-col bg-bg">
            <div className="flex min-h-14 items-center gap-2.5 border-b border-line px-4 sm:px-6"><h3 id="recent-title" className="text-base font-semibold">Recent solves</h3><InfoTip text="The most recent correct flags across dfCTF. First blood is the first solve of a challenge." /></div>
            {data?.recent.length ? <ol className="flex-1">{data.recent.slice(0, 7).map((e, i) => <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-6">
              <Identicon name={e.codename} size={30} />
              <div className="min-w-0">
                <p className="text-sm text-pretty"><span className="font-mono font-semibold">{e.codename}</span> <span className="text-muted">{e.firstBlood ? "took first blood on" : "solved"}</span> {e.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-faint"><time dateTime={e.at} title={clock(e.at)}>{ago(e.at)}</time>{e.firstBlood ? <span className="tag tag-accent">first blood</span> : null}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-accent-ink tabular-nums">{e.points ? `+${e.points}` : ""}</span>
            </li>)}</ol>
              : <p className="muted p-6">{!data ? error ? "Recent solves are temporarily unavailable." : "Loading recent solves…" : "No solves yet. Be the first."}</p>}
          </section>
        </div>
      </section>

      <section id="categories" aria-labelledby="cat-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="cat-title" title="Pick a lane. Or try them all.">Seven categories, each with easy starters and hard finishers. Nothing is locked behind anything else.</SectionHead>
        <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category, i) => { const c = data?.totals.categories.find(x => x.category === category); const total = c ? c.easy + c.medium + c.hard : 0; return <li key={category} className="flex min-w-0 flex-col bg-bg">
            <DitherArt width={320} height={72} density={TEXTURES[i]} className="tile-art h-[72px] w-full border-b border-line" />
            <div className="grid flex-1 content-start gap-2 p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-2"><h3 className="text-base font-semibold">{category}</h3><span className="whitespace-nowrap font-mono text-xs text-muted">{total} {total === 1 ? "challenge" : "challenges"}</span></div>
              <p className="text-sm leading-relaxed text-muted">{PITCH[category]}</p>
              {c && total ? <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs"><span className="segments" aria-hidden="true">{Array.from({ length: c.easy }, (_, k) => <i key={"e" + k} className="easy" />)}{Array.from({ length: c.medium }, (_, k) => <i key={"m" + k} className="medium" />)}{Array.from({ length: c.hard }, (_, k) => <i key={"h" + k} className="hard" />)}</span><span className="faint">{[c.easy && `${c.easy} easy`, c.medium && `${c.medium} medium`, c.hard && `${c.hard} hard`].filter(Boolean).join(", ")}</span></div> : null}
            </div>
          </li>; })}
          <li className="grid content-center justify-items-start gap-3 bg-surface p-5 sm:p-6"><h3 className="text-base font-semibold">Every challenge, one board</h3><p className="text-sm leading-relaxed text-muted">Filter by category and difficulty, then open whatever looks fun.</p><button className="button button-primary" onClick={createAccount}>{start}</button></li>
        </ul>
      </section>

      <section id="fair-play" aria-labelledby="fair-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="fair-title" title="Built to be fair.">Original challenges, a second pair of eyes on every one, and rules the server enforces for you.</SectionHead>
        <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">{RULES.map(([icon, t, b]) => <li key={t} className="grid content-start gap-4 bg-bg px-5 py-8 sm:px-8">
          <PixelIcon rows={icon} />
          <h3 className="text-lg font-semibold tracking-[-0.01em]">{t}</h3><p className="text-[15px] leading-relaxed text-muted">{b}</p>
        </li>)}</ul>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="relative border-t border-line">
        <Marks />
        <SectionHead id="faq-title" title="Before your first flag.">Questions people ask before they start. <Link href="/rules" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-current">Rules / Mechanics</Link> covers the rest.</SectionHead>
        <div className={`${PAD} grid gap-x-12 border-t border-line pb-10 pt-2 lg:grid-cols-2`}>
          <div>{FAQ.slice(0, 3).map((item, i) => faqItem(item, i))}</div>
          <div className="max-lg:border-t max-lg:border-line">{FAQ.slice(3).map((item, i) => faqItem(item, i + 3))}</div>
        </div>
      </section>

      <section aria-labelledby="closing-title" className={`${PAD} relative isolate flex min-h-[420px] items-center overflow-hidden border-t border-line py-20`}>
        <Marks />
        <FaultyTerminal className="absolute inset-0 -z-10" />
        <div className="grid max-w-lg gap-6"><h2 id="closing-title" className="text-[clamp(2.5rem,4.6vw,3.5rem)] font-medium leading-[1.04] tracking-[-0.04em]">Pick a challenge.<br />Start solving.</h2><p className="text-lg text-muted">Create an account in a minute. Easy challenges take about fifteen minutes, and a wrong answer never costs points.</p><div className="cta-row"><button className="button button-primary button-large" onClick={createAccount}>{start}</button><button className="button button-secondary button-large" onClick={signIn}>See the leaderboard</button></div></div>
      </section>
    </main>

    <footer className={`${FRAME} ${PAD} relative grid gap-12 border-t border-line bg-surface pb-8 pt-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]`}>
      <Marks />
      <div className="grid content-start justify-items-start gap-3.5"><Wordmark /><p className="max-w-[22rem] text-[15px] text-muted">The capture-the-flag platform built by DFC Developers.</p><p className="text-[13px] text-faint">Flags look like <code className="text-accent-ink">dfCTF{"{...}"}</code></p></div>
      <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        {([["Play", [["#try", "Try one now"], ["#how", "How it works"], ["#this-week", "This week"], ["#leaderboard", "Leaderboard"]]], ["Learn", [["#categories", "Categories"], ["/rules", "Rules / Mechanics"], ["#fair-play", "Fair play"], ["#faq", "FAQ"]]]] as const).map(([title, links]) => <div key={title} className="grid content-start justify-items-start gap-1"><h2 className="mb-2 text-[13px] font-semibold text-fg">{title}</h2>{links.map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-8 items-center text-sm text-muted transition-colors hover:text-fg">{label}</Link>)}</div>)}
        <div className="grid content-start justify-items-start gap-1"><h2 className="mb-2 text-[13px] font-semibold text-fg">Account</h2>{signedIn ? <><button className="link-button min-h-8" onClick={createAccount}>Open challenges</button><button className="link-button min-h-8" onClick={signIn}>Leaderboard</button></> : <><button className="link-button min-h-8" onClick={signIn}>Sign in</button><button className="link-button min-h-8" onClick={createAccount}>Create account</button></>}</div>
      </nav>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-[13px] text-faint lg:col-span-2"><span>© {new Date().getFullYear()} DFC Developers</span><span>All challenge content is fictional. Only test systems you have permission to attack.</span><a className="link-button sm:ml-auto" href="#landing-main">Back to top</a></div>
    </footer>
  </div>;
}
