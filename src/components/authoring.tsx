"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import type { Bootstrap, Category, ChallengeDetail, ChallengeStatus, ChallengeSummary, Difficulty as Level } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { api, ApiError, Difficulty, Empty, formatDate, humanSize, Icon, Identicon, Loading, Notice, Pips } from "./ui";
import DescriptionEditor from "./description-editor";
import { MAX_ARTIFACT_BYTES, ARTIFACT_SIZE_LABEL } from "@/lib/artifacts";
import { canEditChallengeContent } from "@/lib/challenge-permissions";
import { challengeContentInput } from "@/lib/challenge-validation";

type EditorData = {
  title: string; category: Category; difficulty: Level; description: string;
  solution: string; flag: string; flagFormat: string; tags: string; xp: number | ""; estimatedMinutes: number | "";
  visibility: "practice" | "competition";
};
const blank: EditorData = { title: "", category: "General skills", difficulty: "Easy", description: "", solution: "", flag: "", flagFormat: "dfCTF{...}", tags: "", xp: 100, estimatedMinutes: 20, visibility: "practice" };
const FIELD_LABELS: Record<keyof EditorData, string> = {
  title: "Title", description: "Description", solution: "Walkthrough", visibility: "Availability",
  category: "Category", difficulty: "Difficulty", xp: "Points", estimatedMinutes: "Minutes",
  tags: "Tags", flagFormat: "Format shown to players", flag: "Correct flag",
};
type FieldErrors = Partial<Record<keyof EditorData, string[]>>;
type StaffDetail = ChallengeDetail & { authorId?: string; canPublish?: boolean };
const STATUS_LABEL: Record<ChallengeStatus, string> = { draft: "Draft", review: "In review", published: "Live", archived: "Archived" };
const STATUS_HINT: Record<ChallengeStatus | "", string> = {
  "": "Drafts need a description, a walkthrough, and a flag; files are optional. A different staff member test-solves each one before it goes live.",
  draft: "Still being written. Save it, then send it for review when the checklist is done.",
  review: "Waiting for someone other than the author to solve it. Their correct flag publishes it.",
  published: "On the board. Administrator edits require a fresh independent review before going live again.",
  archived: "Taken off the board. Players can no longer open these.",
};

/** A small square plus the status word: color is never the only cue. */
function StatusBadge({ status }: { status: ChallengeStatus }) { return <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>; }
function updated(value?: string) {
  if (!value) return "";
  const d = new Date(value), today = new Date(), yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return d.toDateString() === yesterday.toDateString() ? "Yesterday" : formatDate(value);
}

function ChallengeActions({ title, edit }: { title: string; edit: () => void }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null);
  return <span className="challenge-actions">
    <button ref={trigger} type="button" className="challenge-actions-trigger" aria-label={`Actions for ${title}`} popoverTarget={id}><Icon name="more" size={20} /></button>
    <div id={id} popover="auto" className="challenge-actions-menu" onToggle={event => {
      if (event.newState !== "open" || !trigger.current) return;
      const rect = trigger.current.getBoundingClientRect(), menu = event.currentTarget;
      menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
      menu.style.top = `${rect.bottom + menu.offsetHeight + 8 > window.innerHeight ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4}px`;
    }}><button type="button" onClick={edit}>Edit</button></div>
  </span>;
}

