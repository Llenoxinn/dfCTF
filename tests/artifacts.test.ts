import { beforeAll,afterAll,afterEach,describe,it,expect,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp,readFile,writeFile,unlink,mkdir,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and,eq,sql } from "drizzle-orm";
import { createStore } from "@/server/db";
import { artifacts,artifactContents,auditEvents,challenges,challengeVersions,user } from "@/server/schema";
import { createChallenge,editChallenge,publishChallenge } from "@/server/challenges";
import { saveArtifact,removeArtifact,downloadArtifact } from "@/server/files";
import { challengeInput } from "@/server/validation";
import type { Viewer } from "@/lib/types";
import { MAX_ARTIFACT_BYTES } from "@/lib/artifacts";

let store:Awaited<ReturnType<typeof createStore>>,directory:string;
const author:Viewer={id:randomUUID(),email:"files-author@example.test",codename:"files_author",emailVerified:true,role:"author",twoFactorEnabled:true};
const admin:Viewer={...author,id:randomUUID(),email:"files-admin@example.test",codename:"files_admin",role:"admin"};
const reviewer:Viewer={...author,id:randomUUID(),email:"files-reviewer@example.test",codename:"files_reviewer",role:"reviewer"};
const stranger:Viewer={...author,id:randomUUID(),email:"files-stranger@example.test",codename:"files_stranger"};
const flag="dfCTF{artifact_test_only}";
async function draft(){return createChallenge(store.db,author,challengeInput.parse({title:"Artifact correction",summary:"A fictional upload correction exercise.",description:"Review the fictional evidence in the supplied file.",solution:"The supplied file contains the fictional test flag.",flag,visibility:"competition",category:"General skills",difficulty:"Easy",xp:25,estimatedMinutes:5}));}
async function upload(id:string){const file=await saveArtifact(store.db,author,id,"evidence.txt",Buffer.from("Fictional evidence"));const [record]=await store.db.select().from(artifacts).where(eq(artifacts.id,file.id));return {...file,location:path.join(directory,record.storageKey)};}
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-artifacts-"));process.env.ARTIFACT_DIR=directory;
  store=await createStore(process.env.TEST_DATABASE_URL,true);await store.migrate();
  for(const identity of [author,admin,reviewer,stranger])await store.db.insert(user).values({...identity,name:"Private test account"});
});
afterAll(async()=>{
  await store?.close();delete process.env.ARTIFACT_DIR;
  if(directory){expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));expect(path.basename(directory)).toMatch(/^dfctf-artifacts-/);await rm(directory,{recursive:true,force:true});}
});
afterEach(()=>vi.unstubAllEnvs());

describe("serverless artifacts",()=>{
  it.each([
    {vercel:"1",backup:"1"},
    {vercel:"",backup:"0"},
  ])("saves, downloads and removes files without a writable backup directory: %j",async({vercel,backup})=>{
    const blocked=path.join(directory,randomUUID());await writeFile(blocked,"Not a directory");
    vi.stubEnv("VERCEL",vercel);vi.stubEnv("ARTIFACT_LOCAL_BACKUP",backup);vi.stubEnv("ARTIFACT_DIR",blocked);
    const c=await draft(),bytes=Buffer.from("Database-only fictional evidence");
    const file=await saveArtifact(store.db,author,c.id,"evidence.txt",bytes);
    expect(Buffer.from(await (await downloadArtifact(store.db,author,c.id,file.id,true)).arrayBuffer())).toEqual(bytes);
    // A legacy record without database bytes cannot rely on an instance's local filesystem.
    await store.db.delete(artifactContents).where(eq(artifactContents.artifactId,file.id));
    await expect(downloadArtifact(store.db,author,c.id,file.id,true)).rejects.toMatchObject({status:404});
    await expect(removeArtifact(store.db,author,c.id,file.id)).resolves.toEqual({removed:true});
    expect(await readFile(blocked,"utf8")).toBe("Not a directory");
    expect(await store.db.select().from(artifacts).where(eq(artifacts.id,file.id))).toHaveLength(0);
  });
  it("accepts the 3 MiB boundary and rejects larger artifacts",async()=>{
    const c=await draft();
    const file=await saveArtifact(store.db,author,c.id,"limit.txt",Buffer.alloc(MAX_ARTIFACT_BYTES,97));
    expect(file.size).toBe(3*1024*1024);
    await expect(saveArtifact(store.db,author,c.id,"oversized.txt",Buffer.alloc(MAX_ARTIFACT_BYTES+1,97))).rejects.toMatchObject({code:"INVALID_FILE"});
    await removeArtifact(store.db,author,c.id,file.id);
  });
});

