"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { Bootstrap, ChallengeDetail, ChallengeSummary, Progress, Viewer } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { applyTheme, parseTheme, THEME_COOKIE } from "@/lib/theme";
import AuthPanel, { LocalInbox, type AuthMode } from "./auth-panel";
import Authoring from "./authoring";
import AccountSecurity from "./account-security";
import CampusScene from "./campus-scene";
import Landing from "./landing";
import { api, Brand, categoryGlyph, CopyButton, Difficulty, Empty, formatDate, GlyphTile, humanSize, Icon, Loading, Meter, Notice, Pixel, SettingsSection, ThemeToggle, useTheme } from "./ui";

type View = "dashboard" | "practice" | "progress" | "authoring" | "settings";
const VIEWS: { id: View; label: string; icon: string; group: "Practice" | "Staff" | "Account" }[] = [
  { id: "dashboard", label: "Overview", icon: "grid", group: "Practice" },
  { id: "practice", label: "Library", icon: "flag", group: "Practice" },
  { id: "progress", label: "Progress", icon: "chart", group: "Practice" },
  { id: "authoring", label: "Authoring", icon: "edit", group: "Staff" },
  { id: "settings", label: "Settings", icon: "settings", group: "Account" },
];

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

export default function Workspace() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [selected, setSelected] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState("");

  const refresh = useCallback(async () => {
    try { setBootstrap(await api<Bootstrap>("/api/v1/auth/bootstrap")); setBootError(""); }
    catch (err) { setBootError(err instanceof Error ? err.message : "Could not connect to dfCTF."); }
  }, []);

  useEffect(() => {
    void refresh();
    // Carry a theme chosen before themes moved to a cookie.
    try {
      const legacy = parseTheme(window.localStorage.getItem("dfctf-theme-v1"));
      if (legacy && !document.cookie.includes(`${THEME_COOKIE}=`)) applyTheme(legacy);
      window.localStorage.removeItem("dfctf-theme-v1");
    } catch { /* storage unavailable */ }
    function readLocation() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view");
      setView(VIEWS.some(v => v.id === requested) ? requested as View : "dashboard");
      setSelected(params.get("challenge") ?? "");
      const auth = params.get("auth");
      const linkFlow = params.has("token") || params.has("verified") || params.has("error");
      setAuthMode(auth === "signup" ? "signup" : auth === "signin" || linkFlow ? "signin" : null);
    }
    readLocation(); window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, [refresh]);

  const loadData = useCallback(async () => {
    setDataBusy(true); setDataError("");
    try { const [items, stats] = await Promise.all([api<ChallengeSummary[]>("/api/v1/challenges"), api<Progress>("/api/v1/progress")]); setChallenges(items); setProgress(stats); }
    catch (err) { setDataError(err instanceof Error ? err.message : "Could not load your practice data."); }
    finally { setDataBusy(false); }
  }, []);

  const ready = !!bootstrap?.user && bootstrap.hasAccess && !!bootstrap.user.codename;
  useEffect(() => { if (ready) void loadData(); }, [ready, loadData]);

  function navigate(next: View, challenge = "") {
    setView(next); setSelected(challenge);
    window.history.pushState(null, "", hrefFor(next, challenge));
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }
  function openAuth(mode: AuthMode | null) {
    setAuthMode(mode);
    window.history.pushState(null, "", mode ? `/?auth=${mode}` : "/");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function signOut() {
    try { await api("/api/auth/sign-out", { method: "POST", body: "{}" }); setChallenges([]); setProgress(null); window.history.pushState(null, "", "/"); setAuthMode(null); await refresh(); }
    catch (err) { setBootError(err instanceof Error ? err.message : "Could not sign out. Please try again."); }
  }

  if (bootError && !bootstrap) return <div className="center-screen"><Brand/><div className="gate-card"><Notice type="error">{bootError}</Notice><button className="button button-primary" onClick={refresh}>Try again</button></div></div>;
  if (!bootstrap) return <div className="center-screen"><Brand/><Loading label="Opening dfCTF"/></div>;
  if (!bootstrap.user) return authMode ? <AuthPanel bootstrap={bootstrap} refresh={refresh} initialMode={authMode} back={() => openAuth(null)}/> : <Landing signIn={() => openAuth("signin")} createAccount={() => openAuth("signup")}/>;
  if (!bootstrap.hasAccess) return <AccessGate bootstrap={bootstrap} refresh={refresh} signOut={signOut}/>;
  if (!bootstrap.user.codename) return <Onboarding user={bootstrap.user} refresh={refresh}/>;

  const user = bootstrap.user;
  const staff = user.role !== "participant";
  const activeView = view === "authoring" && !staff ? "dashboard" : view;
  const current = VIEWS.find(v => v.id === activeView)!;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <a href={hrefFor("dashboard")} className="brand-link" aria-label="dfCTF overview" onClick={e => inPlace(e, () => navigate("dashboard"))}><Brand/></a>
      <nav aria-label="Main" className="side-nav">
        {(["Practice", "Staff", "Account"] as const).map(group => {
          const items = VIEWS.filter(item => item.group === group && (item.id !== "authoring" || staff));
          if (!items.length) return null;
          return <div className="nav-group" key={group}><span className="nav-caption">{group}</span>{items.map(item => <a key={item.id} className="nav-item" href={hrefFor(item.id)} aria-current={activeView === item.id && !selected ? "page" : undefined} data-active={activeView === item.id || undefined} onClick={e => inPlace(e, () => navigate(item.id))}><Icon name={item.icon} size={18}/><span>{item.label}</span>{item.id === "practice" && challenges.length ? <span className="nav-count tabular">{challenges.length}</span> : null}</a>)}</div>;
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="who"><span className="who-avatar" aria-hidden="true"><Pixel name="flag" size={16}/></span><div><strong>{user.codename}</strong><span>{user.role === "participant" ? `${(progress?.totalXp ?? 0).toLocaleString()} XP` : roleName(user.role)}</span></div><button className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="exit" size={18}/></button></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <nav className="breadcrumb" aria-label="Breadcrumb">{selected ? <><a href={hrefFor("practice")} onClick={e => inPlace(e, () => navigate("practice"))}>Library</a><Icon name="chevron" size={14}/><span aria-current="page">Case</span></> : <span aria-current="page">{current.label}</span>}</nav>
        <div className="topbar-right"><span className="beta-pill beta-pill-small"><span className="beta-dot" aria-hidden="true"/>Private beta</span><ThemeToggle/></div>
      </header>
      <main className="main-content" id="main-content" tabIndex={-1}>
        {bootError ? <Notice type="error">{bootError}</Notice> : null}
        {dataError ? <Notice type="error">{dataError} <button className="text-button" onClick={loadData}>Try again</button></Notice> : null}
        {selected ? <ChallengeView id={selected} back={() => navigate("practice")} onSolved={loadData}/>
          : activeView === "settings" ? <Settings bootstrap={bootstrap} refresh={refresh} signOut={signOut}/>
          : activeView === "authoring" ? <Authoring bootstrap={bootstrap} goSettings={() => navigate("settings")}/>
          : dataBusy && !progress ? <Loading label="Loading your cases"/>
          : activeView === "practice" ? <Practice challenges={challenges} open={id => navigate("practice", id)}/>
          : activeView === "progress" ? <ProgressView progress={progress} total={challenges.length} open={id => navigate("practice", id)} browse={() => navigate("practice")}/>
          : <Dashboard user={user} progress={progress} challenges={challenges} open={id => navigate("practice", id)} browse={() => navigate("practice")} showProgress={() => navigate("progress")}/>}
      </main>
    </div>
  </div>;
}

function roleName(role: Viewer["role"]) { return { participant: "Participant", author: "Author", reviewer: "Reviewer", admin: "Administrator" }[role]; }

function AccessGate({ bootstrap, refresh, signOut }: { bootstrap: Bootstrap; refresh: () => Promise<void>; signOut: () => Promise<void> }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const verified = !!bootstrap.user?.emailVerified;
  async function send() {
    setBusy(true); setError("");
    try { await api("/api/auth/send-verification-email", { method: "POST", body: JSON.stringify({ email: bootstrap.user?.email, callbackURL: `${window.location.origin}/?verified=1` }) }); setMessage("Verification email sent. Open the link, then come back and check your access."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not send email."); } finally { setBusy(false); }
  }
  async function check() { setBusy(true); await refresh(); setBusy(false); setMessage(verified ? "Still waiting on the beta list. Ask your organizer to add this exact email." : ""); }
  return <div className="center-screen">
    <div className="gate-top"><Brand/><ThemeToggle compact/></div>
    <div className="gate-card">
      <CampusScene width={240} height={90} className="gate-scene"/>
      <ol className="gate-steps" aria-label="Getting in">
        <li data-state="done">Account created</li>
        <li data-state={verified ? "done" : "current"}>Email verified</li>
        <li data-state={verified ? "current" : "todo"}>Added to the beta list</li>
      </ol>
      <h1>{verified ? "You’re almost in." : "Check your inbox."}</h1>
      <p>{verified ? <>dfCTF is in private beta. Your organizer needs to add <strong>{bootstrap.user?.email}</strong> to the beta list before you can open the library.</> : <>We sent a verification link to <strong>{bootstrap.user?.email}</strong>. Open it to confirm the address belongs to you.</>}</p>
      {message ? <Notice type="success">{message}</Notice> : null}{error ? <Notice type="error">{error}</Notice> : null}
      <div className="form-stack">
        {!verified ? <button className="button button-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Resend verification email"}</button> : null}
        <button className="button button-secondary" onClick={check} disabled={busy}>Check my access</button>
        <button className="text-button centered" onClick={signOut}>Sign out</button>
      </div>
      {bootstrap.localMail ? <LocalInbox/> : null}
    </div>
  </div>;
}

const CODENAME = /^[A-Za-z0-9_.-]{3,24}$/;

function Onboarding({ user, refresh }: { user: Viewer; refresh: () => Promise<void> }) {
  const [codename, setCodename] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/v1/me", { method: "PATCH", body: JSON.stringify({ codename }) }); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save codename."); } finally { setBusy(false); } }
  const valid = CODENAME.test(codename);
  return <div className="center-screen">
    <div className="gate-top"><Brand/><ThemeToggle compact/></div>
    <div className="gate-card">
      <h1>Choose your codename</h1>
      <p>This is the name other people see on dfCTF. Your email, <strong>{user.email}</strong>, stays private.</p>
      {error ? <Notice type="error">{error}</Notice> : null}
      <form className="form-stack" onSubmit={save}>
        <label className="field">Codename<input value={codename} onChange={e => setCodename(e.target.value)} placeholder="packet_fox" minLength={3} maxLength={24} pattern="[A-Za-z0-9_.\-]+" required autoComplete="nickname" spellCheck={false} aria-describedby="codename-help"/><span className="field-help" id="codename-help">3 to 24 characters: letters, numbers, and _ . or -. Some names, like admin or staff, are reserved.</span></label>
        <div className="codename-preview" aria-live="polite"><span className="who-avatar" aria-hidden="true"><Pixel name="flag" size={16}/></span><div><strong>{codename || "your_codename"}</strong><span>{codename && !valid ? "Not valid yet" : "0 XP, ready for a first case"}</span></div></div>
        <button className="button button-primary" disabled={busy || !valid}>{busy ? "Saving…" : "Save codename and continue"}</button>
      </form>
    </div>
  </div>;
}

function Dashboard({ user, progress, challenges, open, browse, showProgress }: { user: Viewer; progress: Progress | null; challenges: ChallengeSummary[]; open: (id: string) => void; browse: () => void; showProgress: () => void }) {
  const available = challenges.filter(c => !c.solved);
  const next = available.find(c => c.attempted) ?? available.find(c => c.tags.some(tag => tag.toLowerCase() === "onboarding")) ?? available.find(c => c.category === "General skills" && c.difficulty === "Easy") ?? available.find(c => c.difficulty === "Easy") ?? available[0];
  const suggestions = available.filter(c => c.id !== next?.id).slice(0, 4);
  const solved = progress?.solvedCount ?? 0;
  const recent = progress?.recentSolves.slice(0, 4) ?? [];
  return <>
    <div className="page-head">
      <div><h1>Welcome back, {user.codename}</h1><p>{challenges.length ? <>You’ve solved <span className="tabular">{solved}</span> of <span className="tabular">{challenges.length}</span> cases in the library.</> : "Your organizer hasn’t published any cases yet."}</p></div>
      <button className="button button-secondary" onClick={browse}>Open the library</button>
    </div>

    <div className="overview-grid">
      <section className="panel next-case" aria-labelledby="next-title">
        {next ? <>
          <div className="next-head"><span className="panel-label" id="next-title">{next.attempted ? "Pick up where you left off" : "Suggested next case"}</span><Difficulty value={next.difficulty}/></div>
          <div className="next-body"><GlyphTile name={categoryGlyph(next.category)} size="lg"/><div><span className="category-name">{next.category}</span><h2>{next.title}</h2><p>{next.summary}</p></div></div>
          <div className="next-foot"><dl className="facts"><div><dt>Time</dt><dd className="tabular">{next.estimatedMinutes} min</dd></div><div><dt>Reward</dt><dd className="tabular">{next.xp} XP</dd></div><div><dt>Solved by</dt><dd className="tabular">{next.solveCount} {next.solveCount === 1 ? "person" : "people"}</dd></div></dl><a className="button button-primary" href={hrefFor("practice", next.id)} onClick={e => inPlace(e, () => open(next.id))}>{next.attempted ? "Continue case" : "Open case"}</a></div>
        </> : <Empty glyph={challenges.length ? "check" : "flag"} title={challenges.length ? "Every flag captured" : "The library is empty for now"}>{challenges.length ? "You’ve solved every published case. New ones appear here as soon as they’re published." : "Published cases will appear here when your organizer releases them."}</Empty>}
      </section>

      <section className="panel stat-panel" aria-label="Your numbers">
        <div className="stat"><span className="stat-label">Practice XP</span><strong className="stat-value tabular">{(progress?.totalXp ?? 0).toLocaleString()}</strong></div>
        <div className="stat"><span className="stat-label">Flags captured</span><strong className="stat-value tabular">{solved}<small>/{challenges.length}</small></strong><Meter value={solved} total={challenges.length} label="Flags captured"/></div>
        <div className="stat"><span className="stat-label">Cases started</span><strong className="stat-value tabular">{progress?.attemptedCount ?? 0}</strong></div>
      </section>
    </div>

    <div className="overview-grid overview-grid-even">
      <section className="panel" aria-labelledby="skills-title">
        <div className="panel-head"><h2 id="skills-title">Skill map</h2><button className="text-button" onClick={showProgress}>All progress</button></div>
        <SkillList categories={progress?.categories ?? []}/>
      </section>
      <section className="panel" aria-labelledby="recent-title">
        <div className="panel-head"><h2 id="recent-title">Recent solves</h2></div>
        {recent.length ? <RecentList items={recent} open={open}/> : <p className="muted panel-empty">Your solves will appear here, newest first.</p>}
      </section>
    </div>

    {suggestions.length ? <section className="section-block" aria-labelledby="more-title">
      <div className="panel-head"><h2 id="more-title">More to explore</h2><button className="text-button" onClick={browse}>See all cases</button></div>
      <CaseTable items={suggestions} open={open}/>
    </section> : null}
  </>;
}

function SkillList({ categories }: { categories: Progress["categories"] }) {
  const shown = categories.filter(c => c.total > 0);
  if (!shown.length) return <p className="muted panel-empty">Your skill map fills in as cases are published.</p>;
  return <ul className="skill-list">{shown.map(c => <li key={c.category}><GlyphTile name={categoryGlyph(c.category)} size="sm"/><span className="skill-name">{c.category}</span><Meter value={c.solved} total={c.total} label={`${c.category}: ${c.solved} of ${c.total} solved`}/><span className="skill-count tabular">{c.solved}/{c.total}</span></li>)}</ul>;
}

function RecentList({ items, open }: { items: Progress["recentSolves"]; open: (id: string) => void }) {
  return <ul className="recent-list">{items.map(solve => <li key={solve.id}><a href={hrefFor("practice", solve.id)} onClick={e => inPlace(e, () => open(solve.id))}><GlyphTile name={categoryGlyph(solve.category)} size="sm"/><div><strong>{solve.title}</strong><span>{solve.category}, {formatDate(solve.solvedAt)}</span></div><span className="xp-gain tabular">+{solve.xp} XP</span></a></li>)}</ul>;
}

function StatusPill({ challenge }: { challenge: ChallengeSummary }) {
  return challenge.solved ? <span className="pill pill-solved"><Pixel name="check" size={10}/>Solved</span> : challenge.attempted ? <span className="pill pill-progress">In progress</span> : <span className="pill pill-new">Not started</span>;
}

function CaseTable({ items, open }: { items: ChallengeSummary[]; open: (id: string) => void }) {
  return <div className="case-table" role="table" aria-label="Cases">
    <div className="case-row case-row-head" role="row"><span role="columnheader">Case</span><span role="columnheader">Category</span><span role="columnheader">Level</span><span role="columnheader">Time</span><span role="columnheader">XP</span><span role="columnheader">Status</span></div>
    {items.map(c => <a key={c.id} className="case-row" role="row" href={hrefFor("practice", c.id)} onClick={e => inPlace(e, () => open(c.id))} data-solved={c.solved || undefined}>
      <span role="cell" className="case-title"><GlyphTile name={categoryGlyph(c.category)}/><span><strong>{c.title}</strong><span>{c.summary}</span></span></span>
      <span role="cell" className="case-cat">{c.category}</span>
      <span role="cell" className="case-level"><Difficulty value={c.difficulty}/></span>
      <span role="cell" className="case-num tabular">{c.estimatedMinutes} min</span>
      <span role="cell" className="case-num case-xp tabular">{c.xp}</span>
      <span role="cell" className="case-status"><StatusPill challenge={c}/></span>
    </a>)}
  </div>;
}

function Practice({ challenges, open }: { challenges: ChallengeSummary[]; open: (id: string) => void }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [difficulty, setDifficulty] = useState(""); const [status, setStatus] = useState("");
  const filtered = challenges.filter(c => (!query || `${c.title} ${c.summary} ${c.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (!category || c.category === category) && (!difficulty || c.difficulty === difficulty) && (!status || (status === "solved" ? c.solved : status === "in-progress" ? c.attempted && !c.solved : !c.attempted && !c.solved)));
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(cat => [cat, challenges.filter(c => c.category === cat).length])), [challenges]);
  const filtering = !!(query || category || difficulty || status);
  function clear() { setQuery(""); setCategory(""); setDifficulty(""); setStatus(""); }
  return <>
    <div className="page-head"><div><h1>Practice library</h1><p>Every case is a fictional investigation with downloadable evidence. Open any of them, in any order.</p></div><span className="count-chip tabular">{challenges.filter(c => c.solved).length}/{challenges.length} solved</span></div>
    <div className="filter-chips" role="group" aria-label="Category">
      <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>All<span className="tabular">{challenges.length}</span></button>
      {CATEGORIES.map(cat => <button type="button" key={cat} aria-pressed={category === cat} onClick={() => setCategory(category === cat ? "" : cat)} disabled={!counts[cat]}><Pixel name={categoryGlyph(cat)} size={12}/>{cat}<span className="tabular">{counts[cat]}</span></button>)}
    </div>
    <div className="toolbar">
      <label className="search-field"><Icon name="search" size={18}/><span className="sr-only">Search cases</span><input type="search" placeholder="Search by title, summary, or tag" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <label className="select-field"><span className="sr-only">Difficulty</span><select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="">Any difficulty</option>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}</select></label>
      <label className="select-field"><span className="sr-only">Progress</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Any progress</option><option value="unattempted">Not started</option><option value="in-progress">In progress</option><option value="solved">Solved</option></select></label>
    </div>
    <div className="results-line" aria-live="polite"><span className="tabular">{filtered.length} {filtered.length === 1 ? "case" : "cases"}</span>{filtering ? <button className="text-button" onClick={clear}><Icon name="close" size={14}/>Clear filters</button> : null}</div>
    {filtered.length ? <CaseTable items={filtered} open={open}/> : <Empty glyph="osint" title={challenges.length ? "No cases match" : "The library is empty for now"}><p>{challenges.length ? "Try a different search or remove a filter." : "Published cases appear here when your organizer releases them."}</p>{challenges.length ? <button className="button button-secondary" onClick={clear}>Clear filters</button> : null}</Empty>}
  </>;
}

type SubmitResult = { status: "correct" | "incorrect" | "already_solved"; xp: number; totalXp: number; solution?: string };

function ChallengeView({ id, back, onSolved }: { id: string; back: () => void; onSolved: () => Promise<void> }) {
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null); const [loadError, setLoadError] = useState(""); const [error, setError] = useState(""); const [flag, setFlag] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<SubmitResult | null>(null);
  useEffect(() => { let active = true; setChallenge(null); setLoadError(""); setError(""); setResult(null); setFlag(""); api<ChallengeDetail>(`/api/v1/challenges/${encodeURIComponent(id)}`).then(data => { if (active) setChallenge(data); }).catch(err => { if (active) setLoadError(err.message); }); return () => { active = false; }; }, [id]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await api<SubmitResult>(`/api/v1/challenges/${encodeURIComponent(id)}/submissions`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ flag }) });
      setResult(response);
      if (response.status !== "incorrect") { setChallenge(c => c ? { ...c, solved: true, attempted: true, solution: response.solution ?? c.solution } : c); setFlag(""); }
      else setChallenge(c => c ? { ...c, attempted: true } : c);
      await onSolved();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Could not submit your flag."); } finally { setBusy(false); }
  }
  if (loadError) return <><button className="text-button back-link" onClick={back}><Icon name="back" size={16}/>Back to the library</button><Empty glyph="lock" title="This case isn’t available"><p>{loadError}</p><button className="button button-secondary" onClick={back}>Back to the library</button></Empty></>;
  if (!challenge) return <Loading label="Opening the case"/>;
  return <>
    <button className="text-button back-link" onClick={back}><Icon name="back" size={16}/>Back to the library</button>
    <header className="case-head">
      <GlyphTile name={categoryGlyph(challenge.category)} size="lg"/>
      <div>
        <div className="case-kicker"><span className="category-name">{challenge.category}</span><Difficulty value={challenge.difficulty}/><StatusPill challenge={challenge}/></div>
        <h1>{challenge.title}</h1>
        <p className="case-summary">{challenge.summary}</p>
        <dl className="facts facts-inline"><div><dt>Reward</dt><dd className="tabular">{challenge.xp} XP</dd></div><div><dt>Time</dt><dd className="tabular">About {challenge.estimatedMinutes} min</dd></div><div><dt>Solved by</dt><dd className="tabular">{challenge.solveCount}</dd></div><div><dt>Author</dt><dd>{challenge.author}</dd></div><div><dt>Version</dt><dd className="tabular">{challenge.version}</dd></div></dl>
      </div>
    </header>
    <div className="case-grid">
      <div className="case-main">
        <section className="panel prose-panel" aria-labelledby="brief-title"><h2 id="brief-title">The brief</h2><Content text={challenge.description}/>{challenge.tags.length ? <ul className="tag-list" aria-label="Tags">{challenge.tags.map(t => <li key={t}>{t}</li>)}</ul> : null}</section>
        <section className="panel" aria-labelledby="evidence-title">
          <div className="panel-head"><h2 id="evidence-title">Evidence</h2><span className="muted tabular">{challenge.files.length} {challenge.files.length === 1 ? "file" : "files"}</span></div>
          {challenge.files.length ? <><p className="muted">Download the files and work on them on your own machine. Compare the checksum to confirm you have an intact copy.</p><ul className="file-list">{challenge.files.map(file => <li key={file.id} className="file-row">
            <span className="file-icon"><Icon name="file" size={20}/></span>
            <div className="file-info"><strong>{file.name}</strong><span className="tabular">{humanSize(file.size)}</span><span className="checksum"><span className="checksum-label">SHA-256</span><code>{file.sha256}</code><CopyButton value={file.sha256} label={`Copy the SHA-256 checksum for ${file.name}`}/></span></div>
            <a className="button button-secondary button-small" href={`/api/v1/challenges/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`} download><Icon name="download" size={16}/>Download</a>
          </li>)}</ul></> : <p className="muted">This case has no files. Everything you need is in the brief.</p>}
        </section>
        {challenge.solved && challenge.solution ? <section className="panel prose-panel walkthrough" aria-labelledby="walk-title"><div className="panel-head"><h2 id="walk-title">Walkthrough</h2><span className="pill pill-solved"><Pixel name="check" size={10}/>Unlocked</span></div><Content text={challenge.solution}/></section>
          : <section className="panel locked-panel" aria-label="Walkthrough"><Pixel name="lock" size={16}/><div><strong>Walkthrough</strong><p>Opens when you capture the flag, so you can compare your approach with the author’s.</p></div></section>}
      </div>
      <aside className="case-aside">
        <section className="panel submit-panel" aria-labelledby="submit-title">
          {challenge.solved ? <div className="captured">
            <span className="captured-mark"><Pixel name="flag" size={28}/></span>
            <h2 id="submit-title">Flag captured</h2>
            <p>{result?.status === "correct" ? <>You earned <strong className="tabular">{result.xp} XP</strong>. Your total is now <span className="tabular">{result.totalXp.toLocaleString()}</span> XP.</> : result?.status === "already_solved" ? "You’d already solved this one, so no extra XP. Your progress is saved." : <>This case is part of your record. It earned <span className="tabular">{challenge.xp}</span> XP.</>}</p>
            <button className="button button-secondary" onClick={back}>Find another case</button>
          </div> : <>
            <h2 id="submit-title">Submit the flag</h2>
            <p className="muted">Flags look like <code className="inline-code">{challenge.flagFormat}</code>. Paste the whole thing, wrapper included.</p>
            {result?.status === "incorrect" ? <Notice type="error">That’s not the flag. Nothing was deducted; check the evidence again and retry.</Notice> : null}
            {error ? <Notice type="error">{error}</Notice> : null}
            <form className="form-stack" onSubmit={submit}>
              <label className="field">Your flag<input className="flag-input" value={flag} onChange={e => setFlag(e.target.value)} placeholder={challenge.flagFormat} required maxLength={1000} autoComplete="off" spellCheck={false} autoCapitalize="off" disabled={busy}/></label>
              <button className="button button-primary button-block" disabled={busy || !flag.trim()}>{busy ? <><span className="spinner" aria-hidden="true"/>Checking…</> : "Submit flag"}</button>
            </form>
            <p className="fine-print">Wrong answers never cost XP. After several quick misses you’ll see a short cooldown.</p>
          </>}
        </section>
      </aside>
    </div>
  </>;
}

export function Content({ text }: { text: string }) {
  return <div className="prose">{text.split(/\n\s*\n/).map((paragraph, i) => paragraph.startsWith("### ") ? <h4 key={i}>{paragraph.slice(4)}</h4> : paragraph.startsWith("## ") ? <h3 key={i}>{paragraph.slice(3)}</h3> : paragraph.startsWith("# ") ? <h3 key={i}>{paragraph.slice(2)}</h3> : paragraph.startsWith("```") ? <pre key={i}>{paragraph.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</pre> : <p key={i}>{inlineCode(paragraph)}</p>)}</div>;
}

function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) => part.length > 2 && part.startsWith("`") && part.endsWith("`") ? <code key={i} className="inline-code">{part.slice(1, -1)}</code> : part);
}

