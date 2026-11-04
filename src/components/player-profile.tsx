"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { codenameField } from "@/lib/pixel";
import { profileMilestoneGoals, type PlayerProfile, type ProfileActivityPage, type ProfileIdentity, type ProfileScope } from "@/lib/player-profile";
import { api, ApiError, Icon, Identicon, InfoTip, Loading, Meter, MilestoneIcon, Modal, Notice, Spinner } from "./ui";
import ValidatedForm from "./validated-form";
import ProfileCardStudio from "./profile-card-studio";
import { DitherArt, Radar, radarLabel } from "./viz";

const date=(at:string)=>new Intl.DateTimeFormat("en",{timeZone:"Asia/Manila",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(at));
function relative(at:string){const days=(Date.now()-new Date(at).getTime())/86400000;return new Intl.RelativeTimeFormat("en",{numeric:"auto"}).format(-Math.max(0,Math.floor(days>=1?days:days*24)),days>=1?"day":"hour");}

function ProfileEditor({ identity, userId, saved, close, expired }: { identity: ProfileIdentity; userId:string; saved:(identity:ProfileIdentity)=>void;close:()=>void;expired:()=>void }) {
  const [fields,setFields]=useState({displayName:identity.displayName,bio:identity.bio,websiteUrl:identity.websiteUrl,githubUrl:identity.githubUrl,shareProfile:identity.shareProfile??false});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[invalid,setInvalid]=useState<Record<string,string[]>>({});
  useEffect(()=>{const field=Object.keys(invalid).find(key=>invalid[key]?.length);if(field)document.getElementById(`profile-edit-${field}`)?.focus();},[invalid]);
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");setInvalid({});
    try{saved(await api<ProfileIdentity>("/api/v1/profile",{method:"PATCH",headers:{"X-dfCTF-Account":userId},body:JSON.stringify(fields)}));}
    catch(err){if(err instanceof ApiError && (err.status===401||err.status===403)){expired();return;}setError(err instanceof Error?err.message:"Your profile could not be saved. Retry.");if(err instanceof ApiError && err.details && typeof err.details==="object" && "fieldErrors" in err.details){setInvalid(err.details.fieldErrors as Record<string,string[]>);}}
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

const BAND_WIDTH=1200,BAND_HEIGHT=240;
function ProfileBand({codename}:{codename:string}){
  const density=useMemo(()=>codenameField(codename,BAND_WIDTH,BAND_HEIGHT),[codename]);
  return <DitherArt className="pf-band" width={BAND_WIDTH} height={BAND_HEIGHT} cell={6} density={density}/>;
}

export default function PlayerProfileDashboard({userId,refreshKey,open,settings,refreshSession}:{userId:string;refreshKey:unknown;open:(id:string)=>void;settings:()=>void;refreshSession:()=>Promise<void>}) {
  const [scope,setScope]=useState<ProfileScope>("all"),[profile,setProfile]=useState<PlayerProfile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[expired,setExpired]=useState(false);
  const [editing,setEditing]=useState(false),[sharing,setSharing]=useState(false),[message,setMessage]=useState(""),[moreBusy,setMoreBusy]=useState(false),[moreError,setMoreError]=useState(""),[exporting,setExporting]=useState(false),[retry,setRetry]=useState(0);
  const epoch=useRef(0),moreLock=useRef(false);
  const sessionError=useCallback((err:unknown)=>{if(err instanceof ApiError && (err.status===401 || err.status===403)){setExpired(true);setProfile(null);setError(err.message);return true;}return false;},[]);
  useEffect(()=>{
    const controller=new AbortController(),request=++epoch.current;
    setLoading(true);setProfile(null);setError("");setMoreError("");setExpired(false);setMessage("");setEditing(false);setSharing(false);moreLock.current=false;setMoreBusy(false);
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
  const goals=profile?profileMilestoneGoals(profile.stats):[];
  return <div className="player-profile">
    <div className="page-head"><h1>Profile</h1><div className="profile-page-actions"><label className="select-inline"><span>Practice scope</span><select aria-label="Practice scope" value={scope} disabled={exporting||editing} onChange={e=>setScope(e.target.value as ProfileScope)}><option value="all">All time</option><option value="week">This week · PHT</option></select></label><button type="button" className="button button-secondary" disabled={loading||exporting||editing} onClick={()=>setRetry(n=>n+1)}>Refresh profile</button></div></div>
    {loading?<Loading label="Loading your profile"/>:error?<Notice type="error">{error} <button type="button" className="text-button" onClick={()=>expired?void refreshSession():setRetry(n=>n+1)}>{expired?"Check sign-in":"Retry profile"}</button></Notice>:profile?<>
      {message?<Notice type="success">{message}</Notice>:null}
      <section className="pf-hero" aria-labelledby="player-identity-title">
        <ProfileBand codename={profile.identity.codename}/>
        <div className="pf-hero-main">
          <div className="pf-who"><div className="pf-avatar"><Identicon name={profile.identity.codename} size={88} you/></div><h2 id="player-identity-title" className="mono">@{profile.identity.codename}</h2>{profile.identity.displayName?<p className="pf-name">{profile.identity.displayName}</p>:null}{profile.identity.bio?<p className="pf-bio">{profile.identity.bio}</p>:<p className="pf-bio muted">Add a short bio to make this space yours.</p>}{profile.identity.websiteUrl||profile.identity.githubUrl?<div className="pf-links">{profile.identity.websiteUrl?<a href={profile.identity.websiteUrl} rel="noopener noreferrer nofollow">Website <Icon name="link" size={14}/></a>:null}{profile.identity.githubUrl?<a href={profile.identity.githubUrl} rel="noopener noreferrer nofollow">GitHub <Icon name="link" size={14}/></a>:null}</div>:null}</div>
          <section className="pf-stats" aria-label={`${profile.scope.label} statistics`}>{([["Rank",profile.stats.rank===null?"Unranked":`#${profile.stats.rank.toLocaleString()}`],["Points",profile.stats.points.toLocaleString()],["Solves",profile.stats.solved.toLocaleString()],["First Bloods",profile.stats.firstBloods.toLocaleString()]] as const).map(([label,value])=><div className={`pf-stat${profile.stats.rank===null&&label==="Rank"?" pf-unranked":""}`} key={label}><span className="stat-label">{label}</span><strong>{value}</strong></div>)}</section>
        </div>
        <div className="pf-hero-foot">
          <button type="button" className={`button ${profile.stats.solved?"button-primary":"button-secondary"}`} disabled={exporting} onClick={()=>setSharing(true)}>Share card</button><button type="button" className="button button-secondary" disabled={exporting} onClick={()=>setEditing(true)}>Edit profile</button><button type="button" className="text-button" disabled={exporting} onClick={settings}>Account settings</button><span className="fine">Profile details: {profile.identity.shareProfile?"shared with signed-in players":"only you"}</span>
          <span className="spacer"/>
          <span className="pf-scope fine">{profile.scope.period}<InfoTip text="Totals keep historical practice results. Competition scores stay on their event scoreboards." label="About these totals"/>Updated <time dateTime={profile.asOf}>{date(profile.asOf)} PHT</time></span>
        </div>
      </section>
      <div className="pf-detail">
        <section className="panel pf-fill" aria-labelledby="profile-categories-title"><div className="panel-head"><h2 id="profile-categories-title">Categories</h2><InfoTip text="Your solves in this scope against the currently published practice challenges. Points are the amounts actually awarded, not today’s challenge values." label="About categories"/><span className="spacer"/><span className="muted">{profile.categories.reduce((sum,c)=>sum+c.solved,0)} of {profile.categories.reduce((sum,c)=>sum+c.total,0)} solved</span></div><div className="pf-cat"><Radar values={profile.categories.map(c=>({label:radarLabel(c.category),solved:c.solved,total:c.total}))}/><ul className="pf-map">{profile.categories.map(c=><li key={c.category}><strong>{c.category}</strong><span className="pf-meter" aria-hidden="true">{c.total?<Meter value={c.solved} max={c.total} cells={12} tone="accent" label=""/>:null}</span><span className="mono muted pf-count">{c.total?<>{c.solved}/{c.total}<span className="sr-only"> solved</span></>:"None"}</span><span className="mono strong num">{c.points.toLocaleString()} pts</span></li>)}</ul></div></section>
        <section className="panel pf-fill" aria-labelledby="profile-milestones-title"><div className="panel-head"><h2 id="profile-milestones-title">Milestones</h2><InfoTip text={`Based on your valid results in ${profile.scope.label.toLowerCase()}. These are personal milestones, not official awards.`} label="About milestones"/><span className="spacer"/><span className="muted">{goals.filter(g=>g.earned).length} of {goals.length} earned</span></div><ul className="pf-goals">{goals.map(g=><li key={g.id} data-earned={g.earned||undefined}><MilestoneIcon id={g.id}/><div><h3>{g.label}</h3><p>{g.text}</p>{g.target&&!g.earned?<Meter value={g.target.value} max={g.target.max} cells={g.target.max} tone="accent" label={`${g.target.value} of ${g.target.max} solves`}/>:null}</div><span className="pf-goal-state mono">{g.earned?"Earned":g.target?`${g.target.value}/${g.target.max}`:"Not yet"}</span></li>)}</ul></section>
      </div>
      <section className="panel" aria-labelledby="profile-activity-title"><div className="panel-head"><h2 id="profile-activity-title">Recent solves</h2><InfoTip text="Currently published practice challenges in this scope. Archived or unavailable challenge details are hidden." label="About recent solves"/></div>{profile.activity.items.length?<ul className="pf-log">{profile.activity.items.map(item=><li key={item.challengeId}><span className="pf-log-title"><a href={`/?view=practice&challenge=${encodeURIComponent(item.challengeId)}`} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();open(item.challengeId);}}}>{item.title}</a>{item.firstBlood?<span className="tag tag-accent">First Blood</span>:null}</span><span className="muted">{item.category}</span><time className="fine" dateTime={item.at} title={`${date(item.at)} PHT`}>{relative(item.at)}</time><strong className="mono num">{item.points>0?"+":""}{item.points.toLocaleString()} pts</strong></li>)}</ul>:profile.stats.solved?<p className="muted panel-pad">No visible solves in this scope. Totals may include challenges that are no longer published.</p>:<div className="pf-start"><div><h3>Your first solve starts here</h3><p className="muted">Solve one practice challenge in this scope to reach your first milestone.</p></div><button type="button" className="button button-primary" onClick={()=>open("")}>Browse challenges</button></div>}{moreError?<Notice type="error">{moreError}</Notice>:null}{profile.activity.nextCursor?<div className="profile-load-more"><button type="button" className="button button-secondary" disabled={moreBusy} onClick={more}>{moreBusy?<Spinner/>:null}{moreBusy?"Loading solves":"Load more solves"}</button></div>:null}</section>
      {sharing?<Modal labelledBy="card-studio-title" onClose={()=>setSharing(false)} dismissible={!exporting} className="profile-card-modal"><div className="modal-bar"><h2 id="card-studio-title">Player card</h2><span className="spacer"/><button type="button" className="icon-button" aria-label="Close player card" disabled={exporting} onClick={()=>setSharing(false)}><Icon name="close"/></button></div><ProfileCardStudio key={userId} userId={userId} card={profile.card} scope={scope} onBusy={setExporting}/></Modal>:null}
      {editing?<ProfileEditor identity={profile.identity} userId={userId} saved={saved} close={()=>setEditing(false)} expired={()=>{setEditing(false);setProfile(null);setExpired(true);setError("Your session or account access changed. Check sign-in before continuing.");}}/>:null}
    </>:null}
  </div>;
}
