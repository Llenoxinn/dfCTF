import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import { user,challenges,challengeVersions,solves,xpLedger,auditEvents,artifacts,artifactContents } from "@/server/schema";
import { createChallenge,editChallenge,publishChallenge,challengeDetail,submitFlag,getProgress,listChallenges,consumeLimit } from "@/server/challenges";
import { saveArtifact,removeArtifact,downloadArtifact } from "@/server/files";
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
const admin:Viewer={...author,id:randomUUID(),email:"admin@example.test",codename:"admin_one",role:"admin"};
const learner:Viewer={...author,id:randomUUID(),email:"learner@example.test",codename:"learner_one",role:"participant",twoFactorEnabled:false};
const flag="dfCTF{test_evidence_d8f19a27}";
function draft(title:string){return challengeInput.parse({title,summary:"A fictional training exercise.",description:"Inspect the training file and recover its flag.",solution:"Open the supplied file and copy the flag including its wrapper.",flag,category:"General skills",difficulty:"Easy",xp:50,estimatedMinutes:5,tags:["training"]});}
async function ready(title:string){const record=await createChallenge(store.db,author,draft(title));await saveArtifact(store.db,author,record.id,"evidence.txt",Buffer.from(flag));await editChallenge(store.db,author,record.id,{status:"review"});await publishChallenge(store.db,reviewer,record.id,flag);return record;}
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-practice-"));process.env.ARTIFACT_DIR=directory;store=await createStore(undefined,true);await store.migrate();for(const v of [author,reviewer,admin,learner])await store.db.insert(user).values({...v,name:"Private account"});});
afterAll(async()=>{await store?.close();await rm(directory,{recursive:true,force:true});delete process.env.ARTIFACT_DIR;});
describe("private practice integrity",()=>{
  it("preserves the first publication date when revising an old weekly challenge",async()=>{
    const old=await createChallenge(store.db,author,{...draft("Old weekly publication"),tags:["weekly"]});
    expect((await store.db.select().from(challenges).where(eq(challenges.id,old.id)))[0].publishedAt).toBeNull();
    await editChallenge(store.db,author,old.id,{status:"review"});await publishChallenge(store.db,reviewer,old.id,flag);
    expect((await store.db.select().from(challenges).where(eq(challenges.id,old.id)))[0].publishedAt).toBeInstanceOf(Date);
    const original=new Date(Date.now()-60*86_400_000);
    await store.db.update(challenges).set({publishedAt:original}).where(eq(challenges.id,old.id));
    const current=await createChallenge(store.db,author,{...draft("Current weekly publication"),tags:["weekly"]});
    await editChallenge(store.db,author,current.id,{status:"review"});await publishChallenge(store.db,reviewer,current.id,flag);
    await editChallenge(store.db,admin,old.id,{title:"Corrected old weekly publication"});
    expect((await store.db.select().from(challenges).where(eq(challenges.id,old.id)))[0].publishedAt).toEqual(original);
    await publishChallenge(store.db,reviewer,old.id,flag);
    expect((await store.db.select().from(challenges).where(eq(challenges.id,old.id)))[0].publishedAt).toEqual(original);
    const library=await listChallenges(store.db,learner.id);
    expect(library.find(c=>c.id===old.id)?.weeklyEndsAt).toBeUndefined();
    expect(library.find(c=>c.id===current.id)?.weeklyEndsAt).toBeDefined();
    expect((await getCommunity(store.db)).weekly?.id).toBe(current.id);
    expect((await challengeDetail(store.db,learner,old.id)).weeklyEndsAt).toBeUndefined();
  });
  it("downloads database-backed files without a local copy and supports legacy local files",async()=>{
    const shared=await ready("Shared artifact storage");
    const detail=await challengeDetail(store.db,learner,shared.id);
    const fileId=detail.files[0].id;
    const [file]=await store.db.select().from(artifacts).where(eq(artifacts.id,fileId));
    const [content]=await store.db.select().from(artifactContents).where(eq(artifactContents.artifactId,fileId));
    expect(content.content.equals(Buffer.from(flag))).toBe(true);
    await rm(path.join(directory,file.storageKey));
    expect(await (await downloadArtifact(store.db,learner,shared.id,fileId)).text()).toBe(flag);

    const legacy=await ready("Legacy artifact storage");
    const legacyDetail=await challengeDetail(store.db,learner,legacy.id);
    await store.db.delete(artifactContents).where(eq(artifactContents.artifactId,legacyDetail.files[0].id));
    expect(await (await downloadArtifact(store.db,learner,legacy.id,legacyDetail.files[0].id)).text()).toBe(flag);
  });
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
  it("lets independent reviewers correct content and files, save in review, and publish the updated challenge",async()=>{
    const c=await createChallenge(store.db,author,draft("Reviewer corrections"));
    const original=await saveArtifact(store.db,author,c.id,"original.txt",Buffer.from("Original fictional evidence"));
    await expect(editChallenge(store.db,reviewer,c.id,{title:"Too early"})).rejects.toMatchObject({status:404});
    await expect(saveArtifact(store.db,reviewer,c.id,"early.txt",Buffer.from("Too early"))).rejects.toMatchObject({status:404});
    await editChallenge(store.db,author,c.id,{status:"review"});
    const corrected="dfCTF{reviewer_corrected_fixture}";
    expect(await editChallenge(store.db,reviewer,c.id,challengePatchInput.parse({title:"Corrected by reviewer",description:"Review the corrected fictional evidence file.",flag:corrected,tags:["reviewed"]}))).toMatchObject({status:"review"});
    await removeArtifact(store.db,reviewer,c.id,original.id);
    const file=await saveArtifact(store.db,reviewer,c.id,"corrected.txt",Buffer.from(corrected));
    expect(await (await downloadArtifact(store.db,reviewer,c.id,file.id,true)).text()).toBe(corrected);
    expect(await challengeDetail(store.db,reviewer,c.id,true)).toMatchObject({status:"review",title:"Corrected by reviewer",authorId:author.id,tags:["reviewed"],files:[{id:file.id}]});
    await expect(publishChallenge(store.db,reviewer,c.id,flag)).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    await publishChallenge(store.db,reviewer,c.id,corrected);
    expect(await challengeDetail(store.db,learner,c.id)).toMatchObject({status:"published",title:"Corrected by reviewer"});
    expect((await store.db.select().from(auditEvents).where(eq(auditEvents.targetId,c.id))).filter(e=>e.actorId===reviewer.id).map(e=>e.action)).toEqual(["challenge.edit","artifact.remove","artifact.upload","challenge.publish"]);
    for(const viewer of [reviewer]) {
      await expect(editChallenge(store.db,viewer,c.id,{title:"Late edit"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
      await expect(saveArtifact(store.db,viewer,c.id,"late.txt",Buffer.from("Late edit"))).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
      await expect(removeArtifact(store.db,viewer,c.id,file.id)).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    }
  });
  it("keeps review editing separate from ownership, lifecycle changes, and locked versions",async()=>{
    const c=await createChallenge(store.db,author,draft("Review boundaries"));
    const file=await saveArtifact(store.db,author,c.id,"evidence.txt",Buffer.from(flag));
    await editChallenge(store.db,author,c.id,{status:"review"});
    for(const viewer of [learner,{...reviewer,role:"author" as const},{...author,role:"reviewer" as const}]) {
      await expect(editChallenge(store.db,viewer,c.id,{title:"Forbidden correction"})).rejects.toMatchObject({status:404});
      await expect(saveArtifact(store.db,viewer,c.id,"forbidden.txt",Buffer.from("Forbidden"))).rejects.toMatchObject({status:404});
      await expect(removeArtifact(store.db,viewer,c.id,file.id)).rejects.toMatchObject({status:404});
    }
    for(const status of ["draft","review","archived"])await expect(editChallenge(store.db,reviewer,c.id,{status})).rejects.toMatchObject({status:404});
    await expect(createChallenge(store.db,reviewer,draft("Reviewer creation"))).rejects.toMatchObject({status:403});
    await expect(publishChallenge(store.db,{...author,role:"reviewer"},c.id,flag)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await expect(editChallenge(store.db,{...reviewer,role:"admin"},c.id,{solution:"The corrected walkthrough still explains the intended approach."})).resolves.toMatchObject({status:"review"});
    await store.db.update(challengeVersions).set({locked:true}).where(eq(challengeVersions.challengeId,c.id));
    await expect(editChallenge(store.db,reviewer,c.id,{title:"Locked review"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    await expect(removeArtifact(store.db,reviewer,c.id,file.id)).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    await store.db.update(challenges).set({status:"archived"}).where(eq(challenges.id,c.id));
    await expect(editChallenge(store.db,reviewer,c.id,{title:"Archived review"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
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
    await expect(editChallenge(store.db,{...reviewer,role:"admin"},c.id,{title:"Published edit"})).resolves.toMatchObject({status:"review"});
    expect((await store.db.select().from(auditEvents).where(eq(auditEvents.targetId,c.id))).filter(e=>e.action==="challenge.withdraw_review")).toHaveLength(2);
  });
  it("revises every published field without rewriting solved versions, and requires another reviewer",async()=>{
    const c=await ready("Administrator revision");
    const original=await challengeDetail(store.db,admin,c.id,true);
    const revisedFlag="dfCTF{administrator_revision}";
    const patch={title:"Revised title",description:"A completely revised fictional challenge description.",solution:"A completely revised walkthrough for the new fictional evidence.",category:"Forensics" as const,difficulty:"Hard" as const,tags:["revised"],xp:125,estimatedMinutes:30,flag:revisedFlag,flagFormat:"dfCTF{revised_answer}",visibility:"competition" as const};
    await expect(editChallenge(store.db,admin,c.id,patch)).resolves.toMatchObject({status:"review"});
    const detail=await challengeDetail(store.db,admin,c.id,true);
    const {flag:secret,...expected}=patch;
    expect(detail).toMatchObject({...expected,version:2,status:"review",canPublish:false,authorId:author.id});
    expect(detail).not.toHaveProperty("flag");
    expect(detail.files[0].id).not.toBe(original.files[0].id);
    expect(await (await downloadArtifact(store.db,admin,c.id,detail.files[0].id,true)).text()).toBe(flag);
    await expect(challengeDetail(store.db,learner,c.id)).rejects.toMatchObject({status:404});
    await expect(publishChallenge(store.db,admin,c.id,revisedFlag)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await expect(publishChallenge(store.db,reviewer,c.id,flag)).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    await publishChallenge(store.db,reviewer,c.id,revisedFlag);
    const versions=await store.db.select().from(challengeVersions).where(eq(challengeVersions.challengeId,c.id));
    expect(versions.find(v=>v.version===1)).toMatchObject({title:original.title,xp:50,locked:true});
    expect(versions.find(v=>v.version===2)).toMatchObject({title:patch.title,xp:125,locked:true});
    expect(await downloadArtifact(store.db,admin,c.id,detail.files[0].id,true)).toBeInstanceOf(Response);
  });
  it("requires fresh review for file-only revisions, preserves old files, and supports archived problems",async()=>{
    const c=await ready("File-only revision");
    const publishedAt=new Date(Date.now()-60*86_400_000);
    await store.db.update(challenges).set({publishedAt}).where(eq(challenges.id,c.id));
    const original=await challengeDetail(store.db,admin,c.id,true);
    await removeArtifact(store.db,admin,c.id,original.files[0].id);
    expect(await challengeDetail(store.db,admin,c.id,true)).toMatchObject({version:2,status:"review",files:[],canPublish:false});
    expect((await store.db.select().from(challenges).where(eq(challenges.id,c.id)))[0].publishedAt).toEqual(publishedAt);
    expect(await store.db.select().from(artifacts).where(eq(artifacts.id,original.files[0].id))).toHaveLength(1);
    const added=await saveArtifact(store.db,admin,c.id,"replacement.txt",Buffer.from(flag));
    await expect(publishChallenge(store.db,admin,c.id,flag)).rejects.toMatchObject({code:"SELF_REVIEW"});
    await publishChallenge(store.db,reviewer,c.id,flag);
    expect((await store.db.select().from(challenges).where(eq(challenges.id,c.id)))[0].publishedAt).toEqual(publishedAt);
    await editChallenge(store.db,admin,c.id,{status:"archived"});
    await saveArtifact(store.db,admin,c.id,"extra.txt",Buffer.from("New fictional evidence"));
    expect((await store.db.select().from(challenges).where(eq(challenges.id,c.id)))[0].publishedAt).toEqual(publishedAt);
    const revised=await challengeDetail(store.db,admin,c.id,true);
    expect(revised).toMatchObject({version:3,status:"review",canPublish:false});
    expect(revised.files.map(f=>f.name).sort()).toEqual(["extra.txt","replacement.txt"]);
    expect(await store.db.select().from(artifacts).where(eq(artifacts.id,added.id))).toHaveLength(1);
    await publishChallenge(store.db,reviewer,c.id,flag);
    expect((await store.db.select().from(challenges).where(eq(challenges.id,c.id)))[0].publishedAt).toEqual(publishedAt);
  });
  it("keeps a learner's existing solve and points through repeated revisions",async()=>{
    const c=await ready("Solved revision history"), player={...learner,id:randomUUID(),email:"revision-player@example.test",codename:"revision_player"};
    await store.db.insert(user).values({...player,name:"Revision player"});
    await submitFlag(store.db,player,c.id,flag);
    const before=await getProgress(store.db,player.id);
    for(let version=2;version<=3;version++) {
      await editChallenge(store.db,admin,c.id,{title:`Revised history ${version}`,xp:200});
      await expect(submitFlag(store.db,player,c.id,flag)).rejects.toMatchObject({status:404});
      await publishChallenge(store.db,reviewer,c.id,flag);
    }
    expect(await getProgress(store.db,player.id)).toMatchObject({totalXp:50,solvedCount:1,recentSolves:before.recentSolves});
    expect(await submitFlag(store.db,player,c.id,flag)).toMatchObject({status:"already_solved",xp:0});
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,c.id))).toHaveLength(1);
  });
  it("persists a solve once under simultaneous correct requests",async()=>{
    const c=await ready("Concurrency award");const responses=await Promise.all([submitFlag(store.db,learner,c.id,flag),submitFlag(store.db,learner,c.id,flag)]);
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
