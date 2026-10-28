"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import type { Bootstrap, ChallengeDetail, ChallengeSummary, Leaderboard, Progress, Viewer } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { countdownParts } from "@/lib/week";
import AsciiField from "./ascii-field";
import AuthPanel, { LocalInbox, type AuthMode } from "./auth-panel";
import Authoring from "./authoring";
import AccountSecurity from "./account-security";
import Competitions, { type CompetitionRoute } from "./competitions";
import Landing from "./landing";
import RulesContent from "./rules-content";
import { LearningProgressProvider } from "./resource-progress";
import { Content } from "./content";
import { ChallengeCard, type CardState } from "./cards";
import { Heatmap, Radar, RaceChart, SolveGrid } from "./viz";
import { api, CopyButton, DecodeText, Difficulty, Empty, formatDate, humanSize, Icon, Identicon, InfoTip, Loading, Meter, Modal, Notice, Pips, SettingsSection, Spinner, ThemeToggle, Wordmark } from "./ui";

// The guides are long, so their text loads only when the Resources tab opens.
const ResourcesContent = dynamic(() => import("./resources-content"), { loading: () => <Loading label="Opening the guides" /> });

type View = "home" | "practice" | "leaderboard" | "progress" | "competitions" | "authoring" | "rules" | "resources" | "settings";
// Settings lives in the profile menu; home is the landing page behind the wordmark.
const TABS: { id: View; label: string; staff?: boolean }[] = [
  { id: "practice", label: "Challenges" }, { id: "leaderboard", label: "Leaderboard" }, { id: "progress", label: "Progress" },
  { id: "competitions", label: "Competitions" }, { id: "authoring", label: "Authoring", staff: true }, { id: "rules", label: "Rules" },
  { id: "resources", label: "Resources" },
];
const VIEWS: View[] = ["home", ...TABS.map(t => t.id), "settings"];

function hrefFor(view: View, challenge = "") {
  const params = new URLSearchParams({ view });
  if (challenge) params.set("challenge", challenge);
  return `/?${params}`;
}

/** Plain left clicks navigate in place; modified clicks keep the browser's own behavior (new tab, etc.). */
function inPlace(event: MouseEvent, go: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); go();
}

const isWeekly = (c: { weeklyEndsAt?: string }) => !!c.weeklyEndsAt && new Date(c.weeklyEndsAt).getTime() > Date.now();
const cardState = (c: ChallengeSummary): CardState => c.solved ? "solved" : isWeekly(c) ? "weekly" : c.attempted ? "progress" : "open";
const roleName = (role: Viewer["role"]) => ({ participant: "Player", author: "Author", reviewer: "Reviewer", admin: "Administrator" })[role];

// Only ever set in the browser (refresh runs from an effect), so server renders never share it between requests.
let lastBootstrap: Bootstrap | null = null;

