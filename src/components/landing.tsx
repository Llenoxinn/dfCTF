"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Community } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { countdownParts, weekEnd } from "@/lib/week";
import AsciiField from "./ascii-field";
import FaultyTerminal from "./faulty-terminal";
import { ChallengeCard } from "./cards";
import { Countdown, DitherArt, Heatmap, HeatLegend, Hexdump, Ticker } from "./viz";
import { api, clock, DecodeText, Identicon, InfoTip, Meter, Wordmark } from "./ui";

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
  (x, y) => (Math.floor(x / 32) % 2 ? 0.8 : 0.1 + 0.3 * (y / 80)), () => 0.06,
];

const RULES: [string[], string, string][] = [
  [["..####.#.", ".#....##.", "#....###.", "#........", "#........", "#.......#", ".#.....#.", "..#####..", "........."], "Retry for free", "Wrong answers never cost points. Guess, learn, and try again."],
  [["...##....", "..###....", ".####....", "...##....", "...##....", "...##....", "...##....", ".######..", ".######.."], "Points, once", "Your first correct flag earns the points. Re-solving won’t farm more."],
  [["#########", "#.......#", "#.......#", "#.....#.#", "#....#..#", ".#.#.#.#.", ".#..#..#.", "..#...#..", "...###..."], "Checked on the server", "Flags never ship to your browser, so there’s nothing to peek at."],
  [[".........", "###...###", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#..#.#..#", "####.####", "....#....", "........."], "Walkthroughs after the solve", "Capture the flag and the author’s write-up unlocks."],
  [["...###...", ".#..#..#.", "#...#...#", "#.......#", "####.####", "#.......#", "#...#...#", ".#..#..#.", "...###..."], "Fictional targets only", "Every system is built for practice. Never attack one you don’t own."],
  [["#########", ".#.....#.", "..#...#..", "...#.#...", "....#....", "...#.#...", "..#.#.#..", ".#.###.#.", "#########"], "A short cooldown", "Several quick misses trigger a brief pause, so brute force doesn’t pay."],
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

const DEMO = "dfCTF{b4se64_is_n0t_encrypt10n}";
function TryOne({ createAccount }: { createAccount: () => void }) {
  const [flag, setFlag] = useState(""); const [result, setResult] = useState<"correct" | "wrong" | null>(null); const [hint, setHint] = useState(false); const [attempt, setAttempt] = useState(0);
  function check(e: FormEvent) { e.preventDefault(); setAttempt(a => a + 1); setResult(flag.trim().replace(/^dfctf\{/i, "dfCTF{") === DEMO ? "correct" : "wrong"); }
  return <div className="mini">
    <div className="mini-head"><strong>Warm-up</strong><span className="muted">General skills, Easy</span><span className="spacer" /><span className="mono accent strong">50 pts</span></div>
    <div className="mini-body">
      <p>Someone left this in a config file. It looks scrambled, but it isn’t encrypted.</p>
      <div className="mini-code"><code>ZGZDVEZ7YjRzZTY0X2lzX24wdF9lbmNyeXB0MTBufQ==</code></div>
      {result === "correct" ? <div className="verdict verdict-correct" role="status"><span className="mono">[x]</span><DecodeText text="correct" className="mono strong" /><span className="fade-up mono strong">+50 pts</span><span className="muted">That one was practice. The real board is waiting.</span><button type="button" className="button button-primary" onClick={createAccount}>Create an account</button></div>
        : <form className="flag-row" onSubmit={check}>
          <label className="sr-only" htmlFor="try-flag">Flag</label>
          <input id="try-flag" key={attempt} className={`flag-input${result === "wrong" ? " shake is-wrong" : ""}`} value={flag} onChange={e => { setFlag(e.target.value); setResult(null); }} placeholder="dfCTF{...}" autoComplete="off" spellCheck={false} />
          <button className="button button-primary" disabled={!flag.trim()}>Check flag</button>
        </form>}
      {result === "wrong" ? <p className="verdict verdict-wrong mono" role="alert">[ ] incorrect. Nothing was deducted; try again.</p> : null}
      {result !== "correct" ? <button type="button" className="text-button" aria-expanded={hint} onClick={() => setHint(v => !v)}><span className="mono">{hint ? "[-]" : "[+]"}</span>{hint ? "Hide the hint" : "Show a hint"}</button> : null}
      {hint && result !== "correct" ? <p className="muted">The two <code>=</code> at the end are padding, a giveaway for Base64. Try <code>echo ... | base64 -d</code> in a terminal.</p> : null}
    </div>
  </div>;
}

function LiveChip({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => { const tick = () => { const p = countdownParts(new Date(endsAt).getTime() - Date.now()); setLeft(`${p.days}d ${p.hours}h left`); }; tick(); const t = window.setInterval(tick, 60_000); return () => window.clearInterval(t); }, [endsAt]);
  return <span className="live-chip"><i aria-hidden="true" />This week’s challenge is live{left ? <span className="mono muted">{left}</span> : null}</span>;
}

export default function Landing({ signIn, createAccount }: { signIn: () => void; createAccount: () => void }) {
  const [data, setData] = useState<Community | null>(null);
  const [faq, setFaq] = useState(0);
  useEffect(() => { api<Community>("/api/v1/community").then(setData).catch(() => setData(null)); }, []);
  const endsAt = useMemo(() => data?.weekly?.endsAt ?? weekEnd().toISOString(), [data]);
  useEffect(() => {
    const timer = window.setTimeout(() => { api<Community>("/api/v1/community").then(setData).catch(() => undefined); }, Math.max(0, new Date(endsAt).getTime() + 1 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [endsAt]);
  const totalActivity = data?.activity.days.reduce((a, b) => a + b, 0) ?? 0;
  const [range, setRange] = useState<"week" | "all">("week");
  const board = (range === "week" ? data?.top : data?.topAll) ?? [];

  return <div className="landing">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="site-nav">
      <a className="brand-link" href="/" aria-label="dfCTF home"><Wordmark /></a>
      {data?.weekly ? <LiveChip endsAt={data.weekly.endsAt} /> : null}
      <nav className="site-links" aria-label="Sections"><a href="#leaderboard">Leaderboard</a><a href="#this-week">This week</a><a href="#categories">Challenges</a><a href="#faq">FAQ</a></nav>
      <div className="site-actions"><button className="button button-ghost" onClick={signIn}>Sign in</button><button className="button button-primary" onClick={createAccount}>Start solving</button></div>
    </header>

    <main id="landing-main">
      <section className="hero">
        <AsciiField className="hero-ascii" />
        <h1 className="hero-title">Solve security challenges.<br />Capture the flag.</h1>
        <div className="hero-copy">
          <p className="lede">dfCTF is a capture-the-flag platform. Every challenge hides a flag somewhere: inside a file, a web request, or a running program. Find it, submit it, and earn points on the leaderboard.</p>
          <div className="cta-row"><button className="button button-primary button-large" onClick={createAccount}>Start solving</button><a className="button button-secondary button-large" href="#try">Try one now</a></div>
          <p className="fine">Web, forensics, OSINT, steganography, binary, and more. Easy starters for first-timers.</p>
        </div>
        <div className="hero-art"><Hexdump /></div>
      </section>

      {data?.recent.length ? <Ticker events={data.recent} /> : null}

      <section className="proof" aria-label="At a glance">
        {[[String(CATEGORIES.length), "categories, from OSINT to binary exploitation"], ["3", "difficulty tiers, so there’s always a next step"], ["1", "new challenge every Monday"], ["0", "points lost for a wrong answer"]].map(([n, t], i) => <div key={t} className="proof-fact"><strong className={i === 3 ? "accent" : ""}>{n}</strong><span>{t}</span></div>)}
      </section>

      <section className="band band-center" id="try" aria-labelledby="try-title">
        <div className="band-head center"><h2 id="try-title">Try one right now.</h2><p>No account needed. This string hides a flag. Decode it, paste the flag, and see what solving feels like.</p></div>
        <TryOne createAccount={createAccount} />
        <p className="fine center">{data ? `Solved it? There are ${data.totals.challenges} more on the board, and they get harder.` : "Solved it? The real challenges get harder."}</p>
      </section>

      <section className="band split" id="leaderboard" aria-labelledby="lb-title">
        <div className="split-copy"><h2 id="lb-title">Every flag moves you up the board.</h2><p>Earn points for every solve and watch the board update the moment your flag lands. Chase this week’s board, or play the long game all semester.</p><button className="button button-secondary" onClick={signIn}>See the full leaderboard</button></div>
        <div className="panel">
          <div className="panel-head"><div className="segmented small" role="group" aria-label="Range">{([["week", "This week"], ["all", "All time"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div><InfoTip text="Points earned in this range. Ties go to whoever reached the score first." /><span className="spacer" /><span className="mono faint">[live]</span></div>
          {board.length ? <ol className="standings"><li className="standings-head" aria-hidden="true"><span>#</span><span /><span>Player</span><span /><span className="num">Solves</span><span className="num">Points</span></li>{board.map(s => <li key={s.codename} className={s.rank <= 3 ? "top" : ""}><span className="rank mono">{String(s.rank).padStart(2, "0")}</span><Identicon name={s.codename} /><span className="mono name">{s.codename}</span><Meter value={s.points} max={board[0].points} tone={s.rank <= 3 ? "accent" : "ink"} label={`${s.points} points`} /><span className="mono num muted">{s.solves}</span><span className="mono num strong">{s.points.toLocaleString()}</span></li>)}</ol>
            : <p className="muted panel-pad">{range === "week" ? "No points yet this week. The first solve puts a name at the top." : "The board fills up as flags land."}</p>}
        </div>
      </section>

      <section className="band split activity" aria-labelledby="act-title">
        <div className="split-copy"><div className="title-tip"><h3 id="act-title">Solves across dfCTF</h3><InfoTip text="Each square is one day across all players. More lit pixels means more flags captured that day. The outlined column is this week." /></div><p>Every square is a day. Mondays light up when the weekly challenge drops.</p><p className="stat"><strong>{totalActivity.toLocaleString()}</strong><span>solves in the last 20 weeks</span></p></div>
        <div className="heat-wrap">{data ? <Heatmap days={data.activity.days} cell={30} gap={6} weekdays label="Solves per day, last 20 weeks" /> : <div className="skeleton heat-skeleton" />}<div className="heat-foot"><span className="faint">20 weeks ago to this week</span><HeatLegend /></div></div>
      </section>

      <section className="band band-surface" id="this-week" aria-labelledby="week-title">
        <div className="band-head"><h2 id="week-title">A new challenge drops every Monday.</h2><p>One fresh challenge a week, written by DFC Developers. Solve it before Sunday 23:59 to make that week’s board.</p></div>
        <div className="week-grid">
          <div className="week-left">
            <p className="label-dot">{data?.weekly ? "This week closes in" : "The week closes in"}</p>
            <Countdown endsAt={endsAt} />
            {data?.weekly ? <><ChallengeCard title={data.weekly.title} category={data.weekly.category} xp={data.weekly.xp} difficulty={data.weekly.difficulty} solveCount={data.weekly.solveCount} state="weekly" /><button className="button button-primary" onClick={signIn}>Open this week’s challenge</button></> : <p className="muted">The next weekly challenge appears here when it drops.</p>}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Live solves</h3><InfoTip text="The most recent correct flags. First blood is the first solve of a challenge." /><span className="spacer" /><span className="mono accent">[live]</span></div>
            {data?.recent.length ? <ul className="feed">{data.recent.slice(0, 6).map((e, i) => <li key={i}><span className="mono faint">{clock(e.at)}</span><span className="mono strong">{e.codename}</span><span className={e.firstBlood ? "mono accent" : "mono muted"}>{e.firstBlood ? "first blood" : "solved"}</span><span className="feed-title">{e.title}</span><span className="mono accent strong">{e.points ? `+${e.points}` : ""}</span></li>)}</ul>
              : <p className="muted panel-pad">No solves yet. Be the first.</p>}
          </div>
        </div>
      </section>

      <section className="band" id="categories" aria-labelledby="cat-title">
        <div className="band-head"><h2 id="cat-title">Pick a lane. Or try them all.</h2><p>Seven categories, each with easy starters and hard finishers. Nothing is locked behind anything else.</p></div>
        <ul className="tiles">
          {CATEGORIES.map((category, i) => { const c = data?.totals.categories.find(x => x.category === category); const total = c ? c.easy + c.medium + c.hard : 0; return <li key={category} className="tile">
            <DitherArt width={320} height={80} density={TEXTURES[i]} className="tile-art" />
            <div className="tile-body"><div className="tile-top"><strong>{category}</strong><span className="muted">{total} {total === 1 ? "challenge" : "challenges"}</span></div><p>{PITCH[category]}</p>
              {c && total ? <div className="spread"><span className="segments" aria-hidden="true">{Array.from({ length: c.easy }, (_, k) => <i key={"e" + k} className="easy" />)}{Array.from({ length: c.medium }, (_, k) => <i key={"m" + k} className="medium" />)}{Array.from({ length: c.hard }, (_, k) => <i key={"h" + k} className="hard" />)}</span><span className="faint">{[c.easy && `${c.easy} easy`, c.medium && `${c.medium} medium`, c.hard && `${c.hard} hard`].filter(Boolean).join(", ")}</span></div> : null}
            </div>
          </li>; })}
          <li className="tile tile-next"><DitherArt width={320} height={80} density={TEXTURES[7]} className="tile-art" /><div className="tile-body"><div className="tile-top"><strong>Coming next</strong><span className="muted">soon</span></div><p>Cryptography and reverse engineering are on the roadmap.</p></div></li>
        </ul>
      </section>

      <section className="arena" aria-labelledby="arena-title">
        <div className="arena-copy"><h2 id="arena-title">Inside the arena.</h2><p>A board of challenges, files you download, a flag box, and a scoreboard that never sleeps. That’s the whole game.</p><button className="button button-primary" onClick={createAccount}>Start solving</button><p className="fine">Sample data shown.</p></div>
        <div className="arena-stage" aria-hidden="true">
          <div className="arena-board"><div className="arena-board-head"><strong>Forensics</strong><span className="muted">3 of 8 solved</span></div><div className="arena-cards">
            <ChallengeCard title="Night shift" category="Forensics" xp={300} difficulty="Medium" solveCount={41} state="weekly" />
            <ChallengeCard title="The midnight request" category="Forensics" xp={100} difficulty="Easy" solveCount={128} state="solved" />
            <ChallengeCard title="Lost in the log" category="Forensics" xp={200} difficulty="Medium" solveCount={33} state="open" />
            <ChallengeCard title="Carved" category="Forensics" xp={400} difficulty="Hard" solveCount={9} state="open" />
            <ChallengeCard title="Timeline" category="Forensics" xp={150} difficulty="Easy" solveCount={102} state="solved" />
            <ChallengeCard title="Shadow copy" category="Forensics" xp={500} difficulty="Hard" solveCount={4} state="open" />
          </div></div>
          <div className="arena-modal"><div className="tags"><span className="tag">forensics</span><span className="tag tag-medium">medium</span><span className="tag">this week</span><span className="spacer" /><span className="mono accent strong">300 pts</span></div><strong className="arena-modal-title">Night shift</strong><p className="muted">A packet capture shows one device talking at 02:14, when nobody should be.</p><div className="file-row"><span className="mono strong">night-shift.pcap</span><span className="mono faint">1.8 MB</span><span className="spacer" /><span className="button button-secondary button-small">Download</span></div><div className="flag-row"><span className="flag-input mono faint">dfCTF{"{...}"}</span><span className="button button-primary">Submit flag</span></div></div>
          <ol className="arena-lb standings">{[["kestrel_7", 6450, 41], ["n0ise", 5980, 38], ["packet_fox", 1250, 11]].map(([n, p, s], i) => <li key={String(n)} className={i < 2 ? "top" : "you"}><span className="rank mono">{i < 2 ? `0${i + 1}` : "14"}</span><Identicon name={String(n)} you={i === 2} /><span className="mono name">{n}</span><Meter value={Number(p)} max={6450} tone="accent" label="" /><span className="mono num muted">{s}</span><span className="mono num strong">{Number(p).toLocaleString()}</span></li>)}</ol>
        </div>
      </section>

      <section className="band" id="how" aria-labelledby="how-title">
        <div className="band-head"><h2 id="how-title">Your first flag in four steps.</h2></div>
        <ol className="steps">
          <li><span className="mono faint">01</span><h3>Pick a challenge</h3><p>Filter by category and difficulty. Easy ones take about fifteen minutes.</p></li>
          <li><span className="mono faint">02</span><h3>Download the files</h3><p>Each file shows its size and SHA-256, so you know you have the right copy.</p></li>
          <li><span className="mono faint">03</span><h3>Work it locally</h3><p>Your editor, your terminal, your tools. Nothing runs in the browser.</p></li>
          <li className="last"><span className="mono accent">04</span><h3>Submit the flag</h3><p>The server checks it instantly. A first solve earns the points and unlocks the walkthrough.</p><code className="step-code">&gt; dfCTF{"{n1ght_sh1ft}"}{"\n"}  correct, +300 pts</code></li>
        </ol>
      </section>

      <section className="band band-surface split" id="made-by" aria-labelledby="made-title">
        <div className="split-copy"><h2 id="made-title">Written by people<br />who play CTFs.</h2><p>Every challenge on dfCTF is written by DFC Developers and community authors, then solved by a second person before it goes live.</p><button className="button button-secondary" onClick={createAccount}>Write a challenge with us</button></div>
        <ul className="points">
          <li><span className="mono accent">&gt;</span><div><h3>Original challenges</h3><p>Built from scratch for dfCTF by our authors, not pulled from public archives, so the flag isn’t one search away.</p></div></li>
          <li><span className="mono accent">&gt;</span><div><h3>Tested before it ships</h3><p>A second person solves every challenge before it goes live. No broken flags, no guessing games.</p></div></li>
          <li><span className="mono accent">&gt;</span><div><h3>Walkthroughs that teach</h3><p>Solve it and the author’s walkthrough unlocks, so every flag ends with something learned.</p></div></li>
        </ul>
      </section>

      <section className="band" id="fair-play" aria-labelledby="fair-title">
        <div className="band-head row"><h2 id="fair-title">Play fair, learn faster.</h2><p>The rules are built into the platform, not left to good intentions.</p></div>
        <ul className="rules">{RULES.map(([icon, t, b]) => <li key={t}><PixelIcon rows={icon} /><h3>{t}</h3><p>{b}</p></li>)}</ul>
      </section>

      <section className="band band-surface split" id="faq" aria-labelledby="faq-title">
        <div className="split-copy"><h2 id="faq-title">Before your<br />first flag.</h2><p>Questions people ask before they start.</p></div>
        <div className="faq">{FAQ.map(([q, a], i) => <div key={q} className="faq-item" data-open={faq === i || undefined}>
          <h3><button type="button" aria-expanded={faq === i} aria-controls={`faq-${i}`} onClick={() => setFaq(faq === i ? -1 : i)}>{q}<span className="mono">{faq === i ? "[-]" : "[+]"}</span></button></h3>
          <div className="faq-answer" id={`faq-${i}`} role="region"><div><p>{a}</p></div></div>
        </div>)}</div>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <FaultyTerminal className="closing-terminal" />
        <div className="closing-copy"><h2 id="closing-title">Pick a challenge.<br />Start solving.</h2><p>Create an account in a minute. Easy challenges take about fifteen minutes, and a wrong answer never costs points.</p><div className="cta-row"><button className="button button-primary button-large" onClick={createAccount}>Start solving</button><button className="button button-secondary button-large" onClick={signIn}>See the leaderboard</button></div></div>
      </section>
    </main>

    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand"><Wordmark size="lg" /><p>The capture-the-flag platform built by DFC Developers.</p><span className="flag-chip"><span>Flag format</span><code>dfCTF{"{...}"}</code></span></div>
        <nav className="footer-cols" aria-label="Footer">
          <div><h3>Play</h3><a href="#how">How it works</a><a href="#this-week">This week</a><a href="#leaderboard">Leaderboard</a><a href="#try">Try one now</a></div>
          <div><h3>Community</h3><a href="#made-by">Write a challenge</a><a href="#fair-play">Fair play</a><a href="#faq">FAQ</a></div>
          <div><h3>Account</h3><button className="link-button" onClick={signIn}>Sign in</button><button className="link-button" onClick={createAccount}>Create account</button></div>
        </nav>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} DFC Developers</span><span>All challenge content is fictional. Only test systems you have permission to attack.</span></div>
      <div className="footer-mark" aria-hidden="true">dfCTF</div>
    </footer>
  </div>;
}
