"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { feedbackInput, FEEDBACK_FIELDS, FEEDBACK_LABELS, type FeedbackKind } from "@/lib/feedback";
import { api, ApiError, Icon, Modal, Notice, Spinner } from "./ui";
import ValidatedForm from "./validated-form";

export type FeedbackDraft = { id:string|null; fields:Record<string,string> };
export const emptyFeedbackDraft = ():FeedbackDraft => ({id:null,fields:{title:"",contactEmail:""}});

export default function FeedbackDialog({kind,draft,setDraft,close}:{kind:FeedbackKind;draft:FeedbackDraft;setDraft:(update:(draft:FeedbackDraft)=>FeedbackDraft)=>void;close:()=>void}) {
  const heading=useId(),prefix=useId(),submissionId=useRef(draft.id),lock=useRef(false),submitButton=useRef<HTMLButtonElement>(null),titleInput=useRef<HTMLInputElement>(null);
  const fields=draft.fields;
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState("");
  const [invalid,setInvalid]=useState<Record<string,string[]>>({});
  useEffect(()=>{titleInput.current?.focus();},[]);
  useEffect(()=>{if(!busy){const first=Object.keys(invalid).find(key=>invalid[key]?.length);if(first)document.getElementById(`${prefix}-${first}`)?.focus();else if(error)submitButton.current?.focus();}},[invalid,busy,prefix,error]);
  const details=FEEDBACK_FIELDS[kind];
  function change(key:string,value:string){setDraft(current=>({...current,fields:{...current.fields,[key]:value}}));setInvalid(current=>{const next={...current};delete next[key];return next;});}
  async function submit(event:FormEvent) {
    event.preventDefault();if(lock.current)return;
    submissionId.current??=crypto.randomUUID();
    setDraft(current=>({...current,id:submissionId.current}));
    const parsed=feedbackInput.safeParse({id:submissionId.current,kind,title:fields.title,contactEmail:fields.contactEmail,...Object.fromEntries(details.map(([key])=>[key,fields[key]||""]))});
    if(!parsed.success){setInvalid(parsed.error.flatten().fieldErrors as Record<string,string[]>);return;}
    lock.current=true;setBusy(true);setError("");setInvalid({});
    try {
      const result=await api<{accepted:boolean;id:string}>("/api/v1/feedback",{method:"POST",body:JSON.stringify(parsed.data)});
      if(result.accepted!==true || result.id!==submissionId.current)throw new Error("Receipt could not be confirmed. Your text has been kept; please retry.");
      setReceipt(result.id);
      setDraft(emptyFeedbackDraft);
    } catch(err){if(err instanceof ApiError)setInvalid(err.fieldErrors);setError(err instanceof Error?err.message:"Could not send your submission. Your text has been kept; please retry.");}
    finally{lock.current=false;setBusy(false);}
  }
  function control(key:string){return {id:`${prefix}-${key}`,value:fields[key]||"",disabled:busy,onChange:(event:{target:HTMLInputElement|HTMLTextAreaElement})=>{event.target.setCustomValidity(key!=="contactEmail"&&event.target.value&&!event.target.value.trim()?"Enter more than spaces.":"");change(key,event.target.value);},"aria-invalid":invalid[key]?.length?true:undefined,"aria-describedby":invalid[key]?.length?`${prefix}-${key}-error`:undefined};}
  function fieldError(key:string){return invalid[key]?.length?<small className="field-error" id={`${prefix}-${key}-error`}>{invalid[key].join(" ")}</small>:null;}
  return <Modal labelledBy={heading} onClose={close} dismissible={!busy} className="feedback-dialog">
    <div className="modal-bar"><h2 id={heading}>{FEEDBACK_LABELS[kind]}</h2><button className="icon-button" type="button" disabled={busy} onClick={close} aria-label="Close reporting dialog"><Icon name="close"/></button></div>
    <div className="modal-body stack">
      {receipt?<><Notice type="success">Your submission was accepted for delivery to the developers.</Notice><p className="fine">Receipt: {receipt}</p><button className="button button-primary" autoFocus onClick={close}>Done</button></>:<>
        <p className="muted">Send this privately to the dfCTF developers. No GitHub account is needed. Leave out passwords, codes, flags, and private challenge files.</p>
        {error?<Notice type="error">{error} You can also reach us through <Link className="link-button" href="/support" onClick={close}>Help / Contact</Link>.</Notice>:null}
        <ValidatedForm onSubmit={submit} className="stack">
          <label className="field"><span>{kind==="feedback"?"Subject":"Title"}</span><input {...control("title")} ref={titleInput} required minLength={3} maxLength={160}/>{fieldError("title")}</label>
          {details.map(([key,label])=><label className="field" key={key}><span>{label}</span><textarea {...control(key)} required minLength={10} maxLength={6000} rows={4}/>{fieldError(key)}</label>)}
          <label className="field"><span>Contact email <small className="muted">— optional</small></span><input {...control("contactEmail")} type="email" maxLength={254} autoComplete="email"/>{fieldError("contactEmail")}<small>Your email is sent privately to the developers for replies.</small></label>
          <div className="cta-row"><button ref={submitButton} className="button button-primary" type="submit" disabled={busy}>{busy?<Spinner/>:null}{busy?"Sending…":kind==="bug"?"Submit bug report":kind==="feature"?"Submit feature suggestion":"Submit feedback"}</button><button type="button" className="button button-secondary" disabled={busy} onClick={close}>Cancel</button></div>
          <span className="sr-only" role="status">{busy?"Sending your submission. Please wait.":""}</span>
        </ValidatedForm>
      </>}
    </div>
  </Modal>;
}
