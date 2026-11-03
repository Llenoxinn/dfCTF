import "../src/server/load-env";
import { randomBytes,randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb,closeDatabase } from "../src/server/db";
import { getAuth } from "../src/server/auth";
import { allowlist,user,challenges,challengeVersions } from "../src/server/schema";
import { createChallenge,publishChallenge } from "../src/server/challenges";
import { saveArtifact } from "../src/server/files";
import { createRulesChallenge, rulesChallenge } from "../src/server/rules-challenge";
import { editChallenge } from "../src/server/challenges";
import { codenameKey } from "../src/server/validation";
import type { Category,Viewer } from "../src/lib/types";
if(process.env.NODE_ENV==="production")throw new Error("Demo seeding is disabled in production. Use the admin CLI.");
if(process.env.DATABASE_URL&&!["localhost","127.0.0.1","::1","[::1]"].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error("Demo seeding only supports an embedded or loopback database.");
const db=await getDb(),auth=await getAuth();
const credentials:string[]=[];
async function account(email:string,codename:string,role:Viewer["role"]) {
  let [record]=await db.select().from(user).where(eq(user.email,email));
  if(!record){
    await db.insert(allowlist).values({id:randomUUID(),email}).onConflictDoNothing();
    const password=`dfCTF-1-${randomBytes(16).toString("base64url")}`;
    const result=await auth.api.signUpEmail({body:{name:"Private learner",email,password}});
    await db.update(user).set({emailVerified:true,codename,codenameKey:codenameKey(codename),role}).where(eq(user.id,result.user.id));
    [record]=await db.select().from(user).where(eq(user.id,result.user.id));
    credentials.push(`${role}: ${email}\nPassword: ${password}\n`);
  }
  return {id:record.id,email:record.email,codename:record.codename,emailVerified:true,role:record.role,twoFactorEnabled:record.twoFactorEnabled} satisfies Viewer;
}
const owner=await account("owner@dfctf.local","Llenoxinn","admin");
const learner=await account("learner@dfctf.local","new_operator","participant");
const reviewer=await account("reviewer@dfctf.local","content_review","reviewer");
const rules=await createRulesChallenge(db,owner);
if(rules.status==="draft")await editChallenge(db,owner,rules.id,{status:"review"});
if(rules.status==="draft"||rules.status==="review")await publishChallenge(db,reviewer,rules.id,rulesChallenge.flag);
type Seed={title:string;category:Category;summary:string;description:string;solution:string;flag:string;filename:string;data:string|Buffer;tags:string[];minutes:number;difficulty?:"Easy"|"Medium";xp?:number};
const examples:Seed[]=[
  {title:"First contact",category:"General skills",summary:"Every investigation starts with a closer look. Find your first flag in a field note.",description:"Your first assignment is deliberately small. Download the field note and open it with a text editor or the `cat` command.\n\nA flag is a piece of evidence wrapped in dfCTF{...}. Find the complete flag in the note and submit it exactly as written.\n\nEverything in this exercise is fictional. No outside services or accounts are needed.",solution:"Open field-note.txt in a text editor, or run `cat field-note.txt`. The last line contains the full flag. Copy it including the dfCTF{...} wrapper.\n\nThe core habit: inspect the supplied evidence before trying complicated tools.",flag:"dfCTF{curiosity_opens_doors_a7d4c82e}",filename:"field-note.txt",data:"dfCTF / Training field note\nCase 001: Orientation\nAll targets are fictional. Read the evidence carefully.\n\nRecovered evidence: dfCTF{curiosity_opens_doors_a7d4c82e}\n",tags:["onboarding","files","terminal"],minutes:5},
  {title:"A name in the metadata",category:"OSINT",summary:"A fictional campus photo export has one detail its author forgot to remove.",description:"A fictional campus newsletter exported a photo record as JSON. Your task is to inspect the metadata, find the private training note, and decode its contents.\n\nDownload photo-record.json. You can use a text editor and any local Base64 decoder. You do not need to visit a real website or identify a real person.",solution:"Open the JSON and locate metadata.training_note_base64. Decode that string from Base64. The decoded note is the flag.\n\nMetadata can expose details that are not visible in the primary content. Remove unnecessary metadata before publishing.",flag:"dfCTF{metadata_tells_a_story_b831f76a}",filename:"photo-record.json",data:JSON.stringify({campus:"Northbridge Institute (fictional)",file:"newsletter-07.jpg",metadata:{camera:"TrainingCam",training_note_base64:Buffer.from("dfCTF{metadata_tells_a_story_b831f76a}").toString("base64")}},null,2),tags:["metadata","base64","fictional-osint"],minutes:10},
  {title:"Beyond the pixels",category:"Steganography",summary:"The image is tiny. The file has a little more to say.",description:"A tiny image arrived with a suspiciously large file size. Inspect the bytes beyond its visible content.\n\nDownload quiet-pixel.png. Try a local `strings` command, a hex viewer, or opening a copy as text. The flag is readable data appended after the image.\n\nThis exercise does not require an image editing application.",solution:"Run `strings quiet-pixel.png` and inspect the output. A readable flag was appended after the normal PNG content. Image viewers usually ignore those trailing bytes.\n\nA file's visible rendering is only one view of its contents.",flag:"dfCTF{look_past_the_pixels_c84af209}",filename:"quiet-pixel.png",data:Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=","base64"),Buffer.from("\nTRAINING_EVIDENCE=dfCTF{look_past_the_pixels_c84af209}\n")]),tags:["strings","file-analysis","images"],minutes:10},
  {title:"The midnight request",category:"Forensics",summary:"Follow a request through a fictional access log and recover the encoded evidence.",description:"A fictional campus service recorded a request shortly after midnight. Read the supplied access log, locate the unusual `evidence` query parameter, and URL-decode its value.\n\nUse a text editor, a local script, or your browser's developer console. There are no live targets in this challenge.",solution:"Find the /training/export request and read the evidence parameter. URL-decode %7B and %7D to recover the braces around the flag.\n\nKeep original logs intact and work from a copy during an investigation.",flag:"dfCTF{follow_the_request_d2a791bc}",filename:"access.log",data:"2026-09-15T23:59:51Z 192.0.2.12 GET /health 200\n2026-09-16T00:02:04Z 192.0.2.30 GET /training/export?evidence=dfCTF%7Bfollow_the_request_d2a791bc%7D 200\n2026-09-16T00:03:11Z 192.0.2.12 GET /health 200\n",tags:["logs","url-encoding","investigation","weekly"],minutes:15},
  {title:"Cookie crumbs",category:"Web exploitation",summary:"A saved HTTP conversation shows why encoding is not encryption.",description:"Inspect a saved response from a fictional training app. The app places a Base64-encoded value in a cookie. Decode it to recover the flag.\n\nDownload response.txt and inspect the Set-Cookie header. You are analyzing a transcript, so no website needs to be attacked.",solution:"Extract the training_evidence cookie and Base64-decode it. Its contents reveal the flag.\n\nBase64 changes representation; it provides no confidentiality or integrity. Sensitive state belongs on the server or needs appropriate authenticated protection.",flag:"dfCTF{encoding_is_not_encryption_e93db174}",filename:"response.txt",data:`HTTP/1.1 200 OK\nContent-Type: text/plain\nSet-Cookie: training_evidence=${Buffer.from("dfCTF{encoding_is_not_encryption_e93db174}").toString("base64")}; Path=/\n\nFictional training response.\n`,tags:["http","cookies","base64"],minutes:15},
  {title:"Reading the stack",category:"Binary exploitation",summary:"Start with the bytes: reconstruct a message from a training debugger dump.",description:"Before exploiting memory bugs, learn to read a debugger's view of memory. A fictional training program copied an ASCII message onto its stack.\n\nDownload stack-dump.txt. Convert the hexadecimal byte values to text in the order shown. This is a preparation exercise; no executable or exploit is required.",solution:"Convert each two-character hexadecimal byte to its ASCII character, preserving byte order. The resulting string is the flag.\n\nThese are individual bytes, so do not reverse them as if they were multi-byte integer values.",flag:"dfCTF{read_the_bytes_f6a8043d}",filename:"stack-dump.txt",data:"Training debugger: bytes at stack buffer\n"+Buffer.from("dfCTF{read_the_bytes_f6a8043d}").toString("hex").match(/.{2}/g)!.join(" ")+"\n",tags:["hex","memory","preparation"],minutes:20},
  {title:"Out of order",category:"Miscellaneous",summary:"A scrambled evidence register becomes readable when you put its rows back in order.",description:"The rows of a fictional evidence register were shuffled. Sort them by the numeric sequence column, then join the character column without spaces.\n\nDownload evidence.csv. You can use a spreadsheet, a script, or sort the rows by hand. Sorting should treat sequence values as numbers rather than text.",solution:"Read the CSV rows, sort by the integer sequence field, and concatenate the character values. The reconstructed message is the flag.\n\nFor multi-digit positions, lexical sorting puts 10 before 2. Use numeric sorting.",flag:"dfCTF{order_from_noise_09a7f2cd}",filename:"evidence.csv",data:"sequence,character\n"+Array.from("dfCTF{order_from_noise_09a7f2cd}").map((c,i)=>({i:i+1,c})).sort((a,b)=>(a.i*17%31)-(b.i*17%31)).map(x=>`${x.i},${x.c}`).join("\n"),tags:["data","scripting","patterns"],minutes:20,difficulty:"Medium",xp:125}
];
for(const seed of examples){
  const [exists]=await db.select({id:challenges.id}).from(challenges).innerJoin(challengeVersions,eq(challengeVersions.challengeId,challenges.id)).where(eq(challengeVersions.title,seed.title));
  if(exists)continue;
  const draft=await createChallenge(db,owner,{title:seed.title,summary:seed.summary,description:seed.description,solution:seed.solution,category:seed.category,difficulty:seed.difficulty||"Easy",tags:seed.tags,xp:seed.xp||50,estimatedMinutes:seed.minutes,flag:seed.flag,flagFormat:"dfCTF{...}"});
  await saveArtifact(db,owner,draft.id,seed.filename,Buffer.isBuffer(seed.data)?seed.data:Buffer.from(seed.data));
  await db.update(challenges).set({status:"review"}).where(eq(challenges.id,draft.id));
  await publishChallenge(db,reviewer,draft.id,seed.flag);
}
if(credentials.length){await mkdir(".data",{recursive:true});await writeFile(".data/bootstrap.txt","dfCTF local development credentials — never use on a public server\n\n"+credentials.join("\n"),{mode:0o600,flag:"a"});}
console.log("Local seed complete: eight practice challenges, including Read the fine print. New credentials are in .data/bootstrap.txt.");
await closeDatabase();