describe("draft artifact removal",()=>{
  it("removes the owner's draft file and private bytes, audits it, and allows review without files",async()=>{
    const c=await draft(),file=await upload(c.id);
    expect(await removeArtifact(store.db,author,c.id,file.id)).toEqual({removed:true});
    expect(await store.db.select().from(artifacts).where(eq(artifacts.id,file.id))).toHaveLength(0);
    expect(await store.db.select().from(artifactContents).where(eq(artifactContents.artifactId,file.id))).toHaveLength(0);
    await expect(readFile(file.location)).rejects.toMatchObject({code:"ENOENT"});
    await expect(downloadArtifact(store.db,author,c.id,file.id,true)).rejects.toMatchObject({status:404});
    expect(await store.db.select().from(auditEvents).where(and(eq(auditEvents.action,"artifact.remove"),eq(auditEvents.targetId,c.id)))).toEqual([expect.objectContaining({actorId:author.id,targetId:c.id,metadata:{fileId:file.id}})]);
    await expect(editChallenge(store.db,author,c.id,{status:"review"})).resolves.toMatchObject({status:"review"});
  });
  it("allows an admin but rejects another author, reviewers, and participants",async()=>{
    const c=await draft(),file=await upload(c.id);
    for(const viewer of [stranger,reviewer,{...author,role:"participant" as const}])await expect(removeArtifact(store.db,viewer,c.id,file.id)).rejects.toMatchObject({status:404});
    expect(await readFile(file.location,"utf8")).toBe("Fictional evidence");
    await expect(removeArtifact(store.db,admin,c.id,file.id)).resolves.toEqual({removed:true});
  });
  it("rejects review, published, archived, and locked versions without deleting bytes",async()=>{
    for(const status of ["review","published","archived"] as const){
      const c=await draft(),file=await upload(c.id);
      await store.db.update(challenges).set({status}).where(eq(challenges.id,c.id));
      await expect(removeArtifact(store.db,author,c.id,file.id)).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
      expect(await readFile(file.location,"utf8")).toBe("Fictional evidence");
    }
    const c=await draft(),file=await upload(c.id);
    await store.db.update(challengeVersions).set({locked:true}).where(eq(challengeVersions.challengeId,c.id));
    await expect(removeArtifact(store.db,admin,c.id,file.id)).rejects.toMatchObject({code:"IMMUTABLE_VERSION"});
    expect(await readFile(file.location,"utf8")).toBe("Fictional evidence");
  });
  it("rejects another challenge's file, an earlier version's file, and invalid storage keys",async()=>{
    const a=await draft(),b=await draft(),file=await upload(a.id);
    await expect(removeArtifact(store.db,author,b.id,file.id)).rejects.toMatchObject({status:404});
    const [version]=await store.db.select().from(challengeVersions).where(eq(challengeVersions.challengeId,a.id));
    await store.db.insert(challengeVersions).values({...version,id:randomUUID(),version:2});
    await store.db.update(challenges).set({currentVersion:2}).where(eq(challenges.id,a.id));
    await expect(removeArtifact(store.db,author,a.id,file.id)).rejects.toMatchObject({status:404});
    await store.db.update(challenges).set({currentVersion:1}).where(eq(challenges.id,a.id));
    await store.db.update(artifacts).set({storageKey:"../outside.txt"}).where(eq(artifacts.id,file.id));
    await expect(removeArtifact(store.db,author,a.id,file.id)).rejects.toMatchObject({status:404});
    expect(await readFile(file.location,"utf8")).toBe("Fictional evidence");
    expect(await store.db.select().from(artifacts).where(eq(artifacts.id,file.id))).toHaveLength(1);
  });
  it("finishes metadata removal when bytes are already missing and reports an inaccessible cleanup failure",async()=>{
    const c=await draft(),missing=await upload(c.id);await unlink(missing.location);
    await expect(removeArtifact(store.db,author,c.id,missing.id)).resolves.toEqual({removed:true});
    const blocked=await upload(c.id);await unlink(blocked.location);await mkdir(blocked.location);
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      await expect(removeArtifact(store.db,author,c.id,blocked.id)).resolves.toEqual({removed:true});
      expect(log).toHaveBeenCalledWith(expect.stringContaining('"action":"artifact.cleanup"'));
      expect(await store.db.select().from(artifacts).where(eq(artifacts.id,blocked.id))).toHaveLength(0);
      await expect(downloadArtifact(store.db,author,c.id,blocked.id,true)).rejects.toMatchObject({status:404});
    } finally {log.mockRestore();}
  });
  it("retains the file and its metadata when the removal transaction fails",async()=>{
    const c=await draft(),file=await upload(c.id);
    await store.db.execute(sql`alter table audit_events add constraint artifact_remove_failure check (action <> 'artifact.remove') not valid`);
    try {
      await expect(removeArtifact(store.db,author,c.id,file.id)).rejects.toThrow();
      expect(await store.db.select().from(artifacts).where(eq(artifacts.id,file.id))).toHaveLength(1);
      expect(await readFile(file.location,"utf8")).toBe("Fictional evidence");
    } finally {await store.db.execute(sql`alter table audit_events drop constraint artifact_remove_failure`);}
  });
  it("serializes removal with review so publication cannot retain a removed file",async()=>{
    const c=await draft(),file=await upload(c.id);
    const results=await Promise.allSettled([removeArtifact(store.db,author,c.id,file.id),editChallenge(store.db,author,c.id,{status:"review"})]);
    expect(results[1]).toMatchObject({status:"fulfilled",value:{status:"review"}});
    const [current]=await store.db.select().from(challenges).where(eq(challenges.id,c.id));
    expect(current.status).toBe("review");
    await publishChallenge(store.db,reviewer,c.id,flag);
    if(results[0].status==="rejected"){
      expect(results[0].reason).toMatchObject({code:"IMMUTABLE_VERSION"});
      expect(await (await downloadArtifact(store.db,author,c.id,file.id,true)).text()).toBe("Fictional evidence");
    } else {
      expect(await store.db.select().from(artifacts).where(eq(artifacts.id,file.id))).toHaveLength(0);
      await expect(downloadArtifact(store.db,author,c.id,file.id,true)).rejects.toMatchObject({status:404});
      await expect(readFile(file.location)).rejects.toMatchObject({code:"ENOENT"});
    }
  });
});
