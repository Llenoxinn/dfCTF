"use client";

import ValidatedForm from "./validated-form";

import Link from "next/link";
import { useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode } from "react";
import type { Bootstrap,ChallengeSummary,Competition,CompetitionDetail } from "@/lib/types";
import { playerHref } from "@/lib/socials";
import { ChallengeCard } from "./cards";
import { api,Empty,Icon,Loading,Notice } from "./ui";

const dateTime=(value:string)=>new Date(value).toLocaleString("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
const href=(id="",challenge="")=>`/?${new URLSearchParams({view:"competitions",...(id?{competition:id}:{}),...(challenge?{challenge}:{})})}`;
const phaseName={upcoming:"Upcoming",live:"Live",ended:"Ended"};
export type CompetitionRoute={eventId:string;challengeId:string};

export default function Competitions({bootstrap,goSettings,renderChallenge,route,open,openPlayer}:{bootstrap:Bootstrap;goSettings:()=>void;renderChallenge:(eventId:string,id:string,back:()=>void,onSolved:()=>Promise<void>)=>ReactNode;route:CompetitionRoute;open:(id?:string,challenge?:string)=>void;openPlayer:(codename:string)=>void}){
  const [items,setItems]=useState<Competition[]>([]);const {eventId:selected,challengeId:challenge}=route;
  const [detail,setDetail]=useState<CompetitionDetail|null>(null),[editor,setEditor]=useState<string|null>(null),[manage,setManage]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const host=bootstrap.user?.role==="admin",canManage=host&&bootstrap.staffVerified;
  const base=manage&&canManage?"/api/v1/staff/competitions":"/api/v1/competitions";
  const requestVersion=useRef(0),currentLocation=useRef("");currentLocation.current=`${base}/${selected}`;
  const load=useCallback(async()=>{
    const locationKey=`${base}/${selected}`;if(currentLocation.current!==locationKey)return;const version=++requestVersion.current;
    try{const data=selected?await api<CompetitionDetail>(`${base}/${encodeURIComponent(selected)}`):await api<Competition[]>(base);if(version!==requestVersion.current||currentLocation.current!==locationKey)return;if(selected)setDetail(data as CompetitionDetail);else setItems(data as Competition[]);setError("");}
    catch(err){if(version===requestVersion.current&&currentLocation.current===locationKey)setError(err instanceof Error?err.message:"Could not load competitions.");}finally{if(version===requestVersion.current&&currentLocation.current===locationKey)setLoading(false);}
  },[base,selected]);
  // Opening or closing a challenge dialog keeps the event page behind it instead of blanking it to a loader.
  useEffect(()=>{setEditor(null);if(detail?.id!==route.eventId){setLoading(true);setDetail(null);}void load();},[load,route]);
  useEffect(()=>{if(!selected)return;const timer=window.setInterval(()=>void load(),30_000);return()=>window.clearInterval(timer);},[selected,load]);
  async function join(){if(!detail)return;setBusy(true);try{await api(`/api/v1/competitions/${encodeURIComponent(detail.id)}/join`,{method:"POST"});await load();}catch(err){setError(err instanceof Error?err.message:"Could not join this competition.");}finally{setBusy(false);}}
  if(editor!==null)return <CompetitionEditor key={editor} id={editor} close={()=>{setEditor(null);void load();}} />;
  return <>
    <div className="page-head"><div><h1>Competitions</h1><p>Scheduled CTF events, hosted here or on a CTFd server.</p></div><div className="head-actions">
      {host&&!canManage?<button className="button button-secondary" onClick={goSettings}>Verify staff session to host</button>:null}
      {canManage?<><button className="button button-secondary" aria-pressed={manage} onClick={()=>{setManage(v=>!v);open();}}>{manage?"Browse published events":"Manage events"}</button>{manage?<button className="button button-primary" onClick={()=>setEditor("new")}>Create competition</button>:null}</>:null}
    </div></div>
    {error?<Notice type="error">{error} <button className="text-button" onClick={load}>Try again</button></Notice>:null}
    {loading?<Loading label="Loading competitions" backdrop/>:selected&&detail?<>
      <button className="text-button back-link" onClick={()=>open()}><Icon name="back" size={16}/>All competitions</button>
      <section className="panel competition-overview" aria-labelledby="event-title"><div className="panel-pad stack">
        <div className="tags"><span className="tag">{detail.platform==="dfctf"?"Built-in dfCTF":"CTFd host"}</span><span className={`tag ${detail.phase==="live"?"tag-accent":""}`}>{phaseName[detail.phase]}</span>{manage?<span className="tag">{detail.status}</span>:null}</div>
        <h2 id="event-title">{detail.title}</h2><p className="competition-description">{detail.description}</p>
        <dl className="kv"><div><dt>Starts (Philippine time)</dt><dd><time dateTime={detail.startsAt}>{dateTime(detail.startsAt)}</time></dd></div><div><dt>Ends (Philippine time)</dt><dd><time dateTime={detail.endsAt}>{dateTime(detail.endsAt)}</time></dd></div></dl>
        {detail.rules?<div className="competition-notes"><h3>Event notes / additional rules</h3><p>{detail.rules}</p></div>:null}
        <p className="fine"><Link href="/rules">Rules / Mechanics</Link> apply to built-in events. Event scores are separate from practice XP.</p>
        {manage?<button className="button button-secondary fit" onClick={()=>setEditor(detail.id)}>{detail.status==="draft"?"Edit and publish":"Event settings"}</button>:null}
        {detail.platform==="ctfd"?<><p className="muted">Registration, challenges, hints, and scores are managed by this event’s CTFd host. Your dfCTF session is not sent to that site.</p><a className="button button-primary fit" href={detail.externalUrl!} target="_blank" rel="noopener noreferrer">Open CTFd event</a></>:detail.status==="published"?<>
          <p className="muted">{detail.participants} registered {detail.participants===1?"player":"players"}. Individual play, fixed points.</p>
          {!detail.registered&&detail.phase!=="ended"?<button className="button button-primary fit" disabled={busy} onClick={join}>{busy?"Joining":"Join competition"}</button>:detail.registered?<span className="accent">You’re registered.</span>:null}
          {detail.phase==="upcoming"?<Notice>Challenges open at the scheduled start. Join now to take part.</Notice>:detail.phase==="ended"?<Notice>This event has ended. New submissions and registrations are closed.</Notice>:null}
        </>:<Notice>This event is {detail.status}. Players can join after it is published.</Notice>}
      </div></section>
      {detail.platform==="dfctf"?<>
        <section aria-labelledby="event-challenges-title"><div className="category-head"><h2 id="event-challenges-title">Event challenges</h2></div>
          {detail.challenges.length?<div className="cards">{detail.challenges.map(c=><ChallengeCard key={c.id} title={c.title} category={c.category} xp={c.xp} difficulty={c.difficulty} solveCount={c.solveCount} state={c.solved?"solved":c.attempted?"progress":"open"} href={detail.registered&&detail.phase!=="upcoming"&&detail.status==="published"?href(detail.id,c.id):undefined} onOpen={e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open(detail.id,c.id);}}/>)}</div>:<p className="muted">{detail.registered?"Challenge details are hidden until the start.":"Join the competition to access its challenges when it starts."}</p>}
        </section>
        <section className="panel" aria-labelledby="event-scoreboard-title"><div className="panel-head"><h2 id="event-scoreboard-title">Competition scoreboard</h2><span className="spacer"/><button className="text-button" onClick={load}>Refresh scoreboard</button></div>
          <p className="fine panel-pad">Fixed points per challenge. Ties go to whoever reached the score first. The top 50 players are shown.</p>
          {detail.standings.length?<div className="competition-score-wrap"><table className="competition-scoreboard"><thead><tr><th>Rank</th><th>Player</th><th>Solves</th><th>Points</th></tr></thead><tbody>{detail.standings.map(s=><tr key={s.codename}><td className="mono">{s.rank}</td><td className="mono"><a href={playerHref(s.codename)} className="player-profile-link" aria-label={`View ${s.codename}'s profile`} onClick={event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();openPlayer(s.codename);}}>{s.codename}{s.codename===bootstrap.user?.codename?" (you)":""}</a></td><td className="mono">{s.solves}</td><td className="mono accent">{s.points}</td></tr>)}</tbody></table></div>:<p className="muted panel-pad">No competition solves yet.</p>}
        </section>
      </>:null}
    </>:!selected?<>{manage?<Notice>Create a draft, choose its host and schedule, then publish. Prepare competition-only challenges in Authoring and send them through independent review first.</Notice>:null}
      {items.length?<ul className="competition-list">{items.map(event=><li key={event.id}><div><div className="tags"><span className="tag">{event.platform==="dfctf"?"dfCTF":"CTFd"}</span><span className={event.phase==="live"?"accent":"muted"}>{phaseName[event.phase]}{manage?` · ${event.status}`:""}</span></div><h2><a href={href(event.id)} onClick={e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open(event.id);}}>{event.title}</a></h2><p>{event.description}</p><span className="fine">{dateTime(event.startsAt)} – {dateTime(event.endsAt)} · Philippine time</span></div><button className="button button-secondary" onClick={()=>open(event.id)}>View event</button></li>)}</ul>:<Empty title={manage?"No competitions yet":"No competitions published yet"}>{manage?"Create an event with the hosting option that fits your competition.":"Published events will appear here with their schedule and hosting details."}</Empty>}
    </>:null}
    {challenge&&selected?renderChallenge(selected,challenge,()=>open(selected),load):null}
  </>;
}