export default function Workspace() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(() => lastBootstrap);
  const [bootError, setBootError] = useState("");
  const [view, setView] = useState<View>("practice");
  const [selected, setSelected] = useState("");
  const [competitionRoute,setCompetitionRoute] = useState<CompetitionRoute>({eventId:"",challengeId:""});
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [query, setQuery] = useState("");
  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const historyIndex = useRef(0);
  const historyState = useRef<Record<string, unknown>>({});
  const registerLeaveGuard = useCallback((guard: (() => boolean) | null) => { leaveGuard.current = guard; }, []);

  const refresh = useCallback(async () => {
    try { lastBootstrap = await api<Bootstrap>("/api/v1/auth/bootstrap"); setBootstrap(lastBootstrap); setBootError(""); }
    catch (err) { setBootError(err instanceof Error ? err.message : "Could not connect to dfCTF."); }
  }, []);

  useEffect(() => {
    void refresh();
    const index = window.history.state?.dfctfIndex;
    historyIndex.current = typeof index === "number" ? index : 0;
    window.history.replaceState({ ...window.history.state, dfctfIndex: historyIndex.current }, "");
    historyState.current = window.history.state;
    function readLocation(event?: PopStateEvent) {
      let nextIndex = window.history.state?.dfctfIndex;
      // Native fragment links create entries without application state.
      if (typeof nextIndex !== "number") {
        nextIndex = historyIndex.current + 1;
        // Keep the router's opaque state so restoring this entry stays in place.
        window.history.replaceState({ ...historyState.current, ...window.history.state, dfctfIndex: nextIndex }, "");
      }
      // Restore the previous entry on cancellation without destroying forward history.
      if (event && nextIndex !== historyIndex.current && leaveGuard.current && !leaveGuard.current()) {
        window.history.go(historyIndex.current - nextIndex); return;
      }
      historyIndex.current = nextIndex;
      historyState.current = window.history.state;
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view");
      setView(VIEWS.includes(requested as View) ? requested as View : "practice");
      setSelected(requested === "competitions" ? "" : params.get("challenge") ?? "");
      setCompetitionRoute({eventId:params.get("competition")??"",challengeId:requested==="competitions"?params.get("challenge")??"":""});
      const auth = params.get("auth");
      const linkFlow = params.has("token") || params.has("verified") || params.has("error");
      setAuthMode(params.get("reset") === "1" && params.has("token") ? "reset" : auth === "signup" ? "signup" : auth === "signin" || linkFlow ? "signin" : null);
    }
    readLocation(); window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, [refresh]);

  const loadData = useCallback(async () => {
    setDataBusy(true); setDataError("");
    try {
      const [items, stats, standings] = await Promise.all([api<ChallengeSummary[]>("/api/v1/challenges"), api<Progress>("/api/v1/progress"), api<Leaderboard>("/api/v1/leaderboard?range=week")]);
      setChallenges(items); setProgress(stats); setBoard(standings);
    } catch (err) { setDataError(err instanceof Error ? err.message : "Could not load your data."); }
    finally { setDataBusy(false); }
  }, []);

  const ready = !!bootstrap?.user && bootstrap.hasAccess && !!bootstrap.user.codename;
  useEffect(() => { if (ready) void loadData(); }, [ready, loadData]);
  useEffect(() => {
    if (!ready) return;
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      if (event.defaultPrevented || event.key !== "/" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      const input = searchInput.current;
      if (!input || input.disabled || !input.getClientRects().length || getComputedStyle(input).visibility !== "visible") return;
      event.preventDefault(); input.focus();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [ready]);
  useEffect(() => {
    if (!ready || !board?.weekEndsAt) return;
    const timer = window.setTimeout(() => void loadData(), Math.max(0, new Date(board.weekEndsAt).getTime() + 1 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [ready, board?.weekEndsAt, loadData]);

  function pushLocation(url: string) {
    window.history.pushState({ dfctfIndex: ++historyIndex.current }, "", url);
    historyState.current = window.history.state;
  }
  function navigate(next: View, challenge = "") {
    if (leaveGuard.current && !leaveGuard.current()) return;
    setView(next); setSelected(challenge);
    setCompetitionRoute({eventId:"",challengeId:""});
    pushLocation(hrefFor(next, challenge));
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }
  function openCompetition(eventId="",challengeId="") {
    if (leaveGuard.current && !leaveGuard.current()) return;
    const moved = !challengeId && eventId !== competitionRoute.eventId;
    setView("competitions");setSelected("");setCompetitionRoute({eventId,challengeId});
    const params=new URLSearchParams({view:"competitions",...(eventId?{competition:eventId}:{}),...(challengeId?{challenge:challengeId}:{})});
    pushLocation(`/?${params}`);if(moved)window.scrollTo({top:0,behavior:"instant"});
  }
  function openAuth(mode: AuthMode | null) {
    if (leaveGuard.current && !leaveGuard.current()) return;
    setAuthMode(mode);
    pushLocation(mode ? `/?auth=${mode}` : "/");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function signOut() {
    if (leaveGuard.current && !leaveGuard.current()) return;
    try { await api("/api/auth/sign-out", { method: "POST", body: "{}" }); setChallenges([]); setProgress(null); setBoard(null); pushLocation("/"); setAuthMode(null); await refresh(); }
    catch (err) { setBootError(err instanceof Error ? err.message : "Could not sign out. Please try again."); }
  }

  if (bootError && !bootstrap) return <Screen><Wordmark size="lg" /><div className="gate-card"><Notice type="error">{bootError}</Notice><button className="button button-primary" onClick={refresh}>Try again</button></div></Screen>;
  if (!bootstrap) return <Screen><Wordmark size="lg" /><Loading label="Opening dfCTF" /></Screen>;
  if (authMode === "reset" || !bootstrap.user) return authMode ? <AuthPanel key={authMode === "reset" ? "reset" : "account"} bootstrap={bootstrap} refresh={refresh} initialMode={authMode} back={() => openAuth(null)} /> : <Landing signIn={() => openAuth("signin")} createAccount={() => openAuth("signup")} />;
  if (!bootstrap.hasAccess) return <AccessGate bootstrap={bootstrap} refresh={refresh} signOut={signOut} />;
  if (!bootstrap.user.codename) return <Onboarding user={bootstrap.user} refresh={refresh} />;
  if (view === "home") return <Landing signIn={() => navigate("leaderboard")} createAccount={() => navigate("practice")} enter={navigate} />;

  const user = bootstrap.user;
  const codename = user.codename!;
  const staff = user.role !== "participant";
  const activeView = view === "authoring" && !staff ? "practice" : view;
  const weekly = challenges.find(isWeekly);
  // A challenge opens as a dialog over the current page, so closing it keeps your place and scroll.
  const openChallenge = (id: string) => { setSelected(id); pushLocation(hrefFor(activeView, id)); };
  const closeChallenge = () => { setSelected(""); pushLocation(hrefFor(activeView)); };

  return <div className="app">
    <a className="skip-link" href="#main-content" onClick={event => inPlace(event, () => document.getElementById("main-content")?.focus())}>Skip to content</a>
    <header className="app-bar">
      <a href={hrefFor("home")} className="brand-link" aria-label="dfCTF home" onClick={e => inPlace(e, () => navigate("home"))}><Wordmark /></a>
      <nav className="tabs" aria-label="Main">{TABS.filter(v => !v.staff || staff).flatMap(v => {
        const current = activeView === v.id && (!weekly || selected !== weekly.id);
        const tab = <a key={v.id} className="tab" href={hrefFor(v.id)} aria-current={current ? "page" : undefined} onClick={e => inPlace(e, () => navigate(v.id))}><span>{v.label}</span></a>;
        return v.id === "leaderboard" && weekly ? [tab, <a key="week" className="tab" href={hrefFor("practice", weekly.id)} aria-current={selected === weekly.id ? "page" : undefined} onClick={e => inPlace(e, () => navigate("practice", weekly.id))}><span>This week</span></a>] : [tab];
      })}</nav>
      <span className="spacer" />
      {board?.weekEndsAt ? <WeekChip endsAt={board.weekEndsAt} onOpen={e => inPlace(e, () => navigate("leaderboard"))} /> : null}
      <ProfileMenu codename={codename} points={progress?.totalXp ?? 0} rank={board?.viewer?.rank} onSettings={() => navigate("settings")} onSignOut={signOut} />
    </header>
    <main className="app-main" id="main-content" tabIndex={-1}>
      {bootError ? <Notice type="error">{bootError}</Notice> : null}
      {dataError ? <Notice type="error">{dataError} <button className="text-button" onClick={loadData}>Try again</button></Notice> : null}
      {activeView === "settings" ? <Settings bootstrap={bootstrap} refresh={refresh} signOut={signOut} board={board} progress={progress} />
        : activeView === "authoring" ? <Authoring bootstrap={bootstrap} goSettings={() => navigate("settings")} registerLeaveGuard={registerLeaveGuard} />
        : activeView === "rules" ? <RulesContent />
        : activeView === "resources" ? <LearningProgressProvider key={bootstrap.user.id} userId={bootstrap.user.id}><ResourcesContent /></LearningProgressProvider>
        : activeView === "competitions" ? <Competitions bootstrap={bootstrap} route={competitionRoute} open={openCompetition} goSettings={() => navigate("settings")} renderChallenge={(eventId,id,back,onSolved) => <ChallengeView key={`${eventId}:${id}`} id={id} competitionId={eventId} back={back} onSolved={onSolved} />} />
        : dataBusy && !progress ? <Loading label="Loading the board" />
        : activeView === "leaderboard" ? <LeaderboardView initial={board} progress={progress} viewer={codename} />
        : activeView === "progress" ? <ProgressView progress={progress} board={board} total={challenges.length} open={openChallenge} browse={() => navigate("practice")} />
        : <Library challenges={challenges} progress={progress} board={board} query={query} setQuery={setQuery} searchInput={searchInput} open={openChallenge} />}
      {selected && activeView !== "competitions" ? <ChallengeView key={selected} id={selected} back={closeChallenge} onSolved={loadData} /> : null}
    </main>
  </div>;
}

/** Full-screen gate (boot, email check, codename) over a slow ASCII light field. */
function Screen({ children }: { children: ReactNode }) {
  return <div className="center-screen"><AsciiField className="screen-ascii" ox={0.5} oy={1.08} rx={0.75} ry={0.7} fadeFrom={-1} fadeTo={0} />{children}</div>;
}

function ProfileMenu({ codename, points, rank, onSettings, onSignOut }: { codename: string; points: number; rank?: number; onSettings: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false); const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } }
      else if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  // A disclosure, not role="menu": two plain buttons need no arrow-key model.
  return <div className="profile" ref={root}>
    <button ref={button} type="button" className="profile-button" aria-expanded={open} aria-controls="profile-actions" onClick={() => setOpen(v => !v)}><Identicon name={codename} size={32} you /><span className="profile-text"><span className="mono profile-name">{codename}</span><span className="standing-pill">{rank ? <b>#{rank} this week</b> : null}<span className="tabular-nums">{points.toLocaleString()} pts</span></span></span><Icon name="down" size={14} /></button>
    {open ? <div className="menu" id="profile-actions"><button type="button" onClick={() => { setOpen(false); onSettings(); }}>Settings</button><button type="button" onClick={() => { setOpen(false); onSignOut(); }}><Icon name="exit" size={15} />Sign out</button></div> : null}
  </div>;
}

/** When the weekly board resets, as a quiet link to the leaderboard. */
function WeekChip({ endsAt, onOpen }: { endsAt: string; onOpen: (e: MouseEvent) => void }) {
  const left = useCountdownLabel(endsAt);
  return left ? <a className="week-chip" href={hrefFor("leaderboard")} onClick={onOpen}>Week ends in <span className="mono">{left}</span></a> : null;
}

function useCountdownLabel(endsAt: string) {
  const [label, setLabel] = useState("");
  useEffect(() => { if (!endsAt) return; const tick = () => { const p = countdownParts(new Date(endsAt).getTime() - Date.now()); setLabel(`${p.days}d ${p.hours}h ${String(p.minutes).padStart(2, "0")}m`); }; tick(); const t = window.setInterval(tick, 30_000); return () => window.clearInterval(t); }, [endsAt]);
  return label;
}

function WeeklyBanner({ challenge, open }: { challenge: ChallengeSummary; open: (id: string) => void }) {
  const left = useCountdownLabel(challenge.weeklyEndsAt!);
  return <section className="weekly-banner" aria-label="This week’s challenge">
    <span className="label-dot accent">This week</span><strong>{challenge.title}</strong>
    <span className="mono muted">{challenge.category.toLowerCase()}, {challenge.xp} pts{left ? `, ends in ${left}` : ""}</span>
    <span className="spacer" /><span className="muted">{challenge.solveCount} solved</span>
    <a className="button button-primary" href={hrefFor("practice", challenge.id)} onClick={e => inPlace(e, () => open(challenge.id))}>{challenge.solved ? "Review challenge" : "Open challenge"}</a>
  </section>;
}

type Status = "" | "open" | "solved";
function Library({ challenges, progress, board, query, setQuery, searchInput, open }: { challenges: ChallengeSummary[]; progress: Progress | null; board: Leaderboard | null; query: string; setQuery: (v: string) => void; searchInput: RefObject<HTMLInputElement | null>; open: (id: string) => void }) {
  const [status, setStatus] = useState<Status>("");
  const [cat, setCat] = useState("");
  const [levels, setLevels] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"board" | "list">("board");
  const [sort, setSort] = useState<"points" | "solves" | "newest">("points");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category"), difficulty = params.get("difficulty");
    if (CATEGORIES.some(value => value === category)) setCat(category!);
    if (DIFFICULTIES.some(value => value === difficulty)) setLevels(new Set([difficulty!]));
  }, []);
  const toggle = (set: Set<string>, value: string, update: (s: Set<string>) => void) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); update(next); };
  const filtered = useMemo(() => challenges.filter(c => (!query || `${c.title} ${c.summary} ${c.tags.join(" ")} ${c.category}`.toLowerCase().includes(query.toLowerCase())) && (!cat || c.category === cat) && (!levels.size || levels.has(c.difficulty)) && (!status || (status === "solved" ? c.solved : !c.solved)))
    .sort((a, b) => sort === "points" ? a.xp - b.xp : sort === "solves" ? b.solveCount - a.solveCount : 0), [challenges, query, cat, levels, status, sort]);
  const count = (fn: (c: ChallengeSummary) => boolean) => challenges.filter(fn).length;
  const filtering = !!(query || cat || levels.size || status);
  const clear = () => { setQuery(""); setCat(""); setLevels(new Set()); setStatus(""); };
  const solved = progress?.solvedCount ?? 0, total = challenges.length;
  const weekly = challenges.find(isWeekly);
  const usedCats = CATEGORIES.filter(c => challenges.some(x => x.category === c));
  const slug = (c: string) => `cat-${c.toLowerCase().replace(/\s+/g, "-")}`;

  return <>
    <div className="page-head library-head">
      <div><h1>Challenges</h1><p>{total ? `${total} challenges in ${usedCats.length} categories. Open any of them, in any order.` : "Challenges appear here once they’re published."}</p></div>
      <div className="lib-progress">
        <div className="lib-progress-head"><p><strong className="tabular-nums">{solved}</strong> of {total} solved</p><p className="lib-progress-meta">{board?.viewer ? <b>#{board.viewer.rank} this week</b> : <span>Not ranked this week</span>}<span className="tabular-nums">{(progress?.totalXp ?? 0).toLocaleString()} pts</span></p></div>
        <Meter value={solved} max={total} tone="accent" cells={30} label={`${solved} of ${total} solved`} />
      </div>
    </div>
    {weekly ? <WeeklyBanner challenge={weekly} open={open} /> : null}
    <div className="lib-filters">
      <div className="filter-tabs" role="group" aria-label="Category">
        <button type="button" aria-pressed={!cat} onClick={() => setCat("")}>All<span className="count">{total}</span></button>
        {CATEGORIES.map(c => { const n = count(x => x.category === c); return n ? <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c}<span className="count">{n}</span></button> : null; })}
      </div>
      <div className="lib-filter-row">
        <label className="search-box lib-search"><Icon name="search" size={16} /><span className="sr-only">Search challenges</span><input ref={searchInput} type="search" aria-keyshortcuts="/" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setQuery(""); }} placeholder="Search titles, tags, categories" /></label>
        <div className="segmented" role="group" aria-label="Status">{([["", "All"], ["open", "Open"], ["solved", "Solved"]] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}</div>
        <div className="segmented" role="group" aria-label="Difficulty">{DIFFICULTIES.map(d => <button key={d} type="button" aria-pressed={levels.has(d)} onClick={() => toggle(levels, d, setLevels)}><Pips value={d} />{d}</button>)}</div>
        <span className="spacer" />
        <label className="select-inline"><span className="muted">Sort</span><select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="points">Points</option><option value="solves">Most solved</option><option value="newest">Newest</option></select></label>
        <div className="segmented" role="group" aria-label="Layout">{(["board", "list"] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "board" ? "Board" : "List"}</button>)}</div>
      </div>
      {/* The live region stays mounted so screen readers hear each change; it only shows text while filtering. */}
      <p className="lib-count" aria-live="polite">{filtering ? <><span>{filtered.length} of {total} {total === 1 ? "challenge" : "challenges"} match</span><button type="button" className="text-button" onClick={clear}>Clear filters</button></> : null}</p>
    </div>
    {!filtered.length ? <Empty title={total ? "No challenges match" : "The board is empty for now"} action={total ? <button className="button button-secondary" onClick={clear}>Clear filters</button> : undefined}>{total ? "Try a different search or remove a filter." : "Published challenges appear here when an author releases them."}</Empty>
      : mode === "list" ? <ChallengeTable items={filtered} open={open} />
      : <div className="cat-rows">{CATEGORIES.filter(c => filtered.some(x => x.category === c)).map(category => { const items = filtered.filter(x => x.category === category); const all = challenges.filter(x => x.category === category); const done = all.filter(x => x.solved).length; return <section className="cat-row" key={category} aria-labelledby={slug(category)}>
        <header className="cat-row-head"><h2 id={slug(category)}>{category}</h2><span className="mono muted">{done}/{all.length} solved</span><Meter value={done} max={all.length} cells={10} label={`${done} of ${all.length} solved`} /></header>
        <div className="cards">{items.map(c => <ChallengeCard key={c.id} title={c.title} xp={c.xp} difficulty={c.difficulty} solveCount={c.solveCount} state={cardState(c)} href={hrefFor("practice", c.id)} onOpen={e => inPlace(e, () => open(c.id))} />)}</div>
      </section>; })}</div>}
  </>;
}