function ProgressView({ progress, total, open, browse }: { progress: Progress | null; total: number; open: (id: string) => void; browse: () => void }) {
  const solved = progress?.solvedCount ?? 0;
  const pct = total ? Math.round(solved / total * 100) : 0;
  return <>
    <div className="page-head"><div><h1>Your progress</h1><p>Solves, XP, and how your skills spread across the seven categories.</p></div></div>
    <section className="stat-row" aria-label="Totals">
      <div className="stat"><span className="stat-label">Practice XP</span><strong className="stat-value tabular">{(progress?.totalXp ?? 0).toLocaleString()}</strong></div>
      <div className="stat"><span className="stat-label">Flags captured</span><strong className="stat-value tabular">{solved}<small>/{total}</small></strong></div>
      <div className="stat"><span className="stat-label">Cases started</span><strong className="stat-value tabular">{progress?.attemptedCount ?? 0}</strong></div>
      <div className="stat"><span className="stat-label">Library explored</span><strong className="stat-value tabular">{pct}<small>%</small></strong><Meter value={solved} total={total} label="Library explored"/></div>
    </section>
    <div className="overview-grid overview-grid-even">
      <section className="panel" aria-labelledby="cat-title"><div className="panel-head"><h2 id="cat-title">By category</h2></div><SkillList categories={progress?.categories ?? []}/></section>
      <section className="panel" aria-labelledby="hist-title"><div className="panel-head"><h2 id="hist-title">Solve history</h2></div>{progress?.recentSolves.length ? <RecentList items={progress.recentSolves} open={open}/> : <Empty glyph="flag" title="No solves yet"><p>Your first captured flag will show up here.</p><button className="button button-secondary" onClick={browse}>Open the library</button></Empty>}</section>
    </div>
  </>;
}

