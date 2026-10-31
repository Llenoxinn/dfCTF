import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { artifacts, artifactContents, challenges } from "./schema";
import type { Database } from "./db";
import { audit, challengeRecord } from "./challenges";
import { HttpError } from "./http";
import type { Viewer } from "@/lib/types";
import { requireCompetitionChallenge } from "./competition-access";
import { MAX_ARTIFACT_BYTES, ARTIFACT_SIZE_LABEL } from "@/lib/artifacts";

export { MAX_ARTIFACT_BYTES } from "@/lib/artifacts";

const types=new Set([".txt",".csv",".json",".log",".pcap",".zip",".png",".jpg",".jpeg",".pdf"]);
function artifactBackupsEnabled() {
  return process.env.VERCEL !== "1" && process.env.ARTIFACT_LOCAL_BACKUP !== "0";
}
function artifactPath(key:string) {
  if(!/^[a-f0-9-]{36}$/.test(key))throw new HttpError(404,"NOT_FOUND","File unavailable.");
  return path.join(path.resolve(process.env.ARTIFACT_DIR||".data/artifacts"),key);
}
export async function saveArtifact(db:Database,viewer:Viewer,id:string,name:string,bytes:Buffer) {
  if(bytes.length>MAX_ARTIFACT_BYTES||bytes.length===0)throw new HttpError(422,"INVALID_FILE",`Choose a non-empty file up to ${ARTIFACT_SIZE_LABEL}.`);
  const safeName=path.basename(name.replace(/\\/g,"/")).replace(/[\x00-\x1f\x7f]/g,"").slice(0,120);
  const ext=path.extname(safeName).toLowerCase();
  if(!types.has(ext))throw new HttpError(422,"FILE_TYPE","Use a supported downloadable artifact type.");
  // The first MVP accepts inert data and common forensic containers; never executable formats.
  if(bytes.subarray(0,2).equals(Buffer.from("MZ"))||bytes.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])))throw new HttpError(422,"FILE_TYPE","Executable artifacts are not supported in this release.");
  if(ext===".png"&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new HttpError(422,"FILE_TYPE","This file is not a valid PNG.");
  if([".jpg",".jpeg"].includes(ext)&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw new HttpError(422,"FILE_TYPE","This file is not a valid JPEG.");
  if(ext===".pdf"&&bytes.subarray(0,5).toString()!=="%PDF-")throw new HttpError(422,"FILE_TYPE","This file is not a valid PDF.");
  if(ext===".zip"&&!(bytes[0]===80&&bytes[1]===75&&[3,5,7].includes(bytes[2])))throw new HttpError(422,"FILE_TYPE","This file is not a valid ZIP.");
  if([".txt",".csv",".json",".log"].includes(ext)&&bytes.includes(0))throw new HttpError(422,"FILE_TYPE","Text artifacts cannot contain binary data.");
  if(ext===".json"){try{JSON.parse(bytes.toString("utf8"));}catch{throw new HttpError(422,"FILE_TYPE","This file is not valid JSON.");}}
  const storageKey=randomUUID(),location=artifactBackupsEnabled()?artifactPath(storageKey):null;
  if(location){await mkdir(path.dirname(location),{recursive:true});await writeFile(location,bytes,{flag:"wx"});}
  try {
    return await db.transaction(async tx=>{
      await tx.select().from(challenges).where(eq(challenges.id,id)).for("update");
      const row=await challengeRecord(tx,id);
      if(!["author","admin"].includes(viewer.role)||(viewer.role==="author"&&row.challenge.authorId!==viewer.id))throw new HttpError(404,"NOT_FOUND","This draft is unavailable.");
      if(row.challenge.status!=="draft"||row.version.locked)throw new HttpError(409,"IMMUTABLE_VERSION","Files can only be added to an unlocked draft.");
      const file={id:randomUUID(),versionId:row.version.id,name:safeName,storageKey,size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
      await tx.insert(artifacts).values(file);
      await tx.insert(artifactContents).values({artifactId:file.id,content:bytes});
      await audit(tx,viewer.id,"artifact.upload",id,{fileId:file.id,size:file.size,sha256:file.sha256});
      return {id:file.id,name:file.name,size:file.size,sha256:file.sha256};
    });
  } catch(error) {if(location)await unlink(location).catch(()=>{});throw error;}
}
export async function removeArtifact(db:Database,viewer:Viewer,id:string,fileId:string) {
  const location=await db.transaction(async tx=>{
    await tx.select().from(challenges).where(eq(challenges.id,id)).for("update");
    const row=await challengeRecord(tx,id);
    if(!["author","admin"].includes(viewer.role)||(viewer.role==="author"&&row.challenge.authorId!==viewer.id))throw new HttpError(404,"NOT_FOUND","This draft is unavailable.");
    if(row.challenge.status!=="draft"||row.version.locked)throw new HttpError(409,"IMMUTABLE_VERSION","Files can only be removed from an unlocked draft.");
    const [file]=await tx.select().from(artifacts).where(and(eq(artifacts.id,fileId),eq(artifacts.versionId,row.version.id)));
    if(!file)throw new HttpError(404,"NOT_FOUND","File unavailable.");
    const location=artifactPath(file.storageKey);
    await tx.delete(artifacts).where(eq(artifacts.id,fileId));
    await audit(tx,viewer.id,"artifact.remove",id,{fileId});
    return artifactBackupsEnabled()?location:null;
  });
  // Commit first so a failed transaction cannot leave a published file missing.
  try {if(location)await unlink(location);} catch(error) {
    if(!(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")) {
      // shortcut: failed cleanup leaves an inaccessible orphan; add retries if storage errors recur.
      console.error(JSON.stringify({level:"error",action:"artifact.cleanup",fileId,errorType:error instanceof Error?error.name:"Unknown"}));
    }
  }
  return {removed:true};
}
export async function downloadArtifact(db:Database,viewer:Viewer,id:string,fileId:string,staff=false,competitionId?:string) {
  const row=await challengeRecord(db,id);
  if(competitionId)await requireCompetitionChallenge(db,viewer,id,competitionId);
  if(staff){if(!["author","reviewer","admin"].includes(viewer.role)||(viewer.role==="author"&&row.challenge.authorId!==viewer.id))throw new HttpError(404,"NOT_FOUND","File unavailable.");}
  else if(row.challenge.status!=="published"||(!competitionId&&row.challenge.visibility!=="practice"))throw new HttpError(404,"NOT_FOUND","File unavailable.");
  const [file]=await db.select().from(artifacts).where(and(eq(artifacts.id,fileId),eq(artifacts.versionId,row.version.id)));
  if(!file)throw new HttpError(404,"NOT_FOUND","File unavailable.");
  const [stored]=await db.select({content:artifactContents.content}).from(artifactContents).where(eq(artifactContents.artifactId,file.id));
  let bytes:Buffer;
  if(stored)bytes=stored.content;
  else {
    if(!artifactBackupsEnabled())throw new HttpError(404,"NOT_FOUND","This file is temporarily unavailable.");
    try{bytes=await readFile(artifactPath(file.storageKey));}catch{throw new HttpError(404,"NOT_FOUND","This file is temporarily unavailable.");}
  }
  if(bytes.length!==file.size||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new HttpError(404,"NOT_FOUND","This file is temporarily unavailable.");
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Content-Length":String(bytes.length),"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Content-Security-Policy":"sandbox; default-src 'none'"}});
}