function ChallengeTable({ items, open }: { items: ChallengeSummary[]; open: (id: string) => void }) {
  return <div className="table" role="table" aria-label="Challenges">
    <div className="tr th" role="row"><span role="columnheader">Challenge</span><span role="columnheader">Category</span><span role="columnheader">Level</span><span role="columnheader">Time</span><span role="columnheader">Points</span><span role="columnheader">Status</span></div>
    {items.map(c => { const [glyph, status] = c.solved ? ["[x]", "solved"] : c.attempted ? ["[~]", "in progress"] : ["[ ]", "open"]; return <div key={c.id} className="tr" role="row">
      <span role="cell" className="td-title"><a className="row-link" href={hrefFor("practice", c.id)} onClick={e => inPlace(e, () => open(c.id))}><strong>{c.title}</strong></a><span>{c.summary}</span></span>
      <span role="cell" className="muted">{c.category}</span><span role="cell"><Difficulty value={c.difficulty} /></span>
      <span role="cell" className="mono muted">{c.estimatedMinutes} min</span><span role="cell" className="mono strong">{c.xp}</span>
      <span role="cell" className={`mono ${c.solved ? "accent" : "faint"}`}><span aria-hidden="true">{glyph} </span>{status}</span>
    </div>; })}
  </div>;
}