export default function Authoring({ bootstrap, goSettings, registerLeaveGuard }: { bootstrap: Bootstrap; goSettings: () => void; registerLeaveGuard: (guard: (() => boolean) | null) => void }) {
  const [items, setItems] = useState<ChallengeSummary[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<string | null>(null); const [filter, setFilter] = useState<ChallengeStatus | "">("");
  const load = useCallback(async () => { setBusy(true); try { setItems(await api("/api/v1/staff/challenges")); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not load the authoring workspace."); } finally { setBusy(false); } }, []);
  useEffect(() => { if (bootstrap.staffVerified) void load(); }, [bootstrap.staffVerified, load]);
  const canCreate = bootstrap.user?.role === "author" || bootstrap.user?.role === "admin";
  async function addRules() {
    setBusy(true); setError("");
    try { const draft = await api<{ id: string }>("/api/v1/staff/challenges/rules", { method: "POST" }); setSelected(draft.id); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create the rules challenge."); }
    finally { setBusy(false); }
  }

  if (!bootstrap.staffVerified) return <>
    <div className="page-head"><div><h1>Authoring</h1><p>Write challenges, review other people’s, and publish them to the board.</p></div></div>
    <div className="panel staff-gate"><span className="mono accent">[locked]</span><div><h2>Verify this session first</h2><p className="muted">Staff tools need an authenticator app and a verification in the current session. It takes about a minute the first time.</p><button className="button button-primary" onClick={goSettings}>Go to staff verification</button></div></div>
  </>;
  if (selected !== null) return <ChallengeEditor id={selected} role={bootstrap.user!.role} viewerId={bootstrap.user!.id} registerLeaveGuard={registerLeaveGuard} close={() => { setSelected(null); void load(); }} />;

  const shown = filter ? items.filter(i => i.status === filter) : items;
  const n = (s: ChallengeStatus) => items.filter(i => i.status === s).length;
  return <>
    <div className="page-head"><div><h1>Authoring</h1><p>Write challenges, review other people’s, and publish them to the board.</p></div>{canCreate ? <div className="head-actions"><button className="button button-secondary" onClick={addRules} disabled={busy}>Rules challenge</button><button className="button button-primary" onClick={() => setSelected("new")} disabled={busy}><Icon name="plus" size={16} />New challenge</button></div> : null}</div>
    {error ? <Notice type="error">{error}</Notice> : null}
    {busy ? <Loading label="Loading challenges" backdrop /> : items.length ? <>
      <div className="filter-tabs" role="group" aria-label="Show challenges by status">
        {(["", ...Object.keys(STATUS_LABEL)] as (ChallengeStatus | "")[]).map(status => <button type="button" key={status || "all"} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status ? STATUS_LABEL[status] : "All"}<span className="count">{status ? n(status) : items.length}</span></button>)}
      </div>
      <p className="fine status-hint">{STATUS_HINT[filter]}</p>
      {shown.length ? <div className="table authoring" role="table" aria-label="Challenges you can author or review">
        <div className="tr th" role="row"><span role="columnheader">Challenge</span><span role="columnheader">Category</span><span role="columnheader">Level</span><span role="columnheader">Points</span><span role="columnheader">Author</span><span role="columnheader">Updated</span><span role="columnheader">Status</span></div>
        {shown.map(item => <div key={item.id} className="tr" role="row">
          <span role="cell" className="td-title"><button type="button" className="row-link" onClick={() => setSelected(item.id)}><strong>{item.title}</strong></button><span>{item.summary}</span></span>
          <span role="cell" className="muted">{item.category}</span><span role="cell"><Difficulty value={item.difficulty} /></span>
          <span role="cell" className="mono strong">{item.xp}</span>
          <span role="cell" className="author">{item.author ? <><Identicon name={item.author} size={22} /><span className="mono">{item.author}</span></> : null}</span>
          <span role="cell" className="muted">{updated(item.updatedAt)}</span><span role="cell" className="challenge-status-cell"><StatusBadge status={item.status} />{bootstrap.user?.role === "admin" ? <ChallengeActions title={item.title} edit={() => setSelected(item.id)} /> : null}</span>
        </div>)}
      </div> : <Empty title={`No ${STATUS_LABEL[filter as ChallengeStatus].toLowerCase()} challenges`}>{STATUS_HINT[filter]}</Empty>}
    </> : <Empty title="No challenges yet" action={canCreate ? <button className="button button-primary" onClick={() => setSelected("new")}><Icon name="plus" size={16} />New challenge</button> : undefined}>{canCreate ? "Create a draft, attach the files, and send it for review." : "Challenges submitted for review will appear here."}</Empty>}
  </>;
}

function ChallengeEditor({ id, role, viewerId, close, registerLeaveGuard }: { id: string; role: string; viewerId: string; close: () => void; registerLeaveGuard: (guard: (() => boolean) | null) => void }) {
  const [currentId, setCurrentId] = useState(id);
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [form, setForm] = useState<EditorData>(blank);
  const [loading, setLoading] = useState(id !== "new"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [testFlag, setTestFlag] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusTarget, setFocusTarget] = useState<keyof EditorData | null>(null);
  const [descriptionFocus, setDescriptionFocus] = useState(0);
  const read = useCallback(async (challengeId: string) => {
    const data = await api<StaffDetail>(`/api/v1/staff/challenges/${encodeURIComponent(challengeId)}`);
    setDetail(data); setForm({ title: data.title, category: data.category, difficulty: data.difficulty, description: data.description, solution: data.solution ?? "", flag: "", flagFormat: data.flagFormat, tags: data.tags.join(", "), xp: data.xp, estimatedMinutes: data.estimatedMinutes, visibility: data.visibility ?? "practice" });
  }, []);
  useEffect(() => { if (id === "new") return; read(id).catch(err => setError(err.message)).finally(() => setLoading(false)); }, [id, read]);
  const editable = detail ? canEditChallengeContent({ id: viewerId, role }, detail) : role === "admin" || role === "author";
  const editingDraft = editable && (!detail || detail.status === "draft");
  const canReview = role === "reviewer" || role === "admin";
  const canWithdraw = detail?.status === "review" && (role === "admin" || role === "author" && detail.authorId === viewerId);
  const dirty = files.length > 0 || (detail ? !!form.flag || form.title !== detail.title || form.description !== detail.description || form.solution !== (detail.solution ?? "") || form.category !== detail.category || form.difficulty !== detail.difficulty || form.xp !== detail.xp || form.estimatedMinutes !== detail.estimatedMinutes || form.flagFormat !== detail.flagFormat || form.tags !== detail.tags.join(", ") || form.visibility !== (detail.visibility ?? "practice") : Object.entries(blank).some(([key, value]) => form[key as keyof EditorData] !== value));
  const confirmLeave = useCallback(() => !busy && (!editable || !dirty || window.confirm("Discard unsaved changes? Your draft edits will be lost.")), [busy, editable, dirty]);
  useEffect(() => { registerLeaveGuard(confirmLeave); return () => registerLeaveGuard(null); }, [confirmLeave, registerLeaveGuard]);
  useEffect(() => {
    if (!editable || loading || (!dirty && !busy)) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editable, loading, dirty, busy]);
  useEffect(() => {
    if (busy || !focusTarget) return;
    if (focusTarget === "description") setDescriptionFocus(count => count + 1);
    else {
      const input = document.getElementById(`challenge-${focusTarget}`);
      input?.focus(); input?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setFocusTarget(null);
  }, [busy, focusTarget]);
  function field<K extends keyof EditorData>(key: K, value: EditorData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setFieldErrors(errors => { const next = { ...errors }; delete next[key]; return next; });
  }
  function showValidation(errors: Record<string, string[] | undefined>) {
    const known = Object.fromEntries(Object.keys(FIELD_LABELS).filter(key => errors[key]?.length).map(key => [key, errors[key]])) as FieldErrors;
    setFieldErrors(known);
    setFocusTarget(Object.keys(known)[0] as keyof EditorData ?? null);
    return Object.keys(known).length > 0;
  }
  function inputProps(key: keyof EditorData) {
    return { id: `challenge-${key}`, name: key, "aria-invalid": fieldErrors[key]?.length ? true : undefined, "aria-describedby": fieldErrors[key]?.length ? `challenge-${key}-error` : undefined };
  }
  function fieldError(key: keyof EditorData) {
    return fieldErrors[key]?.length ? <small className="field-error" id={`challenge-${key}-error`}>{fieldErrors[key]!.join(" ")}</small> : null;
  }

  async function removeFile(file: StaffDetail["files"][number]) {
    if (busy || !editable || !window.confirm(`Remove ${file.name} from this ${editingDraft ? "draft" : "challenge"}?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/v1/staff/challenges/${encodeURIComponent(currentId)}/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
      // File-only edits can also create a revision; refresh its status, permissions, and copied file IDs.
      const refreshed = await api<StaffDetail>(`/api/v1/staff/challenges/${encodeURIComponent(currentId)}`);
      setDetail(refreshed);
      setTestFlag("");
      setMessage(`${file.name} removed from this ${editingDraft ? "draft" : "challenge"}.${role === "admin" && refreshed.status === "review" ? " An independent reviewer must recheck the changes before publishing." : ""}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove this file."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !editable) return; setError(""); setMessage(""); setFieldErrors({});
    const payload = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), ...(currentId !== "new" && !form.flag ? { flag: undefined } : {}) };
    const validation = (currentId === "new" ? challengeContentInput : challengeContentInput.partial()).safeParse(payload);
    if (!validation.success) { showValidation(validation.error.flatten().fieldErrors); return; }
    setBusy(true);
    let savedId = currentId, saved = false, uploaded = 0;
    try {
      const result = await api<{ id: string }>(currentId === "new" ? "/api/v1/staff/challenges" : `/api/v1/staff/challenges/${encodeURIComponent(currentId)}`, { method: currentId === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      savedId = currentId === "new" ? result.id : currentId; saved = true; setCurrentId(savedId);
      for (const file of files) { const body = new FormData(); body.append("file", file); await api(`/api/v1/staff/challenges/${encodeURIComponent(savedId)}/files`, { method: "POST", body }); uploaded++; }
      setTestFlag("");
      setMessage(role === "admin" && detail && detail.status !== "draft" ? "Changes saved and awaiting independent review. Another reviewer must test-solve and approve them before publishing." : detail?.status === "review" ? "Review changes saved. Test-solve the updated challenge before publishing." : "Draft saved. Check the description and files, then send it for review.");
    } catch (err) {
      if (!(err instanceof ApiError && !saved && showValidation(err.fieldErrors))) setError(err instanceof Error ? err.message : "Could not save this draft.");
    }
    finally {
      // Drop the files that landed so a retry never uploads them twice; re-read only after the draft saved, so failed edits stay in the form.
      setFiles(files.slice(uploaded));
      if (saved) await read(savedId).catch(() => undefined);
      setBusy(false);
    }
  }
  async function transition(status: "draft" | "review" | "archived" | "publish") {
    if (busy || dirty) return; setBusy(true); setError(""); setMessage("");
    try { await api(`/api/v1/staff/challenges/${encodeURIComponent(currentId)}${status === "publish" ? "/publish" : ""}`, { method: status === "publish" ? "POST" : "PATCH", body: status === "publish" ? JSON.stringify({ flag: testFlag }) : JSON.stringify({ status }) }); await read(currentId); setTestFlag(""); setMessage(status === "publish" ? "Published. The challenge is now on the board." : status === "review" ? "Sent for review. A reviewer other than the author can publish it." : status === "draft" ? "Returned to draft. Make your corrections, save, and send it for review again." : "Archived. The challenge is no longer on the board."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the status."); } finally { setBusy(false); }
  }

  if (!loading && id !== "new" && !detail) return <>
    <button className="text-button back-link" onClick={close}><Icon name="back" size={16} />Back to authoring</button>
    <div className="page-head"><h1>Could not open this challenge</h1></div>
    <Notice type="error">{error || "Return to authoring and try opening the challenge again."}</Notice>
  </>;

  const checklist = [
    { done: form.title.trim().length >= 3, label: "Title" },
    { done: form.description.trim().length >= 20, label: "Description" },
    { done: form.solution.trim().length >= 20, label: "Walkthrough" },
    { done: currentId !== "new" || form.flag.length >= 8, label: "Flag" },
    { done: !!detail && !dirty, label: "Saved after your last edit" },
  ];

  return <>
    <button className="text-button back-link" onClick={() => { if (confirmLeave()) close(); }} disabled={busy}><Icon name="back" size={16} />Back to authoring</button>
    <div className="page-head">
      <div><div className="title-row"><h1>{currentId === "new" ? "New challenge" : form.title || "Untitled challenge"}</h1><StatusBadge status={detail?.status ?? "draft"} /></div><p className="muted">{editable ? "A clear description, purposeful files, and a satisfying discovery." : "Read the challenge, solve it yourself, and use the publishing controls."}</p></div>
      {editable && !loading ? <div className="head-actions"><span className="fine">{busy ? "Saving" : detail && !dirty ? "All changes saved" : currentId === "new" ? "Not saved yet" : "Unsaved changes"}</span><button type="submit" form="challenge-editor" className="button button-secondary" disabled={busy}>{editingDraft ? "Save draft" : "Save changes"}</button>{editingDraft && currentId !== "new" ? <button type="button" className="button button-primary" onClick={() => transition("review")} disabled={busy || dirty} title={dirty ? "Save your changes first" : "Send for an independent review"}>Send for review</button> : null}</div> : null}
    </div>
    {error ? <Notice type="error">{error}</Notice> : null}{message ? <Notice type="success">{message}</Notice> : null}
    {role === "admin" && (detail?.status === "published" || detail?.status === "archived") ? <Notice>Saving edits or removing a file sends this challenge back to review and takes it off the board until another reviewer approves it.</Notice> : null}
    {Object.keys(fieldErrors).length ? <Notice type="error"><strong>Check these fields before saving:</strong><ul className="validation-summary">
      {(Object.keys(fieldErrors) as (keyof EditorData)[]).map(key => <li key={key}><button type="button" className="text-button" onClick={() => setFocusTarget(key)}>{FIELD_LABELS[key]}: {fieldErrors[key]!.join(" ")}</button></li>)}
    </ul></Notice> : null}
    {loading ? <Loading label="Opening the editor" /> : <form id="challenge-editor" onSubmit={save} className="editor" noValidate>
      <div className="editor-main">
        <section className="panel"><div className="panel-head"><h2>The challenge</h2></div><div className="panel-pad stack">
          <label className="field"><span className="label-row">Title<small className="mono">{form.title.length}/80</small></span><input {...inputProps("title")} value={form.title} onChange={e => field("title", e.target.value)} required minLength={3} maxLength={80} readOnly={!editable || busy} placeholder="Night shift" />{fieldError("title")}</label>
          <DescriptionEditor inputId="challenge-description" value={form.description} onChange={value => field("description", value)} readOnly={!editable || busy} validationError={fieldErrors.description?.join(" ")} focusRequest={descriptionFocus} />
          <label className="field"><span>Walkthrough</span><textarea {...inputProps("solution")} rows={8} value={form.solution} onChange={e => field("solution", e.target.value)} required minLength={20} maxLength={50000} readOnly={!editable || busy} placeholder="The intended approach, and the lesson to take away." />{fieldError("solution")}<small>Players see this only after they solve the challenge.</small></label>
        </div></section>
        <section className="panel"><div className="panel-head"><h2>Files</h2><span className="spacer" /><span className="mono muted">{(detail?.files.length ?? 0) + files.length} {((detail?.files.length ?? 0) + files.length) === 1 ? "file" : "files"}</span></div><div className="panel-pad stack">
          {detail?.files.length ? <ul className="files">{detail.files.map(file => <li key={file.id}><div className="file-info"><span className="mono strong">{file.name}</span><span className="mono faint">{humanSize(file.size)}</span>{file.sha256 ? <span className="checksum mono">sha256 <code>{file.sha256}</code></span> : null}</div><a className="button button-secondary" href={`/api/v1/staff/challenges/${encodeURIComponent(currentId)}/files/${encodeURIComponent(file.id)}`} download><Icon name="download" size={16} />Download</a>{editable ? <button className="button button-secondary" type="button" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => void removeFile(file)}>Remove</button> : null}</li>)}</ul> : null}
          {editable ? <label className="dropzone"><strong>Drop files here, or browse</strong><span className="muted">TXT, CSV, JSON, LOG, PCAP, ZIP, PNG, JPG, or PDF. Up to {ARTIFACT_SIZE_LABEL} each. Files are never opened or run by the server.</span><input type="file" disabled={busy} multiple accept=".txt,.csv,.json,.log,.pcap,.zip,.png,.jpg,.jpeg,.pdf" onChange={e => { const chosen = Array.from(e.target.files ?? []); if (chosen.some(f => f.size > MAX_ARTIFACT_BYTES)) { setError(`Each file must be ${ARTIFACT_SIZE_LABEL} or smaller.`); setFiles([]); } else { setFiles(chosen); setError(""); } e.target.value = ""; }} /></label> : null}
          {files.length ? <ul className="pending" aria-label="Files to upload when you save">{files.map((file, i) => <li key={`${file.name}-${i}`}><span className="mono">{file.name}</span><span className="mono faint">{humanSize(file.size)}</span><em className="muted">uploads on save</em><button className="text-button" type="button" aria-label={`Remove pending ${file.name}`} disabled={busy} onClick={() => setFiles(current => current.filter((_, index) => index !== i))}>Remove</button></li>)}</ul> : null}
        </div></section>
      </div>
      <aside className="editor-side">
        <section className="panel"><div className="panel-head"><h2>Details</h2></div><div className="panel-pad stack">
          <label className="field"><span>Availability</span><select {...inputProps("visibility")} value={form.visibility} onChange={e => field("visibility", e.target.value as EditorData["visibility"])} disabled={!editable || busy}><option value="practice">Practice library</option><option value="competition">Competition only</option></select>{fieldError("visibility")}<small>Competition-only challenges stay out of practice. After independent review, an admin can add them to one event.</small></label>
          <label className="field"><span>Category</span><select {...inputProps("category")} value={form.category} onChange={e => field("category", e.target.value as Category)} disabled={!editable || busy}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>{fieldError("category")}</label>
          <div className="field"><span>Difficulty</span><div {...inputProps("difficulty")} className="segmented block" role="group" tabIndex={-1} aria-label="Difficulty">{DIFFICULTIES.map(d => <button key={d} type="button" aria-pressed={form.difficulty === d} disabled={!editable || busy} onClick={() => field("difficulty", d)}><Pips value={d} />{d}</button>)}</div>{fieldError("difficulty")}</div>
          <div className="two"><label className="field"><span>Points</span><input {...inputProps("xp")} className="mono" type="number" value={form.xp} onChange={e => field("xp", e.target.value === "" ? "" : Number(e.target.value))} min={0} max={1000} required readOnly={!editable || busy} />{fieldError("xp")}</label><label className="field"><span>Minutes</span><input {...inputProps("estimatedMinutes")} className="mono" type="number" value={form.estimatedMinutes} onChange={e => field("estimatedMinutes", e.target.value === "" ? "" : Number(e.target.value))} min={1} max={480} required readOnly={!editable || busy} />{fieldError("estimatedMinutes")}</label></div>
          <label className="field"><span>Tags</span><input {...inputProps("tags")} value={form.tags} onChange={e => field("tags", e.target.value)} readOnly={!editable || busy} placeholder="disk image, deleted files, weekly" />{fieldError("tags")}<small>Separate tags with commas. Add <code>weekly</code> to feature it during the week it is published (Monday to Sunday, Philippine time).</small></label>
        </div></section>
        <section className="panel"><div className="panel-head"><h2>Flag</h2></div><div className="panel-pad stack">
          <label className="field"><span>Format shown to players</span><input {...inputProps("flagFormat")} className="mono" value={form.flagFormat} onChange={e => field("flagFormat", e.target.value)} required minLength={3} maxLength={100} readOnly={!editable || busy} />{fieldError("flagFormat")}</label>
          {editable ? <label className="field"><span>{currentId === "new" ? "Correct flag" : "Replace the correct flag"}</span><input {...inputProps("flag")} className="mono" type="password" disabled={busy} value={form.flag} onChange={e => field("flag", e.target.value)} required={currentId === "new"} autoComplete="new-password" minLength={8} maxLength={200} placeholder="dfCTF{...}" />{fieldError("flag")}<small>{currentId === "new" ? "Stored as a keyed digest. No one can read it back, including you." : "Leave empty to keep the current flag."}</small></label> : <p className="fine">The correct flag is stored as a keyed digest on the server.</p>}
        </div></section>
        <section className="panel"><div className="panel-head"><h2>{editingDraft ? "Ready for review" : "Publishing"}</h2>{editingDraft ? <><span className="spacer" /><span className="mono muted">{checklist.filter(c => c.done).length} of {checklist.length}</span></> : null}</div><div className="panel-pad stack">
          {editingDraft ? <>
            <ul className="checklist" aria-label="Ready for review">{checklist.map(item => <li key={item.label} data-done={item.done || undefined}><span className="mono">{item.done ? "[x]" : "[ ]"}</span>{item.label}</li>)}</ul>
            <p className="fine">{currentId === "new" ? "Save the draft first, then attach any files it needs and send it for review." : dirty ? "Save your changes before sending for review." : "Ready. A reviewer other than you will solve it before it goes live."}</p>
          </> : detail?.status === "review" ? <>
            <p className="muted">Check the description, files, walkthrough, and learning value. Authors can’t approve their own challenges.</p>
            {canReview && detail.canPublish !== false ? <>
              {dirty ? <Notice>Save your changes before test-solving and publishing.</Notice> : null}
              <label className="field"><span>Your test-solve flag</span><input className="mono" type="text" disabled={busy || dirty} value={testFlag} onChange={e => setTestFlag(e.target.value)} placeholder={form.flagFormat} autoComplete="off" spellCheck={false} maxLength={1000} /><small>Solve it yourself, using its files if it has any, and enter the flag you found.</small></label>
              <button type="button" className="button button-primary" onClick={() => transition("publish")} disabled={busy || dirty || !testFlag.trim()}>{busy ? "Checking" : "Verify and publish"}</button>
            </> : <Notice>Waiting for an independent reviewer. Authors and administrators who edited this version can’t approve it.</Notice>}
            {canWithdraw ? <button type="button" className="button button-secondary" disabled={busy || dirty} onClick={() => transition("draft")}>Return to draft</button> : null}
          </> : detail?.status === "published" ? <>
            <Notice type="success">{detail.visibility === "competition" ? "Reviewed and ready for a competition. Hidden from the practice library." : "Live on the board."}</Notice>
            {role === "admin" ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => { if (window.confirm("Archive this challenge? Players will no longer be able to open it.")) void transition("archived"); }}><Icon name="archive" size={16} />Archive challenge</button> : null}
          </> : <Notice>{detail?.status === "draft" ? "The author is still writing this draft. Review opens once it’s sent for review." : "This challenge is archived."}</Notice>}
        </div></section>
      </aside>
    </form>}
  </>;
}