function Settings({ bootstrap, refresh, signOut }: { bootstrap: Bootstrap; refresh: () => Promise<void>; signOut: () => Promise<void> }) {
  const user = bootstrap.user!;
  const theme = useTheme();
  return <>
    <div className="page-head"><div><h1>Settings</h1><p>Your identity, appearance, and account security.</p></div></div>
    <div className="settings-stack">
      <SettingsSection title="Identity" description="Your codename is public. Your email is visible only to you and staff.">
        <dl className="identity-list">
          <div><dt>Codename</dt><dd><strong>{user.codename}</strong></dd></div>
          <div><dt>Email</dt><dd>{user.email}<span className={`pill ${user.emailVerified ? "pill-solved" : "pill-new"}`}>{user.emailVerified ? "Verified" : "Not verified"}</span></dd></div>
          <div><dt>Role</dt><dd>{roleName(user.role)}</dd></div>
        </dl>
        <p className="fine-print">Codenames can’t be changed from here during the private beta. Ask staff if you need a new one.</p>
      </SettingsSection>
      <SettingsSection title="Appearance" description="Day shift is the light theme and night shift is the dark one. The choice is saved in this browser.">
        <div className="shift-cards">
          {(["light", "dark"] as const).map(option => <button key={option} type="button" className="shift-card" data-shift={option} aria-pressed={theme === option} onClick={() => applyTheme(option)}>
            <span className="shift-swatch" aria-hidden="true"><span/><span/><span/></span>
            <span className="shift-name"><Pixel name={option === "light" ? "sun" : "moon"} size={13}/>{option === "light" ? "Day shift" : "Night shift"}</span>
          </button>)}
        </div>
      </SettingsSection>
      {user.role !== "participant" ? <MfaSettings bootstrap={bootstrap} refresh={refresh}/> : null}
      {user.role === "admin" && bootstrap.staffVerified ? <Allowlist/> : null}
      <AccountSecurity bootstrap={bootstrap} refresh={refresh}/>
      <SettingsSection title="Account" description="Sign out on this browser. To change your password, use “Forgot password” on the sign-in screen.">
        <div className="form-stack"><button className="button button-secondary fit-content" onClick={signOut}><Icon name="exit" size={17}/>Sign out</button>{bootstrap.localMail ? <LocalInbox/> : null}</div>
      </SettingsSection>
    </div>
  </>;
}