type SubmitResult = { status: "correct" | "incorrect" | "already_solved"; xp: number; totalXp: number; solution?: string };

function ChallengeView({ id, back, onSolved, competitionId }: { id: string; back: () => void; onSolved: () => Promise<void>; competitionId?: string }) {
  const endpoint = competitionId ? `/api/v1/competitions/${encodeURIComponent(competitionId)}/challenges/${encodeURIComponent(id)}` : `/api/v1/challenges/${encodeURIComponent(id)}`;
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null); const [loadError, setLoadError] = useState(""); const [error, setError] = useState(""); const [flag, setFlag] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<SubmitResult | null>(null); const [miss, setMiss] = useState(0);
  const [solverError, setSolverError] = useState(""); const [shownSolvers, setShownSolvers] = useState(20);
  // Solvers get their own tab so a long list never pushes the flag form and walkthrough out of reach.
  const [pane, setPane] = useState<"challenge" | "solvers">("challenge");
  const tabIds = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function tabKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = ["challenge", "solvers"] as const, at = order.indexOf(pane), n = order.length;
    const next = event.key === "ArrowRight" ? (at + 1) % n : event.key === "ArrowLeft" ? (at + n - 1) % n : event.key === "Home" ? 0 : event.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setPane(order[next]); tabs.current[next]?.focus();
  }
  async function refreshSolvers() {
    try { setChallenge(await api<ChallengeDetail>(endpoint)); setSolverError(""); }
    catch { setSolverError("Could not refresh the solver list. Your saved progress is unchanged."); }
  }
  useEffect(() => { let active = true; setChallenge(null); setLoadError(""); setError(""); setResult(null); setFlag(""); api<ChallengeDetail>(endpoint).then(data => { if (active) setChallenge(data); }).catch(err => { if (active) setLoadError(err.message); }); return () => { active = false; }; }, [endpoint]);
  useEffect(() => { if (!challenge?.competitionEndsAt || challenge.submissionsOpen === false) return; const delay = new Date(challenge.competitionEndsAt).getTime()-Date.now(); if (delay > 2_147_483_647) return; const timer = window.setTimeout(() => { void refreshSolvers(); void onSolved(); },Math.max(0,delay)); return () => window.clearTimeout(timer); },[challenge?.competitionEndsAt,challenge?.submissionsOpen]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await api<SubmitResult>(`${endpoint}/submissions`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ flag }) });
      setResult(response);
      if (response.status !== "incorrect") { setChallenge(c => c ? { ...c, solved: true, attempted: true, solution: response.solution ?? c.solution } : c); setFlag(""); }
      else { setMiss(m => m + 1); setChallenge(c => c ? { ...c, attempted: true } : c); }
      await onSolved();
      if (response.status !== "incorrect") await refreshSolvers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit your flag."); } finally { setBusy(false); }
  }
  const backLabel = competitionId ? "Back to competition" : "Back to challenges";
  const level = challenge?.difficulty.toLowerCase();
  const solvers = challenge?.solvers ?? [], latest = solvers.slice(-5).reverse();
  const firstBlood = solvers.find(s => s.firstBlood);
  return <Modal labelledBy="challenge-title" onClose={back} className="challenge-modal">
    <div className="modal-bar">
      {challenge ? <div className="tags"><span className="tag">{challenge.category.toLowerCase()}</span><span className={`tag tag-${level}`}>{level}</span>{isWeekly(challenge) ? <span className="tag tag-accent">this week</span> : null}</div> : null}
      <span className="spacer" />
      {challenge ? <span className="mono accent strong points">{challenge.xp} pts</span> : null}
      <button type="button" className="icon-button" onClick={back} aria-label={competitionId ? "Close and return to the competition" : "Close challenge"}><Icon name="close" size={18} /></button>
    </div>
    {loadError ? <div className="modal-body"><h2 id="challenge-title" className="sr-only">Challenge unavailable</h2><Empty title="This challenge isn’t available" action={<button className="button button-secondary" onClick={back}>{backLabel}</button>}>{loadError}</Empty></div>
    : !challenge ? <div className="modal-body"><h2 id="challenge-title" className="sr-only">Opening the challenge</h2><Loading label="Opening the challenge" /></div>
    : <div className="modal-body challenge">
      <header className="challenge-head">
        <h2 id="challenge-title">{challenge.title}</h2>
        <div className="challenge-meta muted">{latest.length ? <span className="solver-stack" aria-hidden="true">{latest.map((s,i) => <Identicon key={i} name={s.codename} size={22} />)}</span> : null}
          <span>{challenge.solveCount} {challenge.solveCount === 1 ? "solve" : "solves"}{latest.length ? <>, latest by <span className="mono">{latest[0].codename}</span></> : ""}. About {challenge.estimatedMinutes} min. By <span className="mono">{challenge.author}</span>, version {challenge.version}.</span></div>
      </header>
      <div className="modal-tabs" role="tablist" aria-label="Challenge sections" onKeyDown={tabKeys}>
        {([["challenge", "Challenge", null], ["solvers", "Solvers", challenge.solveCount]] as const).map(([value, label, count], i) => <button key={value} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`${tabIds}-${value}-tab`} aria-controls={`${tabIds}-${value}`} aria-selected={pane === value} tabIndex={pane === value ? 0 : -1} className="modal-tab" onClick={() => setPane(value)}>{label}{count !== null ? <>{" "}<span className="mono">{count}</span></> : null}</button>)}
      </div>
      <div className="challenge-pane" role="tabpanel" id={`${tabIds}-challenge`} aria-labelledby={`${tabIds}-challenge-tab`} hidden={pane !== "challenge"}>
      <section className="modal-section" aria-label="Description"><Content text={challenge.description} />{challenge.tags.includes("rules") ? <Link className="button button-secondary fit" href="/rules">Read Rules / Mechanics</Link> : null}{challenge.tags.length ? <ul className="tag-list" aria-label="Tags">{challenge.tags.map(t => <li key={t} className="tag">{t}</li>)}</ul> : null}</section>
      <section className="modal-section" aria-labelledby="files-title"><div className="section-head"><h3 id="files-title">Files</h3><span className="spacer" /><span className="mono muted">{challenge.files.length} {challenge.files.length === 1 ? "file" : "files"}</span></div>
        {challenge.files.length ? <ul className="files">{challenge.files.map(file => <li key={file.id}>
          <div className="file-info"><span className="mono strong">{file.name}</span><span className="mono faint">{humanSize(file.size)}</span></div>
          <a className="button button-secondary" href={`${endpoint}/files/${encodeURIComponent(file.id)}`} download><Icon name="download" size={16} />Download</a>
        </li>)}</ul> : <p className="muted">No files. Everything you need is in the description.</p>}
      </section>
      <section className="submit" aria-labelledby="submit-title">
        {challenge.solved ? <div className="captured">
          <div className="verdict verdict-correct"><span className="mono" aria-hidden="true">[x]</span>{result?.status === "correct" ? <DecodeText text="correct" className="mono strong" /> : <span className="mono strong">solved</span>}{result?.status === "correct" ? <span className="fade-up mono strong">+{result.xp} pts</span> : null}</div>
          <h3 id="submit-title">Flag captured</h3>
          <p className="muted">{result?.status === "correct" ? <>{competitionId ? "Your competition score" : "Your total"} is now <span className="mono">{result.totalXp.toLocaleString()}</span> points.</> : result?.status === "already_solved" ? "You had already solved this one, so no extra points. Your progress is saved." : <>This one is on your record for <span className="mono">{challenge.xp}</span> points.</>}</p>
          <button className="button button-secondary" onClick={back}>{competitionId ? "Back to competition" : "Find another challenge"}</button>
        </div> : <>
          <h3 id="submit-title">Submit the flag</h3>
          {challenge.submissionsOpen === false ? <Notice>This competition has ended. Submissions are closed.</Notice> : null}
          <p className="muted">Flags look like <code>{challenge.flagFormat.replace(/^dfctf/i, "dfCTF")}</code>. Paste the whole thing, wrapper included.</p>
          <form onSubmit={submit} className="flag-row">
            <label className="sr-only" htmlFor="flag-input">Flag</label>
            <input id="flag-input" key={miss} className={`flag-input${result?.status === "incorrect" ? " shake is-wrong" : ""}`} value={flag} onChange={e => setFlag(e.target.value)} placeholder="dfCTF{...}" required maxLength={1000} autoComplete="off" spellCheck={false} autoCapitalize="off" disabled={busy || challenge.submissionsOpen === false} aria-invalid={result?.status === "incorrect" || undefined} aria-describedby={result?.status === "incorrect" ? "flag-verdict" : undefined} />
            <button className="button button-primary" disabled={busy || !flag.trim() || challenge.submissionsOpen === false}>{busy ? <><Spinner />Checking</> : "Submit flag"}</button>
          </form>
          {result?.status === "incorrect" ? <p id="flag-verdict" className="verdict verdict-wrong mono" role="alert"><span aria-hidden="true">[ ] </span>incorrect. Nothing was deducted; check the files again.</p> : null}
          {error ? <Notice type="error">{error}</Notice> : null}
          <p className="fine">Wrong answers never cost points. After several quick misses you’ll see a short cooldown.</p>
        </>}
      </section>
      {challenge.solved && challenge.solution ? <section className="modal-section unlocked" aria-labelledby="walk-title"><div className="section-head"><h3 id="walk-title">Walkthrough</h3><span className="spacer" /><span className="mono accent" aria-hidden="true">[open]</span></div><Content text={challenge.solution} /></section>
        : <p className="locked"><span className="mono faint" aria-hidden="true">[locked]</span>The walkthrough opens after you capture the flag.</p>}
      </div>
      <div className="challenge-pane" role="tabpanel" id={`${tabIds}-solvers`} aria-labelledby={`${tabIds}-solvers-tab`} hidden={pane !== "solvers"}>
      <section className="modal-section" aria-labelledby="solvers-title">
        <div className="section-head"><h3 id="solvers-title" className="sr-only">Solvers</h3><span className="spacer" /><span className="mono muted">{challenge.solveCount} {challenge.solveCount === 1 ? "solve" : "solves"}</span><button className="text-button" onClick={refreshSolvers}>Refresh</button></div>
        {solverError ? <Notice type="error">{solverError}</Notice> : null}
        {firstBlood ? <div className="first-blood"><Identicon name={firstBlood.codename} size={36} /><div><strong>First blood</strong><span className="mono">{firstBlood.codename}</span></div><time dateTime={firstBlood.solvedAt}>{solveTime(firstBlood.solvedAt)}</time></div> : null}
        {solvers.length ? <><p className="fine">Earliest solves first. Times are in Philippine time (UTC+8).</p><ol className="challenge-solvers">{solvers.slice(0,shownSolvers).map((s,i) => <li key={`${s.codename}:${i}`}><span className="mono faint">{i+1}</span><Identicon name={s.codename} /><strong className="mono solver-name">{s.codename}</strong>{s.firstBlood ? <span className="tag tag-accent">first blood</span> : null}<time dateTime={s.solvedAt}>{solveTime(s.solvedAt)}</time></li>)}</ol>{shownSolvers < solvers.length ? <button className="button button-secondary fit" onClick={() => setShownSolvers(n => n+20)}>Show more solvers</button> : null}</> : <p className="muted">No solves yet. Capture the flag to claim first blood.</p>}
      </section>
      </div>
    </div>}
  </Modal>;
}

