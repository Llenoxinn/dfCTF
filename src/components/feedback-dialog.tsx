"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, ApiError, Icon, Modal, Notice, Spinner } from "./ui";
import ValidatedForm from "./validated-form";

const EMPTY = { subject: "", message: "", email: "" };
type Draft = typeof EMPTY;
type Field = keyof Draft;
const FAILED = "We couldn’t send your feedback. Your message is still here, so you can try again.";

function FeedbackDialog({ draft, setDraft, close }: { draft: Draft; setDraft: (update: (draft: Draft) => Draft) => void; close: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [invalid, setInvalid] = useState<Partial<Record<Field, string[]>>>({}), [sent, setSent] = useState<{ email: string } | null>(null);
  const lock = useRef(false), subject = useRef<HTMLInputElement>(null), submit = useRef<HTMLButtonElement>(null);
  useEffect(() => { subject.current?.focus(); }, []);
  useEffect(() => {
    const field = (Object.keys(invalid) as Field[]).find(key => invalid[key]?.length);
    if (field) document.getElementById(`feedback-${field}`)?.focus();
    else if (error) submit.current?.focus();
  }, [error, invalid]);
  function change(field: Field, target: HTMLInputElement | HTMLTextAreaElement) {
    target.setCustomValidity(field !== "email" && target.value && !target.value.trim() ? "Enter more than spaces." : "");
    setDraft(old => ({ ...old, [field]: target.value }));
    setInvalid(old => ({ ...old, [field]: [] }));
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setInvalid({});
    const payload = { subject: draft.subject.trim(), message: draft.message.trim(), email: draft.email.trim() };
    try {
      await api("/api/v1/feedback", { method: "POST", body: JSON.stringify(payload) });
      setSent({ email: payload.email });
      setDraft(() => EMPTY);
    } catch (err) {
      const known = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 404;
      if (err instanceof ApiError) setInvalid(err.fieldErrors);
      setError(known ? err.message : FAILED);
    } finally { lock.current = false; setBusy(false); }
  }
  if (sent) return <Modal labelledBy="feedback-title" onClose={close} className="feedback-modal">
    <div className="modal-bar"><h2 id="feedback-title">Feedback sent</h2><span className="spacer" /><button type="button" className="icon-button" aria-label="Close" onClick={close}><Icon name="close" /></button></div>
    <div className="modal-body stack"><Notice type="success">Thanks. The dfCTF developers received your feedback.{sent.email ? ` If they need to reply, they’ll use ${sent.email}.` : ""}</Notice><div className="cta-row"><button type="button" className="button button-primary" autoFocus onClick={close}>Done</button></div></div>
  </Modal>;
  const help = (field: Field, text: string) => <small id={`feedback-${field}-help`} className={invalid[field]?.length ? "danger" : "muted"}>{invalid[field]?.join(" ") || text}</small>;
  const described = (field: Field) => ({ id: `feedback-${field}`, value: draft[field], readOnly: busy, "aria-invalid": invalid[field]?.length ? true : undefined, "aria-describedby": `feedback-${field}-help` });
  return <Modal labelledBy="feedback-title" onClose={close} dismissible={!busy} className="feedback-modal">
    <div className="modal-bar"><h2 id="feedback-title">Send feedback</h2><span className="spacer" /><button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={close}><Icon name="close" /></button></div>
    <div className="modal-body stack">
      <p className="muted">Tell the dfCTF developers what’s working and what isn’t. You don’t need a GitHub account. Leave out passwords, flags and other private details.</p>
      {error ? <Notice type="error">{error} You can also reach us through <Link className="link-button" href="/support" onClick={close}>Help / Contact</Link>.</Notice> : null}
      <ValidatedForm className="stack" onSubmit={send}>
        <label className="field"><span>Subject</span><input {...described("subject")} ref={subject} type="text" required maxLength={120} onChange={e => change("subject", e.target)} />{help("subject", `${draft.subject.length} / 120 characters`)}</label>
        <label className="field"><span>Feedback message</span><textarea {...described("message")} rows={6} required maxLength={5000} onChange={e => change("message", e.target)} />{help("message", `${draft.message.length} / 5000 characters`)}</label>
        <label className="field"><span>Contact email<small className="muted"> — optional</small></span><input {...described("email")} type="email" maxLength={254} autoComplete="email" onChange={e => change("email", e.target)} />{help("email", "Only if you’d like a reply.")}</label>
        <div className="cta-row"><button ref={submit} type="submit" className="button button-primary" disabled={busy}>{busy ? <Spinner /> : null}{busy ? "Sending feedback" : "Submit feedback"}</button><button type="button" className="button button-secondary" disabled={busy} onClick={close}>Cancel</button></div>
      </ValidatedForm>
    </div>
  </Modal>;
}

/** The footer's Send feedback action. An unsent draft survives closing the dialog, so a stray Escape loses nothing. */
export default function SendFeedback({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(EMPTY);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>Send feedback</button>
    {open ? <FeedbackDialog draft={draft} setDraft={setDraft} close={() => setOpen(false)} /> : null}
  </>;
}
