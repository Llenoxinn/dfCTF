"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicProfileCard } from "@/lib/player-profile";
import { CARD_ACCENTS, CARD_THEMES, DEFAULT_CARD, cardFilename, parseCardPreferences, renderProfileCard, type CardPreferences } from "@/lib/profile-card";
import { Icon, Notice, Spinner } from "./ui";

export default function ProfileCardStudio({ userId, card, scope, onBusy }: { userId: string; card: PublicProfileCard; scope: string; onBusy: (busy:boolean)=>void }) {
  const [preferences,setPreferences]=useState<CardPreferences>(()=>parseCardPreferences(DEFAULT_CARD));
  const [ready,setReady]=useState(false),[storage,setStorage]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [prepared,setPrepared]=useState<{url:string;filename:string}|null>(null);
  const lock=useRef(false),mounted=useRef(true);
  const key=`dfctf:profile-card:v1:${userId}`;
  useEffect(()=>{
    mounted.current=true;
    try { const saved=localStorage.getItem(key);setPreferences(parseCardPreferences(saved?JSON.parse(saved):null)); }
    catch {setStorage(false);}
    setReady(true);
    return ()=>{mounted.current=false;onBusy(false);};
  },[key]);
  useEffect(()=>{
    if(!ready || !storage)return;
    try {localStorage.setItem(key,JSON.stringify(preferences));}catch{setStorage(false);}
  },[preferences,ready,storage,key]);
  const svg=useMemo(()=>renderProfileCard(card,preferences),[card,preferences]);
  useEffect(()=>{setPrepared(null);},[svg]);
  useEffect(()=>()=>{if(prepared)URL.revokeObjectURL(prepared.url);},[prepared]);
  const source=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  function update(patch:Partial<CardPreferences>){setPreferences(current=>({...current,...patch}));setMessage("");setError("");}
  async function download(){
    if(lock.current || !ready)return;
    lock.current=true;setBusy(true);onBusy(true);setError("");setMessage("Preparing your 2400 × 1350 PNG…");
    const snapshot=svg,filename=cardFilename(card.codename,scope);
    try {
      const exporter=await import("@/lib/profile-card-export");
      const blob=await exporter.profileCardPng(snapshot);
      if(!mounted.current)return;
      setPrepared({url:exporter.downloadCard(blob,filename),filename});setMessage("PNG prepared. Check your browser’s downloads.");
    }catch(err){if(mounted.current){setMessage("");setError(err instanceof Error?err.message:"Could not export the card. Retry the download.");}}
    finally{lock.current=false;if(mounted.current){setBusy(false);onBusy(false);}}
  }
  return <div className="profile-studio-grid">
      <div className="profile-preview-area">
        <figure className="profile-card-preview"><img src={source} width={1200} height={675} alt={`Player card for ${card.codename}, ${card.scope}. Rank ${card.rank===null?"unranked":card.rank}, ${card.points} points, ${card.solved} solves.`} /></figure>
        <p className="fine">Downloads as a 2400 × 1350 PNG in the same design as this preview. Your email, account identifiers, and private challenge details are excluded.</p>
      </div>
      <div className="profile-card-controls">
        <fieldset disabled={busy || !ready} className="profile-control-group"><legend>Card theme</legend><div className="profile-choice-row">{CARD_THEMES.map(theme=><button key={theme} type="button" className="profile-choice" aria-pressed={preferences.theme===theme} onClick={()=>update({theme})}>{theme[0].toUpperCase()+theme.slice(1)}</button>)}</div></fieldset>
        <fieldset disabled={busy || !ready} className="profile-control-group"><legend>Accent</legend><div className="profile-choice-row">{CARD_ACCENTS.map(accent=><button key={accent} type="button" className={`profile-choice profile-accent-${accent}`} aria-pressed={preferences.accent===accent} onClick={()=>update({accent})}><i aria-hidden="true"/>{accent[0].toUpperCase()+accent.slice(1)}</button>)}</div></fieldset>
        <fieldset disabled={busy || !ready} className="profile-control-group"><legend>Include on card</legend>
          <label><input type="checkbox" checked={preferences.showDisplayName} disabled={!card.displayName} onChange={e=>update({showDisplayName:e.target.checked})}/>Display name{!card.displayName?<small> — add one in Edit profile</small>:null}</label>
          <label><input type="checkbox" checked={preferences.showBio} disabled={!card.bio} onChange={e=>update({showBio:e.target.checked})}/>Bio{!card.bio?<small> — optional</small>:null}</label>
          <label><input type="checkbox" checked={preferences.showFirstBloods} onChange={e=>update({showFirstBloods:e.target.checked})}/>First Blood count</label>
        </fieldset>
        <fieldset disabled={busy || !ready} className="profile-control-group"><legend>Milestones <span className="muted">(up to 2)</span></legend>
          {card.milestones.length?card.milestones.map(m=><label key={m.id}><input type="checkbox" checked={preferences.milestones.includes(m.id)} disabled={!preferences.milestones.includes(m.id)&&preferences.milestones.filter(id=>card.milestones.some(m=>m.id===id)).length>=2} onChange={e=>update({milestones:e.target.checked?[...preferences.milestones.filter(id=>card.milestones.some(m=>m.id===id)),m.id]:preferences.milestones.filter(id=>id!==m.id)})}/>{m.label}</label>):<p className="fine">Your first valid solve in this scope unlocks a milestone.</p>}
        </fieldset>
        <p className="fine">{storage?"Card preferences are saved in this browser for this account.":"Browser storage is unavailable. These preferences apply only to this session."}</p>
        <div className="profile-export-actions"><button type="button" className="button button-primary" disabled={busy || !ready} onClick={download}>{busy?<Spinner/>:<Icon name="download" size={17}/>} {busy?"Preparing PNG":"Download PNG"}</button><button type="button" className="text-button" disabled={busy || !ready} onClick={()=>update(parseCardPreferences(DEFAULT_CARD))}>Reset card</button></div>
        <p className="fine" role="status" aria-live="polite">{message}</p>
        {prepared?<p className="fine">If the browser didn’t start the download, <a className="link-button" href={prepared.url} download={prepared.filename}>Save PNG again</a>.</p>:null}
        {error?<Notice type="error">{error} <button type="button" className="text-button" onClick={download}>Retry export</button></Notice>:null}
      </div>
  </div>;
}