function solveTime(value: string) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function StandingsTable({ standings, viewer, max }: { standings: Leaderboard["standings"]; viewer: Leaderboard["viewer"]; max: number }) {
  const shown = standings.slice(0, 15), pinned = viewer && !shown.some(s => s.codename === viewer.codename);
  const row = (s: Leaderboard["standings"][number], you: boolean) => <li key={s.codename} className={`${s.rank <= 3 ? "top" : ""}${you ? " you" : ""}`}><span className="rank mono">{String(s.rank).padStart(2, "0")}</span><Identicon name={s.codename} you={you} /><span className="mono name">{s.codename}{you ? <em>you</em> : null}</span><Meter value={s.points} max={max} tone={s.rank <= 3 || you ? "accent" : "ink"} label={`${s.points} points`} /><span className="mono num muted">{s.solves}</span><span className="mono num strong">{s.points.toLocaleString()}</span></li>;
  if (!standings.length) return <p className="muted panel-pad">No points yet in this range. The first solve puts a name at the top.</p>;
  return <ol className="standings"><li className="standings-head" aria-hidden="true"><span>#</span><span /><span>Player</span><span /><span className="num">Solves</span><span className="num">Points</span></li>{shown.map(s => row(s, s.codename === viewer?.codename))}{pinned ? <><li className="gap mono faint" aria-hidden="true">...</li>{row(viewer, true)}</> : null}</ol>;
}

