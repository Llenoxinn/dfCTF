import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import { user,challenges,solves,xpLedger,submissions,requestResults } from "@/server/schema";
import { createChallenge,editChallenge,publishChallenge,challengeDetail,submitFlag,getProgress,listChallenges,consumeLimit } from "@/server/challenges";
import { saveArtifact,downloadArtifact } from "@/server/files";
import { flagDigest,matchesFlag } from "@/server/flags";
import { challengeInput,codenameSchema,codenameKey } from "@/server/validation";
import { checkOrigin } from "@/server/http";
import type { Viewer } from "@/lib/types";
import { mkdtemp,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let store:Awaited<ReturnType<typeof createStore>>,directory:string;
const author:Viewer={id:randomUUID(),email:"author@example.test",codename:"author_one",emailVerified:true,role:"author",twoFactorEnabled:true};
const reviewer:Viewer={...author,id:randomUUID(),email:"reviewer@example.test",codename:"reviewer_one",role:"reviewer"};
const learner:Viewer={...author,id:randomUUID(),email:"learner@example.test",codename:"learner_one",role:"participant",twoFactorEnabled:false};
const flag="dfctf{test_evidence_d8f19a27}";
function draft(title:string){return challengeInput.parse({title,summary:"A fictional training exercise.",description:"Inspect the training file and recover its flag.",solution:"Open the supplied file and copy the flag including its wrapper.",flag,category:"General skills",difficulty:"Easy",xp:50,estimatedMinutes:5,tags:["training"]});}
async function ready(title:string){const record=await createChallenge(store.db,author,draft(title));await saveArtifact(store.db,author,record.id,"evidence.txt",Buffer.from(flag));await editChallenge(store.db,author,record.id,{status:"review"});await publishChallenge(store.db,reviewer,record.id,flag);return record;}
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-practice-"));process.env.ARTIFACT_DIR=directory;store=await createStore(undefined,true);await store.migrate();for(const v of [author,reviewer,learner])await store.db.insert(user).values({...v,name:"Private account"});});
afterAll(async()=>{await store?.close();await rm(directory,{recursive:true,force:true});delete process.env.ARTIFACT_DIR;});
describe("private practice integrity",()=>{
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
    await expect(publishChallenge(store.db,reviewer,c.id,"dfctf{wrong_flag}")).rejects.toMatchObject({code:"REVIEW_FLAG_INCORRECT"});
    await publishChallenge(store.db,reviewer,c.id,flag);await expect(editChallenge(store.db,author,c.id,{title:"Changed after publication"})).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
  });
  it("persists a solve once under simultaneous correct requests",async()=>{
    const c=await ready("Concurrency award");const responses=await Promise.all([submitFlag(store.db,learner,c.id,flag,"concurrent-one"),submitFlag(store.db,learner,c.id,flag,"concurrent-two")]);
    expect(responses.map(x=>(x as {status:string}).status).sort()).toEqual(["already_solved","correct"]);
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,c.id))).toHaveLength(1);
    const records=await store.db.select().from(xpLedger);expect(records.filter(x=>x.userId===learner.id)).toHaveLength(1);
    expect((await getProgress(store.db,learner.id)).totalXp).toBe(50);
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
  });
  it("requires a trusted origin on state changes",()=>{
    expect(()=>checkOrigin(new Request("http://localhost:3000/api/v1/me",{method:"PATCH",headers:{origin:"https://attacker.example","content-type":"application/json"}}))).toThrow();
    expect(()=>checkOrigin(new Request("http://localhost:3000/api/v1/me",{method:"PATCH",headers:{origin:"http://localhost:3000","content-type":"application/json"}}))).not.toThrow();
  });
  it("validates codenames and normalizes confusing spellings",()=>{
    expect(codenameKey("S0lver1")).toBe(codenameKey("solverl"));expect(codenameSchema.safeParse("admin").success).toBe(false);expect(codenameSchema.safeParse("hidden space").success).toBe(false);
  });
});
