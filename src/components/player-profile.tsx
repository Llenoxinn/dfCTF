"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PlayerProfile, ProfileActivityPage, ProfileIdentity, ProfileScope } from "@/lib/player-profile";
import { api, ApiError, Empty, Icon, Identicon, Loading, Modal, Notice, Spinner } from "./ui";
import ValidatedForm from "./validated-form";
import ProfileCardStudio from "./profile-card-studio";

const date=(at:string)=>new Intl.DateTimeFormat("en",{timeZone:"Asia/Manila",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(at));
function relative(at:string){const days=(Date.now()-new Date(at).getTime())/86400000;return new Intl.RelativeTimeFormat("en",{numeric:"auto"}).format(-Math.max(0,Math.floor(days>=1?days:days*24)),days>=1?"day":"hour");}

function ProfileEditor({ identity, userId, saved, close, expired }: { identity: ProfileIdentity; userId:string; saved:(identity:ProfileIdentity)=>void;close:()=>void;expired:()=>void }) {
  const [fields,setFields]=useState({displayName:identity.displayName,bio:identity.bio,websiteUrl:identity.websiteUrl,githubUrl:identity.githubUrl,shareProfile:identity.shareProfile??false});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[invalid,setInvalid]=useState<Record<string,string[]>>({});
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");setInvalid({});
    try{saved(await api<ProfileIdentity>("/api/v1/profile",{method:"PATCH",headers:{"X-dfCTF-Account":userId},body:JSON.stringify(fields)}));}
    catch(err){if(err instanceof ApiError && (err.status===401||err.status===403)){expired();return;}setError(err instanceof Error?err.message:"Your profile could not be saved. Retry.");if(err instanceof ApiError && err.details && typeof err.details==="object" && "fieldErrors" in err.details){const errors=err.details.fieldErrors as Record<string,string[]>;setInvalid(errors);requestAnimationFrame(()=>document.getElementById(`profile-edit-${Object.keys(errors)[0]}`)?.focus());}}
    finally{setBusy(false);}
  }
  function change(field: "displayName"|"bio"|"websiteUrl"|"githubUrl",value:string){setFields(old=>({...old,[field]:value}));setInvalid(old=>({...old,[field]:[]}));}
  return <Modal labelledBy="profile-edit-title" onClose={close} dismissible={!busy} className="profile-edit-modal">
    <div className="modal-bar"><h2 id="profile-edit-title">Edit profile</h2><button type="button" className="icon-button" aria-label="Cancel profile editing" disabled={busy} onClick={close}><Icon name="close"/></button></div>
    <div className="modal-body stack"><p className="muted">Optional details for your dashboard and card. Choose whether signed-in players can also see these details.</p><p className="fine">Your codename is {identity.codename}. Codename changes use the existing staff-help process. Account security stays in Settings.</p>
      {error?<Notice type="error">{error}</Notice>:null}
      <ValidatedForm className="stack" onSubmit={save}>
        {([['displayName','Display name',48],['bio','Bio',180],['websiteUrl','Website URL',240],['githubUrl','GitHub profile URL',240]] as const).map(([key,label,max])=><label className="field" key={key}><span>{label}<small className="muted"> — optional</small></span>{key==="bio"?<textarea id={`profile-edit-${key}`} value={fields[key]} maxLength={max} rows={3} disabled={busy} onChange={e=>change(key,e.target.value)} aria-invalid={!!invalid[key]?.length} aria-describedby={`profile-edit-${key}-help`}/>:<input id={`profile-edit-${key}`} value={fields[key]} type={key.endsWith("Url")?"url":"text"} maxLength={max} disabled={busy} onChange={e=>change(key,e.target.value)} placeholder={key==="githubUrl"?"https://github.com/your-name":key==="websiteUrl"?"https://example.com":undefined} autoComplete={key==="displayName"?"nickname":"off"} aria-invalid={!!invalid[key]?.length} aria-describedby={`profile-edit-${key}-help`}/>}<small id={`profile-edit-${key}-help`} className={invalid[key]?.length?"danger":"muted"}>{invalid[key]?.join(" ") || (key.endsWith("Url")?"Use a complete HTTPS URL.":`${fields[key].length} / ${max} characters`)}</small></label>)}
        <label className="social-sharing"><input type="checkbox" checked={fields.shareProfile} disabled={busy} onChange={e=>setFields(old=>({...old,shareProfile:e.target.checked}))} aria-describedby="profile-sharing-help"/>Share my display name, bio, and links with signed-in players</label><p className="fine" id="profile-sharing-help">Off by default. Your codename and practice results are still visible. Friendship never reveals private profile details or account information.</p>
        <div className="cta-row"><button className="button button-primary" type="submit" disabled={busy}>{busy?<Spinner/>:null}{busy?"Saving profile":"Save profile"}</button><button className="button button-secondary" type="button" disabled={busy} onClick={close}>Cancel</button></div>
      </ValidatedForm>
    </div>
  </Modal>;
}