const localDate=(iso:string)=>new Date(new Date(iso).getTime()+8*3_600_000).toISOString().slice(0,16);
const isoDate=(local:string)=>{const value=new Date(`${local}+08:00`);return Number.isFinite(value.getTime())?value.toISOString():"";};
type EventForm={title:string;description:string;rules:string;platform:"dfctf"|"ctfd";externalUrl:string;startsAt:string;endsAt:string;selections:{challengeId:string;points:number}[]};
function CompetitionEditor({id,close}:{id:string;close:()=>void}){
  const [currentId,setCurrentId]=useState(id),[status,setStatus]=useState<Competition["status"]>("draft"),[choices,setChoices]=useState<ChallengeSummary[]>([]);
  const [form,setForm]=useState<EventForm>(()=>({title:"",description:"",rules:"",platform:"dfctf",externalUrl:"",startsAt:localDate(new Date(Date.now()+86_400_000).toISOString()),endsAt:localDate(new Date(Date.now()+90_000_000).toISOString()),selections:[]}));
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[saved,setSaved]=useState("");
  const payload={...form,externalUrl:form.platform==="ctfd"?form.externalUrl:null,selections:form.platform==="dfctf"?form.selections:[],startsAt:isoDate(form.startsAt),endsAt:isoDate(form.endsAt)};
  const dirty=JSON.stringify(payload)!==saved,locked=status!=="draft";
  useEffect(()=>{let active=true;(async()=>{
    try{const [library,event]=await Promise.all([api<ChallengeSummary[]>("/api/v1/staff/challenges"),id==="new"?Promise.resolve(null):api<CompetitionDetail>(`/api/v1/staff/competitions/${encodeURIComponent(id)}`)]);
      if(!active)return;setChoices(library.filter(c=>c.visibility==="competition"&&c.status==="published"&&(!c.competitionId||c.competitionId===id)));
      if(event){const next:EventForm={title:event.title,description:event.description,rules:event.rules,platform:event.platform,externalUrl:event.externalUrl??"",startsAt:localDate(event.startsAt),endsAt:localDate(event.endsAt),selections:event.selections??[]};setForm(next);setStatus(event.status);setSaved(JSON.stringify({...next,externalUrl:event.externalUrl,startsAt:new Date(`${next.startsAt}+08:00`).toISOString(),endsAt:new Date(`${next.endsAt}+08:00`).toISOString()}));}
    }catch(err){if(active)setError(err instanceof Error?err.message:"Could not open event settings.");}finally{if(active)setLoading(false);}
  })();return()=>{active=false;};},[id]);
  function field<K extends keyof EventForm>(key:K,value:EventForm[K]){setForm(old=>({...old,[key]:value}));}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{const result=await api<{id:string}>(currentId==="new"?"/api/v1/staff/competitions":`/api/v1/staff/competitions/${encodeURIComponent(currentId)}`,{method:currentId==="new"?"POST":"PATCH",body:JSON.stringify(payload)});setCurrentId(result.id);setSaved(JSON.stringify(payload));setMessage("Draft saved. Review the schedule and settings, then publish.");}catch(err){setError(err instanceof Error?err.message:"Could not save this event.");}finally{setBusy(false);}}
  async function transition(next:"published"|"archived"){if(next==="archived"&&!confirm("Archive this event? Players will no longer be able to access it."))return;setBusy(true);setError("");try{await api(`/api/v1/staff/competitions/${encodeURIComponent(currentId)}`,{method:"PATCH",body:JSON.stringify({status:next})});setStatus(next);setMessage(next==="published"?"Competition published. The server enforces the schedule.":"Competition archived.");}catch(err){setError(err instanceof Error?err.message:"Could not change event status.");}finally{setBusy(false);}}
  return <><button className="text-button back-link" disabled={busy} onClick={close}><Icon name="back" size={16}/>Back to competitions</button><div className="page-head"><div><h1>{id==="new"?"Create competition":"Competition settings"}</h1><p>Choose a host, set the schedule, and tailor the event.</p></div><span className="tag">{status}</span></div>
    {error?<Notice type="error">{error}</Notice>:null}{message?<Notice type="success">{message}</Notice>:null}
    {loading?<Loading label="Loading event settings"/>:id!=="new"&&!saved?<Empty title="Event settings could not be loaded">Return to the competition list and open this event again.</Empty>:<ValidatedForm onSubmit={save} className="panel"><fieldset className="panel-pad stack competition-fields" disabled={busy||locked}>
      <label className="field"><span>Competition title</span><input required minLength={3} maxLength={100} value={form.title} onChange={e=>field("title",e.target.value)}/></label>
      <label className="field"><span>Description</span><textarea required minLength={20} maxLength={10000} rows={4} value={form.description} onChange={e=>field("description",e.target.value)}/></label>
      <label className="field"><span>Hosting platform</span><select value={form.platform} onChange={e=>field("platform",e.target.value as EventForm["platform"])}><option value="dfctf">Built-in dfCTF</option><option value="ctfd">CTFd host link</option></select><small>{form.platform==="dfctf"?"Players join here. Challenges, submissions, and the event scoreboard stay in dfCTF.":"Open an existing CTFd event. Its host manages accounts, challenges, hints, and scoring."}</small></label>
      {form.platform==="ctfd"?<label className="field"><span>CTFd event URL</span><input type="url" required value={form.externalUrl} maxLength={2000} onChange={e=>field("externalUrl",e.target.value)} placeholder="https://ctf.example.org"/></label>:null}
      <div className="two"><label className="field"><span>Starts (Philippine time)</span><input type="datetime-local" required value={form.startsAt} onChange={e=>field("startsAt",e.target.value)}/></label><label className="field"><span>Ends (Philippine time)</span><input type="datetime-local" required value={form.endsAt} onChange={e=>field("endsAt",e.target.value)}/></label></div>
      <label className="field"><span>Event notes / additional rules</span><textarea rows={4} maxLength={10000} value={form.rules} onChange={e=>field("rules",e.target.value)}/><small>Explain any event-specific instructions. Global dfCTF rules still apply to built-in events.</small></label>
      {form.platform==="dfctf"?<section aria-labelledby="event-selection-title"><h2 id="event-selection-title">Challenges and points</h2><p className="fine">Choose reviewed competition-only challenges. Each challenge can belong to one event, and its event points are fixed at publication.</p>
        {choices.length?<ul className="competition-choices">{choices.map(c=>{const selected=form.selections.find(s=>s.challengeId===c.id);return <li key={c.id}><label><input type="checkbox" checked={!!selected} onChange={e=>field("selections",e.target.checked?[...form.selections,{challengeId:c.id,points:c.xp||100}]:form.selections.filter(s=>s.challengeId!==c.id))}/><span>{c.title}</span></label>{selected?<label className="field"><span>Points for {c.title}</span><input type="number" min={1} max={10000} required value={selected.points} onChange={e=>field("selections",form.selections.map(s=>s.challengeId===c.id?{...s,points:Number(e.target.value)}:s))}/></label>:null}</li>;})}</ul>:<p className="muted">No reviewed competition-only challenges yet. Create them in Authoring, set Availability to Competition only, and request independent review.</p>}
      </section>:null}
      {!locked?<button className="button button-primary fit" type="submit">{busy?"Saving":"Save event draft"}</button>:null}
    </fieldset><div className="panel-pad head-actions">{currentId!=="new"&&status==="draft"?<button className="button button-primary" type="button" disabled={busy||dirty} onClick={()=>transition("published")}>Publish competition</button>:null}{currentId!=="new"&&status!=="archived"?<button className="button button-secondary" type="button" disabled={busy} onClick={()=>transition("archived")}>Archive competition</button>:null}{locked?<p className="fine">Published settings stay locked so the schedule, challenges, and points cannot change during play.</p>:null}</div></ValidatedForm>}
  </>;
}