function LeaderboardView({ initial, progress, viewer }: { initial: Leaderboard | null; progress: Progress | null; viewer: string }) {
  const [range, setRange] = useState<"week" | "all">("week");
  const [data, setData] = useState<Leaderboard | null>(initial);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const left = useCountdownLabel(data?.weekEndsAt ?? "");
  useEffect(() => { setError(""); if (range === "week" && initial) { setData(initial); return; } let active = true; setData(null); api<Leaderboard>(`/api/v1/leaderboard?range=${range}`).then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [range, initial, retry]);
  return <>
    <div className="page-head"><div><h1>Leaderboard</h1><p>{range === "week" ? "This week, updated as flags land. Ties go to whoever reached the score first." : "Every point since dfCTF opened. Ties go to whoever reached the score first."}</p></div>
      <div className="segmented" role="group" aria-label="Range">{([["week", "This week"], ["all", "All time"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div></div>
    {error ? <Notice type="error">{error} <button className="text-button" onClick={() => setRetry(n => n + 1)}>Try again</button></Notice> : !data ? <Loading label="Loading the leaderboard" /> : <>
    {range === "week" ? <section className="panel" aria-labelledby="race-title"><div className="panel-head"><h2 id="race-title">Race for #1</h2><InfoTip text="Each line is a player’s rank against all players, sampled at 20:00 Philippine time each day and now. Gaps mean the player had no solves yet. The bars are solves per hour; yellow caps mark hours with a first blood." /><span className="muted hide-sm">How this week’s top players have moved. Hover a name to follow its line.</span><span className="spacer" /><span className="muted">{left} left</span></div><RaceChart race={data.race} hourly={data.hourly} viewer={viewer} /></section> : null}
    <div className="lb-grid">
      <section className="panel" aria-labelledby="stand-title"><div className="panel-head"><h2 id="stand-title">Standings</h2><InfoTip text="Points in this range. The meter shows each player’s points relative to the leader." /><span className="spacer" /><span className="muted">{data.players} {data.players === 1 ? "player" : "players"}</span></div><StandingsTable standings={data.standings} viewer={data.viewer} max={data.standings[0]?.points ?? 0} /></section>
      <div className="lb-side">
        <section className="panel" aria-labelledby="you-title"><div className="panel-head"><h2 id="you-title">Your standing</h2><InfoTip text="Your rank and points in this range, and how your solves spread across the seven categories." /><span className="spacer" /><span className="mono muted">{viewer}</span></div>
          <div className="you-stats"><div><strong className="accent">{data.viewer ? `#${data.viewer.rank}` : "unranked"}</strong><span>rank</span></div><div><strong>{(data.viewer?.points ?? 0).toLocaleString()}</strong><span>points</span></div><div><strong>{data.viewer?.solves ?? 0}</strong><span>solves</span></div></div>
          <p className="muted panel-pad tight">{data.viewer?.gap ? <>{data.viewer.gap.points.toLocaleString()} pts behind #{data.viewer.rank - 1} <span className="mono">{data.viewer.gap.codename}</span>.</> : data.viewer ? "You’re at the top. Hold it." : "Solve a challenge to get on the board."}</p>
          {progress ? <Radar values={progress.categories.map(c => ({ label: c.category === "Web exploitation" ? "Web" : c.category === "Binary exploitation" ? "Binary" : c.category === "General skills" ? "General" : c.category === "Steganography" ? "Steg" : c.category === "Miscellaneous" ? "Misc" : c.category, solved: c.solved, total: c.total }))} /> : null}
        </section>
        <section className="panel" aria-labelledby="who-title"><div className="panel-head"><h2 id="who-title">Who solved what</h2><InfoTip text="One square per challenge, easiest to hardest. Pixel density shows how many players solved it; empty squares have no solves yet. Yellow outlines are yours." /></div><div className="panel-pad"><SolveGrid challenges={data.challenges} /></div></section>
      </div>
    </div>
    </>}
  </>;
}

function ProgressView({ progress, board, total, open, browse }: { progress: Progress | null; board: Leaderboard | null; total: number; open: (id: string) => void; browse: () => void }) {
  const solved = progress?.solvedCount ?? 0;
  return <>
    <div className="page-head"><div><h1>Progress</h1><p>Your solves, points, and how they spread across the seven categories.</p></div></div>
    <section className="stats-strip wide" aria-label="Totals">
      <div><span className="stat-label">Points</span><span className="stat-value">{(progress?.totalXp ?? 0).toLocaleString()}</span></div>
      <div><span className="stat-label">Solved</span><span className="stat-value">{solved}<small className="mono"> / {total}</small></span><Meter value={solved} max={total} tone="accent" label={`${solved} of ${total} solved`} /></div>
      <div><span className="stat-label">Started</span><span className="stat-value">{progress?.attemptedCount ?? 0}</span></div>
      <div><span className="stat-label">This week</span><span className="stat-value accent">{board?.viewer ? `#${board.viewer.rank}` : "unranked"}</span></div>
    </section>
    <div className="lb-grid">
      <section className="panel" aria-labelledby="hist-title"><div className="panel-head"><h2 id="hist-title">Solve history</h2></div>
        {progress?.recentSolves.length ? <ul className="history">{progress.recentSolves.map(s => <li key={s.id}><a href={hrefFor("practice", s.id)} onClick={e => inPlace(e, () => open(s.id))}><strong>{s.title}</strong><span className="muted">{s.category}, {formatDate(s.solvedAt)}</span><span className="mono accent strong">+{s.xp}</span></a></li>)}</ul>
          : <Empty title="No solves yet" action={<button className="button button-secondary" onClick={browse}>Open the challenges</button>}>Your first captured flag shows up here.</Empty>}
      </section>
      <div className="lb-side">
        <section className="panel" aria-labelledby="cat-title"><div className="panel-head"><h2 id="cat-title">By category</h2><InfoTip text="How your solves spread across the seven categories, out of the challenges published in each." /></div>{progress ? <Radar values={progress.categories.map(c => ({ label: c.category.split(" ")[0], solved: c.solved, total: c.total }))} /> : null}</section>
        <section className="panel" aria-labelledby="days-title"><div className="panel-head"><h2 id="days-title">Last 16 weeks</h2><InfoTip text="Your solves per day. The outlined column is this week." /></div><div className="panel-pad">{board ? <Heatmap days={board.mine.days} start={board.mine.start} cell={16} gap={4} weekdays label="Your solves per day" /> : null}</div></section>
      </div>
    </div>
  </>;
}

function AccessGate({ bootstrap, refresh, signOut }: { bootstrap: Bootstrap; refresh: () => Promise<void>; signOut: () => Promise<void> }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const verified = !!bootstrap.user?.emailVerified;
  async function send() {
    setBusy(true); setError("");
    try { await api("/api/auth/send-verification-email", { method: "POST", body: JSON.stringify({ email: bootstrap.user?.email, callbackURL: `${window.location.origin}/?verified=1` }) }); setMessage("Verification email sent. Open the link, then come back and check again."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not send email."); } finally { setBusy(false); }
  }
  async function check() { setBusy(true); await refresh(); setBusy(false); setMessage(verified ? "Your account access is still suspended. Contact an administrator if you think this is a mistake." : ""); }
  return <Screen>
    <Wordmark size="lg" />
    <div className="gate-card">
      <ol className="steps-inline" aria-label="Getting in"><li data-done>[x] Account created</li><li data-done={verified || undefined}>{verified ? "[x]" : "[ ]"} Email verified</li></ol>
      <h1>{verified ? "Access suspended" : "Check your inbox."}</h1>
      <p className="muted">{verified ? <>Access for <strong>{bootstrap.user?.email}</strong> is suspended. Contact an administrator if you think this is a mistake.</> : <>We sent a verification link to <strong>{bootstrap.user?.email}</strong>. Open it to confirm the address is yours.</>}</p>
      {message ? <Notice type="success">{message}</Notice> : null}{error ? <Notice type="error">{error}</Notice> : null}
      <div className="stack">
        {!verified ? <button className="button button-primary" onClick={send} disabled={busy}>{busy ? "Sending" : "Resend verification email"}</button> : null}
        <button className="button button-secondary" onClick={check} disabled={busy}>Check again</button>
        <button className="text-button" onClick={signOut}>Sign out</button>
      </div>
      {bootstrap.localMail ? <LocalInbox /> : null}
    </div>
  </Screen>;
}

const CODENAME = /^[A-Za-z0-9_.-]{3,24}$/;
function Onboarding({ user, refresh }: { user: Viewer; refresh: () => Promise<void> }) {
  const [codename, setCodename] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/v1/me", { method: "PATCH", body: JSON.stringify({ codename }) }); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save codename."); } finally { setBusy(false); } }
  const valid = CODENAME.test(codename);
  return <Screen>
    <Wordmark size="lg" />
    <div className="gate-card">
      <h1>Choose your codename</h1>
      <p className="muted">This is the name on the leaderboard. Your email, <strong>{user.email}</strong>, stays private.</p>
      <div className="codename-preview" aria-live="polite"><Identicon name={codename || "your_codename"} size={56} you /><div><strong className="mono">{codename || "your_codename"}</strong><span className="muted">Your avatar is drawn from your codename. Change a letter, get a new one.</span></div></div>
      {error ? <Notice type="error">{error}</Notice> : null}
      <form className="stack" onSubmit={save}>
        <label className="field"><span>Codename</span><input className="mono" value={codename} onChange={e => setCodename(e.target.value)} placeholder="packet_fox" minLength={3} maxLength={24} pattern="[A-Za-z0-9_.\-]+" required autoComplete="nickname" spellCheck={false} aria-describedby="codename-help" /><small id="codename-help">3 to 24 characters: letters, numbers, and _ . or -. Some names, like admin, are reserved.</small></label>
        {codename ? <p className={`mono ${valid ? "accent" : "danger"}`}>{valid ? "[x] Looks good" : "[ ] Not valid yet"}</p> : null}
        <button className="button button-primary block" disabled={busy || !valid}>{busy ? "Saving" : "Save codename and start"}</button>
      </form>
    </div>
  </Screen>;
}

function Settings({ bootstrap, refresh, signOut, board, progress }: { bootstrap: Bootstrap; refresh: () => Promise<void>; signOut: () => Promise<void>; board: Leaderboard | null; progress: Progress | null }) {
  const user = bootstrap.user!;
  return <>
    <div className="page-head"><div><h1>Settings</h1><p>Your identity, appearance, and account security.</p></div></div>
    <div className="settings">
      <SettingsSection title="Identity" description="Your codename and avatar are public on the leaderboard. Your email is visible only to you and staff.">
        <div className="identity-card"><Identicon name={user.codename!} size={44} you /><div><strong className="mono">{user.codename}</strong><span className="muted">{board?.viewer ? `#${board.viewer.rank} this week, ` : ""}{(progress?.totalXp ?? 0).toLocaleString()} points</span></div></div>
        <dl className="kv"><div><dt>Email</dt><dd>{user.email}<span className={`tag ${user.emailVerified ? "tag-accent" : ""}`}>{user.emailVerified ? "verified" : "not verified"}</span></dd></div><div><dt>Role</dt><dd>{roleName(user.role)}</dd></div></dl>
        <p className="fine">Codenames can’t be changed from here yet. Ask staff if you need a new one.</p>
      </SettingsSection>
      <SettingsSection title="Appearance" description="Choose a theme for this browser. Dark is the default."><ThemeToggle /></SettingsSection>
      {user.role !== "participant" ? <MfaSettings bootstrap={bootstrap} refresh={refresh} /> : null}
      <AccountSecurity bootstrap={bootstrap} refresh={refresh} />
      {user.role === "admin" && bootstrap.staffVerified ? <Allowlist /> : null}
      <SettingsSection title="Account" description="Sign out on this browser. To change your password, use Forgot password on the sign-in screen.">
        <div className="stack"><button className="button button-secondary fit" onClick={signOut}><Icon name="exit" size={16} />Sign out</button>{bootstrap.localMail ? <LocalInbox /> : null}</div>
      </SettingsSection>
    </div>
  </>;
}

function MfaSettings({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<void> }) {
  const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState(false);
  async function start(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { setSetup(await api("/api/v1/auth/mfa/setup", { method: "POST", body: JSON.stringify({ password: password || undefined }) })); setPassword(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not set up authentication."); } finally { setBusy(false); } }
  async function verify(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code, method: backup && !setup ? "backup" : "totp" }) }); setCode(""); setSetup(null); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not verify code."); } finally { setBusy(false); } }
  const secret = setup ? new URL(setup.totpURI).searchParams.get("secret") ?? "" : "";
  const enrolled = !!bootstrap.user?.twoFactorEnabled;
  const codeForm = <form className="stack" onSubmit={verify}>
    <div className="field"><label htmlFor="mfa-code">{backup && !setup ? "Backup code" : "Authenticator code"}</label><input id="mfa-code" className="mono code-input" value={code} onChange={e => setCode(e.target.value)} inputMode={backup && !setup ? "text" : "numeric"} autoComplete="one-time-code" placeholder={backup && !setup ? "Your saved backup code" : "6 digits"} required minLength={6} maxLength={20} disabled={busy} aria-describedby="mfa-code-help" />
      <small id="mfa-code-help">{backup && !setup ? "Each backup code works once." : "Open your authenticator app and type the 6-digit code shown under dfCTF. It changes every 30 seconds."}</small></div>
    <button className="button button-primary fit" disabled={busy}>{busy ? "Verifying" : "Verify code"}</button>
    {enrolled && !setup ? <button type="button" className="text-button fit" disabled={busy} onClick={() => { setBackup(v => !v); setCode(""); setError(""); }}>{backup ? "Use an authenticator code instead" : "Use a backup code instead"}</button> : null}
  </form>;
  return <SettingsSection title="Staff verification" description="Authoring, review, and admin tools ask for a second step: a 6-digit code from an authenticator app on your phone. You enter it once per sign-in, and it lasts up to 12 hours.">
    <ol className="steps-inline" aria-label="Staff verification steps"><li data-done={enrolled || undefined}><span aria-hidden="true">{enrolled ? "[x]" : "[ ]"} </span>Authenticator app linked</li><li data-done={bootstrap.staffVerified || undefined}><span aria-hidden="true">{bootstrap.staffVerified ? "[x]" : "[ ]"} </span>This session verified</li></ol>
    {error ? <Notice type="error">{error}</Notice> : null}
    {bootstrap.staffVerified ? <Notice type="success">This session is verified. Staff tools are unlocked.</Notice> : !enrolled && !setup ? <form className="stack" onSubmit={start}>
      <p className="muted">You need a free authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator, or 2FAS. dfCTF gives the app a secret key once, and the app turns it into a new 6-digit code every 30 seconds. Nobody sends you the code; you read it from the app.</p>
      <label className="field"><span>Current password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /><small>Leave this empty if you sign in with Google, GitHub, or Facebook.</small></label>
      <button className="button button-primary fit" disabled={busy}>{busy ? "Preparing" : "Set up authenticator"}</button>
    </form> : setup ? <ol className="mfa-steps">
      <li><h3>Add dfCTF to your authenticator app</h3>
        <p className="muted">In the app, tap <strong>+</strong>, choose <strong>Enter a setup key</strong> (some apps call it manual entry), name it dfCTF, and paste this key. Time-based is the default.</p>
        <div className="setup-key"><code>{secret.match(/.{1,4}/g)?.join(" ")}</code><CopyButton value={secret} label="Copy the setup key" /></div>
        <p className="fine">Reading this on the phone that has the app? <a className="text-button" href={setup.totpURI}>Open it in your authenticator</a></p></li>
      <li><h3>Save your backup codes</h3>
        <p className="muted">Keep them in a password manager. Each one works once if you lose your phone.</p>
        <div className="backup-codes"><pre>{setup.backupCodes.join("\n")}</pre><CopyButton value={setup.backupCodes.join("\n")} label="Copy all backup codes" /></div></li>
      <li><h3>Type the code the app shows</h3>{codeForm}</li>
    </ol> : <>
      <p className="muted">{backup ? "Enter one of your saved backup codes to unlock staff tools for this session." : "Your authenticator is linked. Enter its current code to unlock staff tools for this session."}</p>
      {codeForm}
    </>}
  </SettingsSection>;
}

function Allowlist() {
  const [entries, setEntries] = useState<{ id: string; email: string; createdAt?: string }[]>([]); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [filter, setFilter] = useState("");
  const load = useCallback(async () => { try { setEntries(await api("/api/v1/staff/allowlist")); } catch (err) { setError(err instanceof Error ? err.message : "Could not load the access list."); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function add(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); setMessage(""); try { await api("/api/v1/staff/allowlist", { method: "POST", body: JSON.stringify({ email }) }); setMessage(`Restored access for ${email}.`); setEmail(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not restore access."); } finally { setBusy(false); } }
  async function remove(entry: { id: string; email: string }) { if (!window.confirm(`Revoke access for ${entry.email}? Their next request will be blocked, even if they’re signed in.`)) return; setBusy(true); setError(""); setMessage(""); try { await api(`/api/v1/staff/allowlist/${encodeURIComponent(entry.id)}`, { method: "DELETE" }); setMessage(`Revoked access for ${entry.email}.`); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not revoke access."); } finally { setBusy(false); } }
  const shown = entries.filter(entry => entry.email.toLowerCase().includes(filter.toLowerCase()));
  return <SettingsSection title="Account access" description="Admins only. Anyone can register and verify their email. Revoking access blocks the person’s next request.">
    {error ? <Notice type="error">{error}</Notice> : null}{message ? <Notice type="success">{message}</Notice> : null}
    <form className="inline-form" onSubmit={add}><label className="field grow"><span className="sr-only">Email address</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" /></label><button className="button button-primary" disabled={busy}><Icon name="plus" size={16} />Restore access</button></form>
    <div className="list-head"><span className="mono muted">{entries.length} {entries.length === 1 ? "address" : "addresses"}</span>{entries.length > 6 ? <label className="search-box small"><Icon name="search" size={14} /><span className="sr-only">Filter the access list</span><input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter" /></label> : null}</div>
    {shown.length ? <ul className="rows">{shown.map(entry => <li key={entry.id}><span className="mono break">{entry.email}</span>{entry.createdAt ? <span className="muted">Added {formatDate(entry.createdAt)}</span> : null}<span className="spacer" /><button className="text-button danger" disabled={busy} onClick={() => remove(entry)} aria-label={`Revoke access for ${entry.email}`}>Revoke</button></li>)}</ul> : <p className="muted">{entries.length ? "No addresses match that filter." : "No one is on the list yet."}</p>}
  </SettingsSection>;
}