export default function PlayerProfileDashboard({userId,refreshKey,open,settings,refreshSession}:{userId:string;refreshKey:unknown;open:(id:string)=>void;settings:()=>void;refreshSession:()=>Promise<void>}) {
  const [scope,setScope]=useState<ProfileScope>("all"),[profile,setProfile]=useState<PlayerProfile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[expired,setExpired]=useState(false);
  const [editing,setEditing]=useState(false),[message,setMessage]=useState(""),[moreBusy,setMoreBusy]=useState(false),[moreError,setMoreError]=useState(""),[exporting,setExporting]=useState(false),[retry,setRetry]=useState(0);
  const epoch=useRef(0),moreLock=useRef(false);
  const sessionError=useCallback((err:unknown)=>{if(err instanceof ApiError && (err.status===401 || err.status===403)){setExpired(true);setProfile(null);setError(err.message);return true;}return false;},[]);
  useEffect(()=>{
    const controller=new AbortController(),request=++epoch.current;
    setLoading(true);setProfile(null);setError("");setMoreError("");setExpired(false);setMessage("");setEditing(false);moreLock.current=false;setMoreBusy(false);
    api<PlayerProfile>(`/api/v1/profile?scope=${scope}`,{signal:controller.signal}).then(data=>{if(request===epoch.current)setProfile(data);}).catch(err=>{if(request===epoch.current&&!controller.signal.aborted){sessionError(err);setError(err instanceof Error?err.message:"Profile could not load. Retry.");}}).finally(()=>{if(request===epoch.current)setLoading(false);});
    return ()=>{controller.abort();epoch.current++;};
  },[scope,userId,refreshKey,retry,sessionError]);
  async function more(){
    if(!profile?.activity.nextCursor || moreLock.current)return;
    moreLock.current=true;setMoreBusy(true);setMoreError("");const request=epoch.current;
    try{const result=await api<ProfileActivityPage>(`/api/v1/profile/activity?scope=${scope}&cursor=${encodeURIComponent(profile.activity.nextCursor)}`);if(request===epoch.current)setProfile(old=>old?{...old,activity:{items:[...old.activity.items,...result.items],nextCursor:result.nextCursor}}:old);}
    catch(err){if(request===epoch.current){sessionError(err);setMoreError(err instanceof Error?err.message:"Could not load more solves. Retry.");}}
    finally{if(request===epoch.current){moreLock.current=false;setMoreBusy(false);}}
  }
  function saved(identity:ProfileIdentity){setProfile(old=>old?{...old,identity,card:{...old.card,codename:identity.codename,displayName:identity.displayName,bio:identity.bio}}:old);setEditing(false);setMessage("Profile saved.");}
  return <div className="player-profile">
    <div className="page-head"><div><span className="profile-kicker">PLAYER / DASHBOARD</span><h1>Profile</h1><p>Your identity, practice standing, and next milestones.</p></div><div className="profile-page-actions"><label className="select-inline"><span>Practice scope</span><select aria-label="Practice scope" value={scope} disabled={exporting||editing} onChange={e=>setScope(e.target.value as ProfileScope)}><option value="all">All time</option><option value="week">This week · PHT</option></select></label><button type="button" className="button button-secondary" disabled={loading||exporting||editing} onClick={()=>setRetry(n=>n+1)}>Refresh profile</button></div></div>
    {loading?<Loading label="Loading your profile"/>:error?<Notice type="error">{error} <button type="button" className="text-button" onClick={()=>expired?void refreshSession():setRetry(n=>n+1)}>{expired?"Check sign-in":"Retry profile"}</button></Notice>:profile?<>
      {message?<Notice type="success">{message}</Notice>:null}
      <section className="profile-identity" aria-labelledby="player-identity-title">
        <div className="profile-avatar"><Identicon name={profile.identity.codename} size={88} you/></div>
        <div className="profile-identity-copy"><span className="profile-kicker">PLAYER IDENTITY</span><h2 id="player-identity-title" className="mono">@{profile.identity.codename}</h2>{profile.identity.displayName?<p className="profile-display-name">{profile.identity.displayName}</p>:null}{profile.identity.bio?<p className="profile-bio">{profile.identity.bio}</p>:<p className="muted">Add a short bio to make this space yours.</p>}<div className="profile-links">{profile.identity.websiteUrl?<a href={profile.identity.websiteUrl} rel="noopener noreferrer nofollow">Website <Icon name="link" size={14}/></a>:null}{profile.identity.githubUrl?<a href={profile.identity.githubUrl} rel="noopener noreferrer nofollow">GitHub <Icon name="link" size={14}/></a>:null}</div></div>
        <div className="profile-identity-actions"><button type="button" className="button button-primary" disabled={exporting} onClick={()=>setEditing(true)}>Edit profile</button><button type="button" className="text-button" disabled={exporting} onClick={settings}>Account settings</button><span className="fine">Profile details: {profile.identity.shareProfile?"shared with signed-in players":"only you"}</span></div>
      </section>
      <section className="profile-stat-grid" aria-label={`${profile.scope.label} statistics`}>{([["Rank",profile.stats.rank===null?"Unranked":`#${profile.stats.rank.toLocaleString()}`],["Awarded XP",profile.stats.points.toLocaleString()],["Captures",profile.stats.solved.toLocaleString()],["First Bloods",profile.stats.firstBloods.toLocaleString()]] as const).map(([label,value])=><div className="profile-stat" key={label}><span className="stat-label">{label}</span><strong>{value}</strong></div>)}</section>
      <p className="profile-scope-note"><strong>{profile.scope.label}</strong> · {profile.scope.period}. Totals retain historical practice results; competition scores stay on their event scoreboards. <span>Updated <time dateTime={profile.asOf}>{date(profile.asOf)} PHT</time>.</span></p>
      <ProfileCardStudio key={userId} userId={userId} card={profile.card} scope={scope} onBusy={setExporting}/>
      <div className="profile-detail-grid">
        <section className="panel profile-category-panel" aria-labelledby="profile-categories-title"><div className="profile-section-head"><div><span className="profile-kicker">YOUR RANGE</span><h2 id="profile-categories-title">Category performance</h2><p className="fine">Captures in this scope / currently published practice challenges. XP is the amount actually awarded, not today’s challenge value.</p></div></div><ul className="profile-categories">{profile.categories.map(c=><li key={c.category}><div><strong>{c.category}</strong><span>{c.solved} / {c.total} captured</span></div><progress max={c.total||1} value={c.solved} aria-label={`${c.category}: ${c.solved} of ${c.total} currently published challenges captured in this scope`}/><p className="fine">{c.total?`${Math.round(c.solved/c.total*100)}% of the available category`:"No published challenges in this category"}<span>{c.points.toLocaleString()} awarded XP</span></p></li>)}</ul></section>
        <section className="panel" aria-labelledby="profile-milestones-title"><div className="profile-section-head"><div><span className="profile-kicker">PROVEN PROGRESS</span><h2 id="profile-milestones-title">Milestones</h2><p className="fine">Derived from your valid results in {profile.scope.label.toLowerCase()}. These are personal milestones, not official awards.</p></div></div>{profile.milestones.length?<ul className="profile-milestones">{profile.milestones.map(m=><li key={m.id}><span className="profile-milestone-icon" aria-hidden="true">+</span><div><h3>{m.label}</h3><p>{m.condition}</p></div></li>)}</ul>:<Empty title="Your first capture starts here" action={<button type="button" className="button button-secondary" onClick={()=>open("")}>Browse challenges</button>}>Complete one valid practice challenge in this scope to reach your first milestone.</Empty>}</section>
      </div>
      <section className="panel" aria-labelledby="profile-activity-title"><div className="profile-section-head"><div><span className="profile-kicker">THE FLAGS YOU’VE FOUND</span><h2 id="profile-activity-title">Recent captures</h2><p className="fine">Currently published practice challenges, within the selected scope. Archived or unavailable challenge details are hidden.</p></div></div>{profile.activity.items.length?<ul className="profile-activity">{profile.activity.items.map(item=><li key={item.challengeId}><div><a href={`/?view=practice&challenge=${encodeURIComponent(item.challengeId)}`} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();open(item.challengeId);}}}>{item.title}</a><p>{item.category}{item.firstBlood?<span className="tag tag-accent">First Blood</span>:null}</p></div><div className="profile-activity-time"><time dateTime={item.at} title={`${date(item.at)} PHT`}>{date(item.at)} PHT</time><span>{relative(item.at)}</span></div><strong className="mono">{item.points>0?"+":""}{item.points.toLocaleString()} XP</strong></li>)}</ul>:<Empty title="No visible captures in this scope">New practice captures appear here. Historical totals may include challenges that are no longer published.</Empty>}{moreError?<Notice type="error">{moreError}</Notice>:null}{profile.activity.nextCursor?<div className="profile-load-more"><button type="button" className="button button-secondary" disabled={moreBusy} onClick={more}>{moreBusy?<Spinner/>:null}{moreBusy?"Loading captures":"Load more captures"}</button></div>:null}</section>
      {editing?<ProfileEditor identity={profile.identity} userId={userId} saved={saved} close={()=>setEditing(false)} expired={()=>{setEditing(false);setProfile(null);setExpired(true);setError("Your session or account access changed. Check sign-in before continuing.");}}/>:null}
    </>:null}
  </div>;
}