function MfaSettings({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<void> }) {
  const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function start(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { setSetup(await api("/api/v1/auth/mfa/setup", { method: "POST", body: JSON.stringify({ password: password || undefined }) })); setPassword(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not set up authentication."); } finally { setBusy(false); } }
  async function verify(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code }) }); setCode(""); setSetup(null); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not verify code."); } finally { setBusy(false); } }
  const secret = setup ? new URL(setup.totpURI).searchParams.get("secret") ?? "" : "";
  const enrolled = !!bootstrap.user?.twoFactorEnabled;
  return <SettingsSection title="Staff verification" description="Authoring, review, and access management need an authenticator app and a verified session. A verification lasts up to 12 hours.">
    <ol className="gate-steps gate-steps-inline" aria-label="Staff verification steps">
      <li data-state={enrolled || setup ? "done" : "current"}>Connect an authenticator</li>
      <li data-state={bootstrap.staffVerified ? "done" : enrolled || setup ? "current" : "todo"}>Verify this session</li>
    </ol>
    {error ? <Notice type="error">{error}</Notice> : null}
    {bootstrap.staffVerified ? <Notice type="success">This session is verified. Staff tools are unlocked.</Notice> : !enrolled && !setup ? <form className="form-stack" onSubmit={start}>
      <label className="field">Current password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/><span className="field-help">Leave this empty if you sign in with Google or GitHub.</span></label>
      <button className="button button-primary fit-content" disabled={busy}>{busy ? "Preparing…" : "Set up authenticator"}</button>
    </form> : <>
      {setup ? <div className="mfa-setup">
        <p>In your authenticator app, add an account with this setup key:</p>
        <div className="setup-key"><code>{secret}</code><CopyButton value={secret} label="Copy the setup key"/></div>
        <details><summary>Show the full authenticator link</summary><code className="break-anywhere">{setup.totpURI}</code></details>
        <div className="backup-codes"><strong>Save these backup codes somewhere safe.</strong><p>Each one works once if you lose your authenticator.</p><pre>{setup.backupCodes.join("\n")}</pre><CopyButton value={setup.backupCodes.join("\n")} label="Copy all backup codes"/></div>
      </div> : <p className="muted">Enter the current code from your authenticator to unlock staff tools for this session.</p>}
      <form className="form-stack" onSubmit={verify}>
        <label className="field">Authenticator code<input className="code-input" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required minLength={6} maxLength={20}/></label>
        <button className="button button-primary fit-content" disabled={busy}>{busy ? "Verifying…" : "Verify code"}</button>
      </form>
    </>}
  </SettingsSection>;
}

