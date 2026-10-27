import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import { user,challenges,challengeVersions,solves,xpLedger,submissions,requestResults,auditEvents } from "@/server/schema";
import { createChallenge,editChallenge,publishChallenge,challengeDetail,submitFlag,getProgress,listChallenges,consumeLimit } from "@/server/challenges";
import { saveArtifact,downloadArtifact } from "@/server/files";
import { flagDigest,matchesFlag } from "@/server/flags";
import { challengeInput,challengePatchInput,codenameSchema,codenameKey } from "@/server/validation";
import { checkOrigin } from "@/server/http";
import { createRulesChallenge,rulesChallenge } from "@/server/rules-challenge";
import { RULE_FIELD_NOTES } from "@/lib/rules";
import { getCommunity } from "@/server/community";
import type { Viewer } from "@/lib/types";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let store:Awaited<ReturnType<typeof createStore>>,directory:string;
const author:Viewer={id:randomUUID(),email:"author@example.test",codename:"author_one",emailVerified:true,role:"author",twoFactorEnabled:true};
const reviewer:Viewer={...author,id:randomUUID(),email:"reviewer@example.test",codename:"reviewer_one",role:"reviewer"};
const learner:Viewer={...author,id:randomUUID(),email:"learner@example.test",codename:"learner_one",role:"participant",twoFactorEnabled:false};
const flag="dfCTF{test_evidence_d8f19a27}";
function draft(title:string){return challengeInput.parse({title,summary:"A fictional training exercise.",description:"Inspect the training file and recover its flag.",solution:"Open the supplied file and copy the flag including its wrapper.",flag,category:"General skills",difficulty:"Easy",xp:50,estimatedMinutes:5,tags:["training"]});}
async function ready(title:string){const record=await createChallenge(store.db,author,draft(title));await saveArtifact(store.db,author,record.id,"evidence.txt",Buffer.from(flag));await editChallenge(store.db,author,record.id,{status:"review"});await publishChallenge(store.db,reviewer,record.id,flag);return record;}
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-practice-"));process.env.ARTIFACT_DIR=directory;store=await createStore(undefined,true);await store.migrate();for(const v of [author,reviewer,learner])await store.db.insert(user).values({...v,name:"Private account"});});
afterAll(async()=>{await store?.close();await rm(directory,{recursive:true,force:true});delete process.env.ARTIFACT_DIR;});
describe("private practice integrity",()=>{
  it("fills the summary from the description's first sentence on create and edit",async()=>{
    const c=await createChallenge(store.db,author,{...draft("Derived summary"),summary:undefined});
    expect((await challengeDetail(store.db,author,c.id,true)).summary).toBe("Inspect the training file and recover its flag.");
    await editChallenge(store.db,author,c.id,{description:"Read the log twice. The flag hides in the second pass."});
    expect((await challengeDetail(store.db,author,c.id,true)).summary).toBe("Read the log twice.");
  });
  it("reviews and publishes a challenge that has no files",async()=>{
    const c=await createChallenge(store.db,author,draft("Description only"));
    await editChallenge(store.db,author,c.id,{status:"review"});await publishChallenge(store.db,reviewer,c.id,flag);
    const detail=await challengeDetail(store.db,learner,c.id);expect(detail.status).toBe("published");expect(detail.files).toEqual([]);
  });
  it("lists every solver in order, selects one first blood on timestamp ties, and exposes only public identity",async()=>{
    const c=await ready("Solver attribution");
    expect((await challengeDetail(store.db,learner,c.id)).solvers).toEqual([]);
    const at=new Date("2026-10-20T12:00:00Z");
    const [v]=await store.db.select().from(challengeVersions).where(eq(challengeVersions.challengeId,c.id));
    for(let i=7;i>=0;i--){
      const id=`${c.id}-player-${i}`;
      await store.db.insert(user).values({id,name:"Private legal name",email:`${id}@example.test`,codename:i===7?null:`solver_${i}`});
      await store.db.insert(solves).values({id:`${c.id}-solve-${i}`,userId:id,challengeId:c.id,versionId:v.id,createdAt:new Date(at.getTime()+Math.max(0,i-1)*1000)});
    }
    const detail=await challengeDetail(store.db,learner,c.id);
    expect(detail.solveCount).toBe(8);
    expect(detail.solvers?.map(s=>s.codename)).toEqual(["solver_0","solver_1","solver_2","solver_3","solver_4","solver_5","solver_6","Unnamed player"]);
    expect(detail.solvers?.filter(s=>s.firstBlood)).toEqual([{codename:"solver_0",solvedAt:at.toISOString(),firstBlood:true}]);
    expect(JSON.stringify(detail.solvers)).not.toMatch(/@example|Private legal name|userId|versionId/);
    expect(detail.solution).toBeUndefined();
    const community=await getCommunity(store.db,new Date("2026-10-20T12:00:10Z"));
    expect(community.recent.filter(s=>s.title==="Solver attribution"&&s.firstBlood).map(s=>s.codename)).toEqual(["solver_0"]);
  });
  it("creates the rules challenge once, requires review, and accepts the flag assembled from the published field notes",async()=>{
    const player={...learner,id:randomUUID(),email:"rules-player@example.test",codename:"rules_player"};
    await store.db.insert(user).values({...player,name:"Private rules player"});
    await expect(createRulesChallenge(store.db,learner)).rejects.toMatchObject({status:403});
    const c=await createRulesChallenge(store.db,author);
    expect((await createRulesChallenge(store.db,author)).id).toBe(c.id);
    await expect(createRulesChallenge(store.db,{...reviewer,role:"author"})).rejects.toMatchObject({code:"RULES_CHALLENGE_EXISTS"});
    await expect(challengeDetail(store.db,learner,c.id)).rejects.toMatchObject({status:404});
    const draftDetail=await challengeDetail(store.db,author,c.id,true);
    expect(draftDetail.files).toHaveLength(1);
    expect(await (await downloadArtifact(store.db,author,c.id,draftDetail.files[0].id,true)).text()).not.toContain(rulesChallenge.flag);
    await editChallenge(store.db,author,c.id,{status:"review"});
    await expect(publishChallenge(store.db,{...author,role:"admin"},c.id,rulesChallenge.flag)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await publishChallenge(store.db,reviewer,c.id,RULE_FIELD_NOTES.join(""));
    expect(await submitFlag(store.db,player,c.id,RULE_FIELD_NOTES.join(""))).toMatchObject({status:"correct",xp:50});
    expect((await challengeDetail(store.db,player,c.id)).solvers).toEqual([expect.objectContaining({codename:player.codename,firstBlood:true})]);
  });
  it("keeps validators and solutions out of unsolved challenge responses",async()=>{
    const c=await ready("Public response boundary");const detail=await challengeDetail(store.db,learner,c.id);
    expect(detail.solution).toBeUndefined();expect(JSON.stringify(detail)).not.toContain(flag);expect(JSON.stringify(detail)).not.toContain(flagDigest(flag));
    const bytes=await (await downloadArtifact(store.db,learner,c.id,detail.files[0].id)).text();expect(bytes).toBe(flag);
  });
  it("returns 404 for unpublished content and downloads",async()=>{
    const c=await createChallenge(store.db,author,draft("Hidden draft"));const file=await saveArtifact(store.db,author,c.id,"private.txt",Buffer.from(flag));
    await expect(challengeDetail(store.db,learner,c.id)).rejects.toMatchObject({status:404});await expect(downloadArtifact(store.db,learner,c.id,file.id)).rejects.toMatchObject({status:404});
    expect((await listChallenges(store.db,learner.id)).some(x=>x.id===c.id)).toBe(false);
  });
  it("requires independent review and a correct reviewer test solve",async()=>{
    const c=await createChallenge(store.db,author,draft("Independent approval"));await saveArtifact(store.db,author,c.id,"review.txt",Buffer.from(flag));await editChallenge(store.db,author,c.id,{status:"review"});
    await expect(publishChallenge(store.db,{...author,role:"admin"},c.id,flag)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await expect(publishChallenge(store.db,reviewer,c.id,"dfCTF{wrong_flag}")).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    await publishChallenge(store.db,reviewer,c.id,flag);await expect(editChallenge(store.db,author,c.id,{title:"Changed after publication"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
  });
  it("preserves omitted draft fields on PATCH and allows explicitly clearing tags",async()=>{
    const c=await createChallenge(store.db,author,{...draft("Patch only the title"),tags:["weekly","training"],flagFormat:"dfCTF{answer}"});
    const patch=challengePatchInput.parse({title:"Renamed challenge"});
    expect(patch).toEqual({title:"Renamed challenge"});
    await editChallenge(store.db,author,c.id,patch);
    expect(await challengeDetail(store.db,author,c.id,true)).toMatchObject({title:"Renamed challenge",tags:["weekly","training"],flagFormat:"dfCTF{answer}"});
    await editChallenge(store.db,author,c.id,challengePatchInput.parse({tags:[]}));
    expect((await challengeDetail(store.db,author,c.id,true)).tags).toEqual([]);
    expect(challengePatchInput.safeParse({status:"published"}).success).toBe(false);
    expect(challengePatchInput.safeParse({status:"draft",title:"Mixed mutation"}).success).toBe(false);
    expect(challengePatchInput.safeParse({tags:[" "]}).success).toBe(false);
    const {tags:unused,...withoutTags}=draft("Default tags on creation");
    expect(challengeInput.parse(withoutTags).tags).toEqual([]);
  });
  it("lets owners and admins withdraw review, correct the draft, and request independent review again",async()=>{
    const c=await createChallenge(store.db,author,draft("Correct a failed review"));
    const file=await saveArtifact(store.db,author,c.id,"review.txt",Buffer.from(flag));
    await editChallenge(store.db,author,c.id,challengePatchInput.parse({status:"review"}));
    await expect(publishChallenge(store.db,reviewer,c.id,"dfCTF{wrong_flag}")).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    for(const viewer of [reviewer,learner,{...reviewer,role:"author" as const}]) {
      await expect(editChallenge(store.db,viewer,c.id,{status:"draft"})).rejects.toMatchObject({status:404});
    }
    await expect(editChallenge(store.db,author,c.id,{title:"Edit during review"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    expect(await editChallenge(store.db,author,c.id,{status:"draft"})).toMatchObject({status:"draft"});
    const corrected="dfCTF{corrected_review_flag}";
    await editChallenge(store.db,author,c.id,{title:"Corrected training case",flag:corrected});
    expect((await challengeDetail(store.db,author,c.id,true)).files.map(f=>f.id)).toEqual([file.id]);
    await expect(publishChallenge(store.db,reviewer,c.id,corrected)).rejects.toMatchObject({code:"INVALID_STATE"});
    await editChallenge(store.db,author,c.id,{status:"review"});
    await editChallenge(store.db,{...reviewer,role:"admin"},c.id,{status:"draft"});
    await editChallenge(store.db,author,c.id,{status:"review"});
    await expect(publishChallenge(store.db,reviewer,c.id,flag)).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    await expect(publishChallenge(store.db,{...author,role:"admin"},c.id,corrected)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await publishChallenge(store.db,reviewer,c.id,corrected);
    await expect(editChallenge(store.db,author,c.id,{status:"draft"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    await expect(editChallenge(store.db,{...reviewer,role:"admin"},c.id,{title:"Published edit"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    expect((await store.db.select().from(auditEvents).where(eq(auditEvents.targetId,c.id))).filter(e=>e.action==="challenge.withdraw_review")).toHaveLength(2);
  });
  it("persists a solve once under simultaneous correct requests",async()=>{
    const c=await ready("Concurrency award");const responses=await Promise.all([submitFlag(store.db,learner,c.id,flag,"concurrent-one"),submitFlag(store.db,learner,c.id,flag,"concurrent-two")]);
    expect(responses.map(x=>(x as {status:string}).status).sort()).toEqual(["already_solved","correct"]);
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,c.id))).toHaveLength(1);
    const records=await store.db.select().from(xpLedger);expect(records.filter(x=>x.userId===learner.id)).toHaveLength(1);
    expect((await getProgress(store.db,learner.id)).totalXp).toBe(50);
  });
  it("marks tried cases as attempted and drops archived solves from library counts",async()=>{
    const c=await ready("Archived after solve");await submitFlag(store.db,learner,c.id,"dfctf{first_guess}");
    expect((await challengeDetail(store.db,learner,c.id)).attempted).toBe(true);
    await submitFlag(store.db,learner,c.id,flag);const before=await getProgress(store.db,learner.id);
    await editChallenge(store.db,author,c.id,{status:"archived"});const after=await getProgress(store.db,learner.id);
    expect(after.solvedCount).toBe(before.solvedCount-1);expect(after.totalXp).toBe(before.totalXp);
    for(const cat of after.categories)expect(cat.solved).toBeLessThanOrEqual(cat.total);
  });
  it("replays idempotent requests and rejects reuse with different inputs",async()=>{
    const c=await ready("Idempotent retry");const first=await submitFlag(store.db,learner,c.id,flag,"same-request-key");
    const retry=await submitFlag(store.db,learner,c.id,flag,"same-request-key");expect(retry).toEqual(first);
    expect(await store.db.select().from(submissions).where(eq(submissions.challengeId,c.id))).toHaveLength(1);
    await expect(submitFlag(store.db,learner,c.id,"dfctf{different}","same-request-key")).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
  });
  it("does not award XP twice for variants from the same family",async()=>{
    const a=await ready("Family original"),b=await ready("Family variation");
    await store.db.update(challenges).set({familyId:a.id}).where(eq(challenges.id,b.id));
    expect((await submitFlag(store.db,learner,a.id,flag) as {xp:number}).xp).toBe(50);
    expect((await submitFlag(store.db,learner,b.id,flag) as {xp:number}).xp).toBe(0);
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,b.id))).toHaveLength(1);
  });
  it("rate-limits repeated guesses without awarding progress",async()=>{
    const c=await ready("Guess cooldown");for(let i=0;i<10;i++)expect((await submitFlag(store.db,learner,c.id,"dfctf{incorrect}") as {status:string}).status).toBe("incorrect");
    await expect(submitFlag(store.db,learner,c.id,"dfctf{incorrect}")).rejects.toMatchObject({status:429});expect(await store.db.select().from(solves).where(eq(solves.challengeId,c.id))).toHaveLength(0);
  });
  it("blocks foreign draft access and executable artifact disguises",async()=>{
    const c=await createChallenge(store.db,author,draft("Ownership check"));
    await expect(editChallenge(store.db,{...author,id:reviewer.id},c.id,{title:"Hijacked draft"})).rejects.toMatchObject({status:404});
    await expect(saveArtifact(store.db,author,c.id,"photo.png",Buffer.from("MZ executable"))).rejects.toMatchObject({code:"FILE_TYPE"});
  });
  it("matches flags exactly after whitespace trimming",()=>{
    const digest=flagDigest(flag);expect(matchesFlag(`  ${flag}\n`,digest)).toBe(true);expect(matchesFlag(flag.toUpperCase(),digest)).toBe(false);expect(matchesFlag(flag.slice(0,-1),digest)).toBe(false);
    expect(matchesFlag(flag.replace("dfCTF{","dfctf{"),digest)).toBe(true);expect(matchesFlag(flag.replace("dfCTF{","DFCTF{"),digest)).toBe(true);
  });
  it("accepts the current wrapper for legacy digests without changing the answer's case",()=>{
    const legacy=flag.replace("dfCTF{","dfctf{"),digest=flagDigest(legacy);
    for(const candidate of [legacy,flag,flag.replace("dfCTF{","DFCTF{")])expect(matchesFlag(`  ${candidate}\n`,digest)).toBe(true);
    expect(matchesFlag(flag.toUpperCase(),digest)).toBe(false);
    expect(matchesFlag(flag.replace("test_evidence","Test_evidence"),digest)).toBe(false);
  });
  it("requires a trusted origin on state changes",()=>{
    expect(()=>checkOrigin(new Request("http://localhost:3000/api/v1/me",{method:"PATCH",headers:{origin:"https://attacker.example","content-type":"application/json"}}))).toThrow();
    expect(()=>checkOrigin(new Request("http://localhost:3000/api/v1/me",{method:"PATCH",headers:{origin:"http://localhost:3000","content-type":"application/json"}}))).not.toThrow();
  });
  it("validates codenames and normalizes confusing spellings",()=>{
    expect(codenameKey("S0lver1")).toBe(codenameKey("solverl"));expect(codenameSchema.safeParse("admin").success).toBe(false);expect(codenameSchema.safeParse("hidden space").success).toBe(false);
  });
});
