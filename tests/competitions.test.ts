import { beforeAll,afterAll,beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq,sql } from "drizzle-orm";
import { createStore } from "@/server/db";
import { user,competitionSolves,competitionSubmissions } from "@/server/schema";
import { createChallenge,editChallenge,publishChallenge,listChallenges,challengeDetail,submitFlag,getProgress } from "@/server/challenges";
import { saveArtifact,downloadArtifact } from "@/server/files";
import { getCommunity } from "@/server/community";
import { competitionInput,saveCompetition,setCompetitionStatus,listCompetitions,getCompetition,joinCompetition,competitionChallengeDetail,submitCompetitionFlag } from "@/server/competitions";
import { challengeInput } from "@/server/validation";
import type { Viewer } from "@/lib/types";

let store:Awaited<ReturnType<typeof createStore>>,directory:string;
const admin:Viewer={id:randomUUID(),email:"host@example.test",codename:"event_host",emailVerified:true,role:"admin",twoFactorEnabled:true};
const reviewer:Viewer={...admin,id:randomUUID(),email:"event-reviewer@example.test",codename:"event_reviewer",role:"reviewer"};
const player:Viewer={...admin,id:randomUUID(),email:"event-player@example.test",codename:"event_player",role:"participant",twoFactorEnabled:false};
const other:Viewer={...player,id:randomUUID(),email:"other-event-player@example.test",codename:"other_player"};
const now=new Date("2026-11-01T00:00:00Z"),start=new Date(now.getTime()+60_000),end=new Date(now.getTime()+3_600_000),flag="dfCTF{private_event_evidence}";
const eventInput=(selections:{challengeId:string;points:number}[]=[])=>competitionInput.parse({title:"November training CTF",description:"An individual competition with original training challenges.",platform:"dfctf",startsAt:start.toISOString(),endsAt:end.toISOString(),selections});
async function challenge(visibility:"practice"|"competition"="competition"){
  const draft=await createChallenge(store.db,admin,challengeInput.parse({title:`Private event ${randomUUID()}`,summary:"Original event evidence for testing.",description:"Inspect the supplied original event evidence and recover its flag.",solution:"Read the event evidence to recover the complete flag and submit it.",category:"General skills",difficulty:"Easy",xp:50,estimatedMinutes:5,flag,visibility}));
  const file=await saveArtifact(store.db,admin,draft.id,"event.txt",Buffer.from(flag));
  await editChallenge(store.db,admin,draft.id,{status:"review"});await publishChallenge(store.db,reviewer,draft.id,flag);return {...draft,file};
}
async function event(){const c=await challenge();const e=await saveCompetition(store.db,admin,eventInput([{challengeId:c.id,points:250}]));await setCompetitionStatus(store.db,admin,e.id,"published");return {e,c};}
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-events-"));process.env.ARTIFACT_DIR=directory;store=await createStore(process.env.TEST_DATABASE_URL,true);await store.migrate();for(const identity of [admin,reviewer,player,other])await store.db.insert(user).values({...identity,name:"Private account name"});});
afterAll(async()=>{await store?.close();await rm(directory,{recursive:true,force:true});delete process.env.ARTIFACT_DIR;});
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);});
afterEach(()=>vi.useRealTimers());