function Allowlist() {
  const [entries, setEntries] = useState<{ id: string; email: string; createdAt?: string }[]>([]); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [filter, setFilter] = useState("");
  const load = useCallback(async () => { try { setEntries(await api("/api/v1/staff/allowlist")); } catch (err) { setError(err instanceof Error ? err.message : "Could not load the beta list."); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function add(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); setMessage(""); try { await api("/api/v1/staff/allowlist", { method: "POST", body: JSON.stringify({ email }) }); setMessage(`Added ${email}. They can register now.`); setEmail(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not add email."); } finally { setBusy(false); } }
  async function remove(entry: { id: string; email: string }) { if (!window.confirm(`Revoke access for ${entry.email}? Their next request will be blocked, even if they’re signed in.`)) return; setBusy(true); setError(""); setMessage(""); try { await api(`/api/v1/staff/allowlist/${encodeURIComponent(entry.id)}`, { method: "DELETE" }); setMessage(`Revoked access for ${entry.email}.`); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not revoke access."); } finally { setBusy(false); } }
  const shown = entries.filter(entry => entry.email.toLowerCase().includes(filter.toLowerCase()));
  return <SettingsSection title="Beta list" description="Only these exact email addresses can register and open the library. Revoking access blocks the person’s next request.">
    {error ? <Notice type="error">{error}</Notice> : null}{message ? <Notice type="success">{message}</Notice> : null}
    <form className="inline-form" onSubmit={add}><label className="field grow">Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="participant@example.edu"/></label><button className="button button-primary" disabled={busy}><Icon name="plus" size={16}/>Add email</button></form>
    <div className="list-head"><span className="tabular">{entries.length} {entries.length === 1 ? "address" : "addresses"}</span>{entries.length > 6 ? <label className="search-field search-small"><Icon name="search" size={16}/><span className="sr-only">Filter the beta list</span><input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter"/></label> : null}</div>
    {shown.length ? <ul className="plain-list">{shown.map(entry => <li key={entry.id}><span className="list-primary break-anywhere">{entry.email}</span>{entry.createdAt ? <span className="muted tabular">Added {formatDate(entry.createdAt)}</span> : null}<button className="text-button danger-text" disabled={busy} onClick={() => remove(entry)} aria-label={`Revoke access for ${entry.email}`}>Revoke</button></li>)}</ul> : <p className="muted">{entries.length ? "No addresses match that filter." : "No one is on the beta list yet."}</p>}
  </SettingsSection>;
}

