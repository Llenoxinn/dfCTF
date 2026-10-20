"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Bootstrap, Category, ChallengeDetail, ChallengeStatus, ChallengeSummary, Difficulty as Level } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { api, categoryGlyph, Difficulty, Empty, GlyphTile, humanSize, Icon, Loading, Notice } from "./ui";

type EditorData = {
  title: string; category: Category; difficulty: Level; summary: string; description: string;
  solution: string; flag: string; flagFormat: string; tags: string; xp: number; estimatedMinutes: number;
};
const blank: EditorData = { title: "", category: "General skills", difficulty: "Easy", summary: "", description: "", solution: "", flag: "", flagFormat: "dfctf{...}", tags: "", xp: 100, estimatedMinutes: 20 };
type StaffDetail = ChallengeDetail & { authorId?: string; canPublish?: boolean };
const STATUS_LABEL: Record<ChallengeStatus, string> = { draft: "Draft", review: "In review", published: "Published", archived: "Archived" };

export default function Authoring({ bootstrap, goSettings }: { bootstrap: Bootstrap; goSettings: () => void }) {
  const [items, setItems] = useState<ChallengeSummary[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<string | null>(null); const [filter, setFilter] = useState<ChallengeStatus | "">("");
  const load = useCallback(async () => { setBusy(true); try { setItems(await api("/api/v1/staff/challenges")); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not load the authoring workspace."); } finally { setBusy(false); } }, []);
  useEffect(() => { if (bootstrap.staffVerified) void load(); }, [bootstrap.staffVerified, load]);
  const canCreate = bootstrap.user?.role === "author" || bootstrap.user?.role === "admin";

  if (!bootstrap.staffVerified) return <>
    <div className="page-head"><div><h1>Authoring</h1><p>Write cases, review other people’s, and publish them to the library.</p></div></div>
    <div className="panel staff-gate"><GlyphTile name="key" size="lg"/><div><h2>Verify this session first</h2><p>Staff tools need an authenticator app and a verification in the current session. It takes about a minute the first time.</p><button className="button button-primary" onClick={goSettings}>Go to staff verification</button></div></div>
  </>;
  if (selected !== null) return <ChallengeEditor id={selected} role={bootstrap.user!.role} viewerId={bootstrap.user!.id} close={() => { setSelected(null); void load(); }}/>;

  const shown = filter ? items.filter(i => i.status === filter) : items;
  return <>
    <div className="page-head"><div><h1>Authoring</h1><p>Every case is solved by a second person before it reaches the library.</p></div>{canCreate ? <button className="button button-primary" onClick={() => setSelected("new")}><Icon name="plus" size={17}/>New case</button> : null}</div>
    <ol className="workflow" aria-label="Publishing workflow">
      <li><span className="flow-step">1</span><div><strong>Draft</strong><span>Write the brief, walkthrough, and flag. Attach evidence.</span></div></li>
      <li><span className="flow-step">2</span><div><strong>Review</strong><span>Someone other than the author downloads the evidence and solves it.</span></div></li>
      <li><span className="flow-step">3</span><div><strong>Publish</strong><span>The reviewer’s correct test-solve flag publishes it to practice.</span></div></li>
    </ol>
    {error ? <Notice type="error">{error}</Notice> : null}
    {busy ? <Loading label="Loading cases"/> : items.length ? <>
      <div className="filter-chips" role="group" aria-label="Status">
        <button type="button" aria-pressed={!filter} onClick={() => setFilter("")}>All<span className="tabular">{items.length}</span></button>
        {(Object.keys(STATUS_LABEL) as ChallengeStatus[]).map(status => <button type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(filter === status ? "" : status)} disabled={!items.some(i => i.status === status)}>{STATUS_LABEL[status]}<span className="tabular">{items.filter(i => i.status === status).length}</span></button>)}
      </div>
      <div className="case-table" role="table" aria-label="Cases you can author or review">
        <div className="case-row case-row-head authoring-row" role="row"><span role="columnheader">Case</span><span role="columnheader">Category</span><span role="columnheader">Level</span><span role="columnheader">XP</span><span role="columnheader">Status</span></div>
        {shown.map(item => <button key={item.id} className="case-row authoring-row" role="row" onClick={() => setSelected(item.id)}>
          <span role="cell" className="case-title"><GlyphTile name={categoryGlyph(item.category)}/><span><strong>{item.title}</strong><span>{item.summary}</span></span></span>
          <span role="cell" className="case-cat">{item.category}</span>
          <span role="cell" className="case-level"><Difficulty value={item.difficulty}/></span>
          <span role="cell" className="case-num case-xp tabular">{item.xp}</span>
          <span role="cell" className="case-status"><StatusBadge status={item.status}/></span>
        </button>)}
      </div>
    </> : <Empty glyph="edit" title="No cases yet"><p>{canCreate ? "Create a draft, attach the evidence, and send it for review." : "Cases submitted for review will appear here."}</p>{canCreate ? <button className="button button-primary" onClick={() => setSelected("new")}><Icon name="plus" size={16}/>New case</button> : null}</Empty>}
  </>;
}

function StatusBadge({ status }: { status: ChallengeStatus }) { return <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>; }

function ChallengeEditor({ id, role, viewerId, close }: { id: string; role: string; viewerId: string; close: () => void }) {
  const [currentId, setCurrentId] = useState(id);
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [form, setForm] = useState<EditorData>(blank);
  const [loading, setLoading] = useState(id !== "new"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [testFlag, setTestFlag] = useState("");
  const read = useCallback(async (challengeId: string) => {
    const data = await api<StaffDetail>(`/api/v1/staff/challenges/${encodeURIComponent(challengeId)}`);
    setDetail(data); setForm({ title: data.title, category: data.category, difficulty: data.difficulty, summary: data.summary, description: data.description, solution: data.solution ?? "", flag: "", flagFormat: data.flagFormat, tags: data.tags.join(", "), xp: data.xp, estimatedMinutes: data.estimatedMinutes });
  }, []);
  useEffect(() => { if (id === "new") return; read(id).catch(err => setError(err.message)).finally(() => setLoading(false)); }, [id, read]);
  const editable = !detail || detail.status === "draft" && (role === "admin" || role === "author" && detail.authorId === viewerId);
  const canReview = role === "reviewer" || role === "admin";
  const dirty = !detail || files.length > 0 || !!form.flag || form.title !== detail.title || form.summary !== detail.summary || form.description !== detail.description || form.solution !== detail.solution || form.category !== detail.category || form.difficulty !== detail.difficulty || form.xp !== detail.xp || form.estimatedMinutes !== detail.estimatedMinutes || form.flagFormat !== detail.flagFormat || form.tags !== detail.tags.join(", ");
  function field<K extends keyof EditorData>(key: K, value: EditorData[K]) { setForm(f => ({ ...f, [key]: value })); }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), ...(currentId !== "new" && !form.flag ? { flag: undefined } : {}) };
      const result = await api<{ id: string }>(currentId === "new" ? "/api/v1/staff/challenges" : `/api/v1/staff/challenges/${encodeURIComponent(currentId)}`, { method: currentId === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      const savedId = currentId === "new" ? result.id : currentId; setCurrentId(savedId);
      for (const file of files) { const body = new FormData(); body.append("file", file); await api(`/api/v1/staff/challenges/${encodeURIComponent(savedId)}/files`, { method: "POST", body }); }
      setFiles([]); await read(savedId); setMessage("Draft saved. Check the brief and evidence, then send it for review.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save this draft."); } finally { setBusy(false); }
  }
  async function transition(status: "review" | "archived" | "publish") {
    setBusy(true); setError(""); setMessage("");
    try { await api(`/api/v1/staff/challenges/${encodeURIComponent(currentId)}${status === "publish" ? "/publish" : ""}`, { method: status === "publish" ? "POST" : "PATCH", body: status === "publish" ? JSON.stringify({ flag: testFlag }) : JSON.stringify({ status }) }); await read(currentId); setTestFlag(""); setMessage(status === "publish" ? "Published. The case is now in the practice library." : status === "review" ? "Sent for review. A reviewer other than the author can publish it." : "Archived. The case is no longer in the practice library."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the status."); } finally { setBusy(false); }
  }

  const checklist = [
    { done: form.title.trim().length >= 3 && form.summary.trim().length >= 10, label: "Title and summary" },
    { done: form.description.trim().length >= 20, label: "Brief" },
    { done: form.solution.trim().length >= 20, label: "Walkthrough" },
    { done: currentId !== "new" || form.flag.length >= 8, label: "Flag" },
    { done: !!detail?.files.length || files.length > 0, label: "Evidence file" },
    { done: !!detail && !dirty, label: "Saved" },
  ];

  return <>
    <button className="text-button back-link" onClick={close}><Icon name="back" size={16}/>Back to authoring</button>
    <div className="page-head"><div><h1>{currentId === "new" ? "New case" : form.title || "Untitled case"}</h1><p>{editable ? "A clear brief, purposeful evidence, and a satisfying discovery." : "Read the case, solve it yourself, and use the publishing controls."}</p></div><StatusBadge status={detail?.status ?? "draft"}/></div>
    {error ? <Notice type="error">{error}</Notice> : null}{message ? <Notice type="success">{message}</Notice> : null}
    {loading ? <Loading label="Opening the editor"/> : <form onSubmit={save} className="editor">
      <div className="editor-main">
        <section className="panel form-stack" aria-labelledby="ed-case">
          <h2 id="ed-case">The case</h2>
          <label className="field">Title<input value={form.title} onChange={e => field("title", e.target.value)} required minLength={3} maxLength={80} readOnly={!editable} placeholder="The midnight request"/><span className="field-help tabular">{form.title.length}/80</span></label>
          <label className="field">Summary<textarea rows={2} value={form.summary} onChange={e => field("summary", e.target.value)} required minLength={10} maxLength={240} readOnly={!editable} placeholder="One or two sentences shown in the library."/><span className="field-help tabular">Shown in the library. {form.summary.length}/240</span></label>
          <label className="field">Brief<textarea rows={10} value={form.description} onChange={e => field("description", e.target.value)} required minLength={20} maxLength={20000} readOnly={!editable} placeholder="Set the scene, state the objective, and say which files to use."/><span className="field-help">Plain text. Blank lines separate paragraphs; lines starting with ## become headings; `backticks` mark commands.</span></label>
          <label className="field">Walkthrough<textarea rows={8} value={form.solution} onChange={e => field("solution", e.target.value)} required minLength={20} maxLength={20000} readOnly={!editable} placeholder="The intended approach, and the lesson to take away."/><span className="field-help">Learners see this only after they solve the case.</span></label>
        </section>
        <section className="panel" aria-labelledby="ed-evidence">
          <div className="panel-head"><h2 id="ed-evidence">Evidence</h2><span className="muted tabular">{(detail?.files.length ?? 0) + files.length} {((detail?.files.length ?? 0) + files.length) === 1 ? "file" : "files"}</span></div>
          {detail?.files.length ? <ul className="file-list">{detail.files.map(file => <li key={file.id} className="file-row"><span className="file-icon"><Icon name="file" size={20}/></span><div className="file-info"><strong>{file.name}</strong><span className="tabular">{humanSize(file.size)}</span></div><a className="button button-secondary button-small" href={`/api/v1/staff/challenges/${encodeURIComponent(currentId)}/files/${encodeURIComponent(file.id)}`} download><Icon name="download" size={16}/>Download</a></li>)}</ul> : null}
          {editable ? <label className="upload-field"><Icon name="upload" size={22}/><strong>Add evidence files</strong><span>TXT, CSV, JSON, LOG, PCAP, ZIP, PNG, JPG, or PDF, up to 10 MB each. Files are never opened or run by the server.</span><input type="file" multiple accept=".txt,.csv,.json,.log,.pcap,.zip,.png,.jpg,.jpeg,.pdf" onChange={e => { const chosen = Array.from(e.target.files ?? []); if (chosen.some(f => f.size > 10 * 1024 * 1024)) { setError("Each evidence file must be 10 MB or smaller."); e.target.value = ""; setFiles([]); } else { setFiles(chosen); setError(""); } }}/></label> : null}
          {files.length ? <ul className="pending-files" aria-label="Files to upload when you save">{files.map((file, i) => <li key={`${file.name}-${i}`}><Icon name="file" size={15}/>{file.name}<span className="tabular">{humanSize(file.size)}</span><em>Uploads on save</em></li>)}</ul> : null}
        </section>
      </div>
      <aside className="editor-aside">
        <section className="panel form-stack" aria-labelledby="ed-details">
          <h2 id="ed-details">Details</h2>
          <label className="field">Category<select value={form.category} onChange={e => field("category", e.target.value as Category)} disabled={!editable}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Difficulty<select value={form.difficulty} onChange={e => field("difficulty", e.target.value as Level)} disabled={!editable}>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}</select></label>
          <div className="form-columns"><label className="field">Practice XP<input type="number" value={form.xp} onChange={e => field("xp", Number(e.target.value))} min={0} max={1000} required readOnly={!editable}/></label><label className="field">Minutes<input type="number" value={form.estimatedMinutes} onChange={e => field("estimatedMinutes", Number(e.target.value))} min={1} max={480} required readOnly={!editable}/></label></div>
          <label className="field">Tags<input value={form.tags} onChange={e => field("tags", e.target.value)} readOnly={!editable} placeholder="metadata, linux, decoding"/><span className="field-help">Separate tags with commas.</span></label>
        </section>
        <section className="panel form-stack" aria-labelledby="ed-flag">
          <h2 id="ed-flag">Flag</h2>
          <label className="field">Flag format shown to learners<input className="flag-input" value={form.flagFormat} onChange={e => field("flagFormat", e.target.value)} required readOnly={!editable}/></label>
          {editable ? <label className="field">{currentId === "new" ? "Correct flag" : "Replace the correct flag"}<input className="flag-input" type="password" value={form.flag} onChange={e => field("flag", e.target.value)} required={currentId === "new"} autoComplete="new-password" minLength={8} maxLength={200}/><span className="field-help">{currentId === "new" ? "Stored as a digest on the server. No one can read it back, including you." : "Leave empty to keep the current flag."}</span></label> : <p className="fine-print">The correct flag is stored as a digest on the server.</p>}
        </section>
        <section className="panel form-stack publish-panel" aria-labelledby="ed-publish">
          <h2 id="ed-publish">Publishing</h2>
          {editable ? <>
            <ul className="checklist" aria-label="Ready for review">{checklist.map(item => <li key={item.label} data-done={item.done || undefined}><Icon name={item.done ? "check" : "close"} size={15}/>{item.label}</li>)}</ul>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
            {currentId !== "new" ? <button type="button" className="button button-secondary" onClick={() => transition("review")} disabled={busy || dirty || !detail?.files.length} title={dirty ? "Save your changes first" : !detail?.files.length ? "Attach an evidence file first" : "Send for an independent review"}>Send for review</button> : null}
            {currentId !== "new" && (dirty || !detail?.files.length) ? <p className="fine-print">{dirty ? "Save your changes before sending for review." : "Attach at least one evidence file before sending for review."}</p> : null}
          </> : detail?.status === "review" ? <>
            <p className="muted">Check the brief, evidence, walkthrough, and learning value. Authors can’t approve their own cases.</p>
            {canReview && detail.canPublish !== false ? <>
              <label className="field">Your test-solve flag<input className="flag-input" type="text" value={testFlag} onChange={e => setTestFlag(e.target.value)} placeholder={form.flagFormat} autoComplete="off" spellCheck={false} maxLength={1000}/><span className="field-help">Download the evidence, solve it yourself, and enter the flag you found.</span></label>
              <button type="button" className="button button-primary" onClick={() => transition("publish")} disabled={busy || !testFlag.trim()}>{busy ? "Checking…" : "Verify and publish"}</button>
            </> : <Notice>Waiting for an independent reviewer. Authors can’t publish their own cases.</Notice>}
          </> : detail?.status === "published" ? <>
            <Notice type="success">Live in the practice library.</Notice>
            {role === "admin" ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => { if (window.confirm("Archive this case? Learners will no longer be able to open it.")) void transition("archived"); }}><Icon name="archive" size={16}/>Archive case</button> : null}
          </> : <Notice>{detail?.status === "draft" ? "The author is still writing this draft. Review opens once it’s sent for review." : "This case is archived."}</Notice>}
        </section>
      </aside>
    </form>}
  </>;
}