describe("competition isolation and scoring",()=>{
  it("denies direct browser/Data API table access while the backend owner retains access",async()=>{
    const metadata=await store.db.execute(sql`select count(*) as total from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(Number(metadata.rows[0].total)).toBe(0);
    await store.db.execute(sql`create role dfctf_api_probe nologin nosuperuser nobypassrls`);
    await store.db.execute(sql`grant usage on schema public to dfctf_api_probe`);
    await store.db.execute(sql`grant select,insert,update,delete on all tables in schema public to dfctf_api_probe`);
    await store.db.transaction(async tx=>{
      await tx.execute(sql`set local role dfctf_api_probe`);
      const visible=await tx.execute(sql`select count(*) as total from auth_user`);expect(Number(visible.rows[0].total)).toBe(0);
    });
    const code=await store.db.transaction(async tx=>{await tx.execute(sql`set local role dfctf_api_probe`);await tx.execute(sql`insert into auth_user (id,name,email) values ('denied-api-write','Untrusted','denied@example.test')`);}).then(()=>null,error=>error.cause?.code??error.code);
    expect(code).toBe("42501");
    expect(await store.db.select().from(user).where(eq(user.id,admin.id))).toHaveLength(1);
  });
  it("keeps event content out of practice, public statistics, direct details, downloads, and submissions",async()=>{
    const c=await challenge();
    expect((await listChallenges(store.db,player.id)).some(x=>x.id===c.id)).toBe(false);
    expect((await getCommunity(store.db,now)).totals.challenges).toBe(0);
    await expect(challengeDetail(store.db,player,c.id)).rejects.toMatchObject({status:404});
    await expect(downloadArtifact(store.db,player,c.id,c.file.id)).rejects.toMatchObject({status:404});
    await expect(submitFlag(store.db,player,c.id,flag)).rejects.toMatchObject({status:404});
    expect((await challengeDetail(store.db,admin,c.id,true)).visibility).toBe("competition");
  });
  it("requires registration and the exact start boundary for event content and downloads",async()=>{
    const {e,c}=await event();
    expect((await getCompetition(store.db,player,e.id)).challenges).toEqual([]);
    await expect(competitionChallengeDetail(store.db,player,e.id,c.id)).rejects.toMatchObject({code:"REGISTRATION_REQUIRED"});
    await joinCompetition(store.db,player,e.id);await joinCompetition(store.db,player,e.id);
    expect((await getCompetition(store.db,player,e.id)).participants).toBe(1);
    await expect(competitionChallengeDetail(store.db,player,e.id,c.id)).rejects.toMatchObject({code:"COMPETITION_NOT_STARTED"});
    await expect(downloadArtifact(store.db,player,c.id,c.file.id,false,e.id)).rejects.toMatchObject({code:"COMPETITION_NOT_STARTED"});
    await expect(submitCompetitionFlag(store.db,player,e.id,c.id,flag)).rejects.toMatchObject({code:"COMPETITION_NOT_STARTED"});
    vi.setSystemTime(start);
    expect((await competitionChallengeDetail(store.db,player,e.id,c.id)).solution).toBeUndefined();
    expect((await getCompetition(store.db,player,e.id)).challenges[0].xp).toBe(250);
    expect(await (await downloadArtifact(store.db,player,c.id,c.file.id,false,e.id)).text()).toBe(flag);
    await expect(downloadArtifact(store.db,other,c.id,c.file.id,false,e.id)).rejects.toMatchObject({code:"REGISTRATION_REQUIRED"});
    await expect(competitionChallengeDetail(store.db,player,"another-event",c.id)).rejects.toMatchObject({status:404});
  });
  it("awards event points once under concurrent and repeated solves and leaves practice XP unchanged",async()=>{
    const {e,c}=await event();await joinCompetition(store.db,player,e.id);vi.setSystemTime(start);
    const [a,b]=await Promise.all([submitCompetitionFlag(store.db,player,e.id,c.id,flag),submitCompetitionFlag(store.db,player,e.id,c.id,flag)]);
    expect([a,b].map(r=>r.status).sort()).toEqual(["already_solved","correct"]);
    expect(a.xp+b.xp).toBe(250);
    expect(await submitCompetitionFlag(store.db,player,e.id,c.id,flag)).toMatchObject({status:"already_solved",xp:0});
    expect(await store.db.select().from(competitionSolves).where(eq(competitionSolves.competitionId,e.id))).toHaveLength(1);
    expect((await getProgress(store.db,player.id)).totalXp).toBe(0);
    const detail=await competitionChallengeDetail(store.db,player,e.id,c.id);
    expect(detail.solvers).toEqual([expect.objectContaining({codename:"event_player",firstBlood:true})]);expect(detail.solution).toBeDefined();
    const board=(await getCompetition(store.db,player,e.id)).standings;
    expect(board).toEqual([{rank:1,codename:"event_player",points:250,solves:1}]);expect(JSON.stringify(board)).not.toMatch(/@example|Private account|userId/);
  });
  it("closes submissions and registration at the end boundary while retaining registered-player results",async()=>{
    const {e,c}=await event();await joinCompetition(store.db,player,e.id);vi.setSystemTime(end);
    await expect(submitCompetitionFlag(store.db,player,e.id,c.id,flag)).rejects.toMatchObject({code:"COMPETITION_ENDED"});
    await expect(joinCompetition(store.db,other,e.id)).rejects.toMatchObject({code:"COMPETITION_ENDED"});
    expect((await competitionChallengeDetail(store.db,player,e.id,c.id)).submissionsOpen).toBe(false);
    expect(await store.db.select().from(competitionSubmissions).where(eq(competitionSubmissions.competitionId,e.id))).toHaveLength(0);
    await setCompetitionStatus(store.db,admin,e.id,"archived");
    await expect(downloadArtifact(store.db,player,c.id,c.file.id,false,e.id)).rejects.toMatchObject({status:404});
  });
  it.each([end,new Date(end.getTime()+60_000)])("keeps published-event challenges immutable and accessible after the event ends (%s)",async(at)=>{
    const {e,c}=await event();await joinCompetition(store.db,player,e.id);vi.setSystemTime(at);
    const before=await competitionChallengeDetail(store.db,player,e.id,c.id);
    await expect(editChallenge(store.db,admin,c.id,{title:"Changed after the event"})).rejects.toMatchObject({status:409,code:"COMPETITION_LOCKED"});
    await expect(editChallenge(store.db,admin,c.id,{status:"archived"})).rejects.toMatchObject({status:409,code:"COMPETITION_LOCKED"});
    await expect(saveArtifact(store.db,admin,c.id,"replacement.txt",Buffer.from("Replacement evidence"))).rejects.toMatchObject({status:409,code:"COMPETITION_LOCKED"});
    expect(await competitionChallengeDetail(store.db,player,e.id,c.id)).toMatchObject({title:before.title,version:before.version,status:"published",submissionsOpen:false,files:before.files});
    expect(await (await downloadArtifact(store.db,player,c.id,c.file.id,false,e.id)).text()).toBe(flag);
  });
  it("rate limits incorrect event guesses without granting points, then lifts the cooldown",async()=>{
    const {e,c}=await event();await joinCompetition(store.db,other,e.id);vi.setSystemTime(start);
    for(let i=0;i<10;i++)expect(await submitCompetitionFlag(store.db,other,e.id,c.id,"dfCTF{wrong}")).toMatchObject({status:"incorrect",xp:0});
    await expect(submitCompetitionFlag(store.db,other,e.id,c.id,flag)).rejects.toMatchObject({status:429});
    expect((await getCompetition(store.db,other,e.id)).standings).toEqual([]);
    vi.setSystemTime(new Date(start.getTime()+61_000));
    expect(await submitCompetitionFlag(store.db,other,e.id,c.id,"dfCTF{wrong}")).toMatchObject({status:"incorrect",xp:0});
  });
  it("requires admin hosting, reviewed private challenges, exclusive event assignment, and immutable published settings",async()=>{
    await expect(saveCompetition(store.db,player,eventInput())).rejects.toMatchObject({status:403});
    const practice=await challenge("practice");await expect(saveCompetition(store.db,admin,eventInput([{challengeId:practice.id,points:100}]))).rejects.toMatchObject({code:"CHALLENGES_NOT_READY"});
    const draft=await saveCompetition(store.db,admin,eventInput());
    expect((await listCompetitions(store.db)).some(x=>x.id===draft.id)).toBe(false);
    await expect(getCompetition(store.db,player,draft.id)).rejects.toMatchObject({status:404});
    await expect(setCompetitionStatus(store.db,admin,draft.id,"published")).rejects.toMatchObject({code:"CHALLENGES_REQUIRED"});
    const {e,c}=await event();
    await expect(saveCompetition(store.db,admin,eventInput(),e.id)).rejects.toMatchObject({code:"COMPETITION_LOCKED"});
    await expect(saveCompetition(store.db,admin,eventInput([{challengeId:c.id,points:100}]))).rejects.toMatchObject({code:"CHALLENGE_ASSIGNED"});
    await expect(editChallenge(store.db,admin,c.id,{visibility:"practice"})).rejects.toMatchObject({code:"COMPETITION_LOCKED"});
    await expect(editChallenge(store.db,admin,c.id,{status:"archived"})).rejects.toMatchObject({code:"COMPETITION_LOCKED"});
  });
  it("supports HTTPS CTFd links with independent host registration and rejects unsafe URLs and schedules",async()=>{
    const input=competitionInput.parse({title:"External CTF",description:"A competition operated on a separate CTFd host.",platform:"ctfd",externalUrl:"https://ctf.example.org/event",startsAt:start.toISOString(),endsAt:end.toISOString()});
    const e=await saveCompetition(store.db,admin,input);await setCompetitionStatus(store.db,admin,e.id,"published");
    expect(await getCompetition(store.db,player,e.id)).toMatchObject({platform:"ctfd",externalUrl:"https://ctf.example.org/event",registered:false,challenges:[],standings:[]});
    await expect(joinCompetition(store.db,player,e.id)).rejects.toMatchObject({code:"EXTERNAL_COMPETITION"});
    for(const externalUrl of ["javascript:alert(1)","http://ctf.example.org","https://user:secret@ctf.example.org"]){expect(competitionInput.safeParse({...input,startsAt:start.toISOString(),endsAt:end.toISOString(),externalUrl}).success).toBe(false);}
    expect(competitionInput.safeParse({...input,startsAt:end.toISOString(),endsAt:start.toISOString()}).success).toBe(false);
  });
});
