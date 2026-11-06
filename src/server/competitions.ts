import { randomUUID } from "node:crypto";
import { and, eq, ne, inArray, count, sum } from "drizzle-orm";
import { z } from "zod";
import type { Competition, CompetitionDetail, ChallengeSummary, Category, Difficulty, Viewer } from "@/lib/types";
import type { Database } from "./db";
import { competitions, competitionChallenges, competitionRegistrations, competitionSolves, competitionSubmissions, challenges, challengeVersions, user } from "./schema";
import { HttpError } from "./http";
import { audit, challengeDetail, challengeRecord, consumeLimit } from "./challenges";
import { requireCompetitionChallenge } from "./competition-access";
import { rankStandings } from "./community";
import { flagDigest, matchesFlag } from "./flags";
import { notSuspended } from "./player-eligibility";

const externalUrl = z.url().max(2000).refine(value => { const url=new URL(value); return url.protocol==="https:"&&!url.username&&!url.password; },"Use an HTTPS event URL without embedded credentials.");
export const competitionInput = z.object({
  title:z.string().trim().min(3).max(100), description:z.string().trim().min(20).max(10000), rules:z.string().trim().max(10000).default(""),
  platform:z.enum(["dfctf","ctfd"]), externalUrl:externalUrl.nullable().default(null),
  startsAt:z.iso.datetime({offset:true}).transform(value=>new Date(value)), endsAt:z.iso.datetime({offset:true}).transform(value=>new Date(value)),
  selections:z.array(z.object({challengeId:z.string().min(1).max(100),points:z.number().int().min(1).max(10000)}).strict()).max(100).default([]),
}).strict().superRefine((value,ctx)=>{
  if(value.endsAt<=value.startsAt)ctx.addIssue({code:"custom",path:["endsAt"],message:"End time must be after the start time."});
  if(new Set(value.selections.map(c=>c.challengeId)).size!==value.selections.length)ctx.addIssue({code:"custom",path:["selections"],message:"Choose each challenge once."});
  if(value.platform==="ctfd"&&(!value.externalUrl||value.selections.length))ctx.addIssue({code:"custom",path:["externalUrl"],message:"CTFd events need a host URL and use the host’s own challenges."});
  if(value.platform==="dfctf"&&value.externalUrl)ctx.addIssue({code:"custom",path:["externalUrl"],message:"Built-in events do not use an external URL."});
});
export const competitionPatchInput = z.union([z.object({status:z.enum(["published","archived"])}).strict(),competitionInput]);
type CompetitionInput = z.infer<typeof competitionInput>;
type EventRow = typeof competitions.$inferSelect;
type Executor = Pick<Database,"select"|"insert"|"update"|"delete">;

function admin(viewer:Viewer){if(viewer.role!=="admin")throw new HttpError(403,"FORBIDDEN","Only administrators can host competitions.");}
export function competitionPhase(startsAt:Date,endsAt:Date,now=new Date()):Competition["phase"] {return now<startsAt?"upcoming":now>=endsAt?"ended":"live";}
function publicEvent(row:EventRow,now=new Date()):Competition {
  return {id:row.id,title:row.title,description:row.description,rules:row.rules,platform:row.platform,externalUrl:row.externalUrl,status:row.status,
    startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),phase:competitionPhase(row.startsAt,row.endsAt,now)};
}
async function eventRecord(db:Pick<Database,"select">,id:string,staff=false){
  const [row]=await db.select().from(competitions).where(eq(competitions.id,id)).limit(1);
  if(!row||(!staff&&row.status!=="published"))throw new HttpError(404,"NOT_FOUND","This competition is unavailable.");return row;
}
async function validateSelections(db:Executor,input:CompetitionInput,eventId:string){
  if(!input.selections.length)return;
  const ids=input.selections.map(c=>c.challengeId);
  const rows=await db.select().from(challenges).where(inArray(challenges.id,ids)).for("share");
  if(rows.length!==ids.length||rows.some(c=>c.visibility!=="competition"||c.status!=="published"))throw new HttpError(422,"CHALLENGES_NOT_READY","Select independently reviewed, published competition-only challenges.");
  const assigned=await db.select().from(competitionChallenges).where(and(inArray(competitionChallenges.challengeId,ids),ne(competitionChallenges.competitionId,eventId)));
  if(assigned.length)throw new HttpError(409,"CHALLENGE_ASSIGNED","A challenge is already assigned to another competition. Create a fresh challenge for this event.");
}
export async function saveCompetition(db:Database,viewer:Viewer,input:CompetitionInput,id?:string){
  admin(viewer);const eventId=id??randomUUID();
  return db.transaction(async tx=>{
    if(id){await tx.select().from(competitions).where(eq(competitions.id,id)).for("update");const previous=await eventRecord(tx,id,true);if(previous.status!=="draft")throw new HttpError(409,"COMPETITION_LOCKED","Published and archived competition settings are locked.");}
    await validateSelections(tx,input,eventId);
    const {selections,...content}=input;
    if(id){await tx.update(competitions).set({...content,updatedAt:new Date()}).where(eq(competitions.id,id));await tx.delete(competitionChallenges).where(eq(competitionChallenges.competitionId,id));}
    else await tx.insert(competitions).values({id:eventId,...content,createdBy:viewer.id});
    if(selections.length)await tx.insert(competitionChallenges).values(selections.map(c=>({...c,competitionId:eventId})));
    await audit(tx,viewer.id,id?"competition.edit":"competition.create",eventId);
    return {id:eventId};
  });
}
export async function setCompetitionStatus(db:Database,viewer:Viewer,id:string,status:"published"|"archived"){
  admin(viewer);
  return db.transaction(async tx=>{
    await tx.select().from(competitions).where(eq(competitions.id,id)).for("update");const event=await eventRecord(tx,id,true);
    if(status==="published"){
      if(event.status!=="draft")throw new HttpError(409,"INVALID_STATE","Only a draft competition can be published.");
      if(event.endsAt<=new Date())throw new HttpError(422,"INVALID_DATES","The competition must end in the future.");
      const selections=await tx.select({challengeId:competitionChallenges.challengeId,points:competitionChallenges.points}).from(competitionChallenges).where(eq(competitionChallenges.competitionId,id));
      if(event.platform==="dfctf"&&!selections.length)throw new HttpError(422,"CHALLENGES_REQUIRED","Add at least one reviewed competition-only challenge.");
      await validateSelections(tx,{...event,selections},id);
    }
    await tx.update(competitions).set({status,updatedAt:new Date()}).where(eq(competitions.id,id));
    await audit(tx,viewer.id,`competition.${status}`,id);return {id,status};
  });
}
export async function listCompetitions(db:Database,staff=false):Promise<Competition[]>{
  const rows=await db.select().from(competitions).where(staff?undefined:eq(competitions.status,"published")).orderBy(competitions.startsAt);
  return rows.map(row=>publicEvent(row));
}
export async function joinCompetition(db:Database,viewer:Viewer,id:string){
  if(!viewer.codename)throw new HttpError(409,"CODENAME_REQUIRED","Choose a codename before joining.");
  return db.transaction(async tx=>{
    await tx.select().from(competitions).where(eq(competitions.id,id)).for("share");const event=await eventRecord(tx,id);
    if(event.platform!=="dfctf")throw new HttpError(422,"EXTERNAL_COMPETITION","Register on the CTFd host for this event.");
    if(new Date()>=event.endsAt)throw new HttpError(409,"COMPETITION_ENDED","Registration is closed because this competition has ended.");
    await tx.insert(competitionRegistrations).values({competitionId:id,userId:viewer.id}).onConflictDoNothing();return {registered:true};
  });
}
export async function getCompetition(db:Database,viewer:Viewer,id:string,staff=false):Promise<CompetitionDetail>{
  if(staff)admin(viewer);const event=await eventRecord(db,id,staff), now=new Date();
  const [registration,registrations,links,rows,myAttempts]=await Promise.all([
    db.select().from(competitionRegistrations).where(and(eq(competitionRegistrations.competitionId,id),eq(competitionRegistrations.userId,viewer.id))).limit(1),
    db.select({total:count()}).from(competitionRegistrations).innerJoin(user,eq(user.id,competitionRegistrations.userId)).where(and(eq(competitionRegistrations.competitionId,id),notSuspended(now))),
    db.select({link:competitionChallenges,challenge:challenges,version:challengeVersions}).from(competitionChallenges)
      .innerJoin(challenges,eq(challenges.id,competitionChallenges.challengeId))
      .innerJoin(challengeVersions,and(eq(challengeVersions.challengeId,challenges.id),eq(challengeVersions.version,challenges.currentVersion)))
      .where(eq(competitionChallenges.competitionId,id)),
    db.select({userId:competitionSolves.userId,codename:user.codename,challengeId:competitionSolves.challengeId,at:competitionSolves.createdAt,points:competitionSolves.points}).from(competitionSolves)
      .innerJoin(user,eq(user.id,competitionSolves.userId)).where(and(eq(competitionSolves.competitionId,id),notSuspended(now))).orderBy(competitionSolves.createdAt,competitionSolves.id),
    db.selectDistinct({id:competitionSubmissions.challengeId}).from(competitionSubmissions).where(and(eq(competitionSubmissions.competitionId,id),eq(competitionSubmissions.userId,viewer.id))),
  ]);
  const solved=new Set(rows.filter(r=>r.userId===viewer.id).map(r=>r.challengeId)),attempted=new Set(myAttempts.map(r=>r.id));
  const visible=staff||(registration.length>0&&now>=event.startsAt);
  const items:ChallengeSummary[]=visible?links.map(({link,challenge:c,version:v})=>({id:c.id,slug:c.slug,title:v.title,summary:v.summary,category:v.category as Category,difficulty:v.difficulty as Difficulty,
    tags:v.tags,xp:link.points,estimatedMinutes:v.estimatedMinutes,status:c.status,visibility:c.visibility,solved:solved.has(c.id),attempted:attempted.has(c.id),solveCount:rows.filter(r=>r.challengeId===c.id).length})):[];
  return {...publicEvent(event,now),registered:!!registration.length,participants:registrations[0].total,challenges:items,
    standings:rankStandings(rows).slice(0,50).map(({rank,codename,points,solves})=>({rank,codename,points,solves})),
    ...(staff?{selections:links.map(r=>({challengeId:r.link.challengeId,points:r.link.points}))}:{}),
  };
}
export async function competitionChallengeDetail(db:Database,viewer:Viewer,eventId:string,id:string){
  const now=new Date();
  const access=await requireCompetitionChallenge(db,viewer,id,eventId);
  const [detail,rows,attempts,record]=await Promise.all([
    challengeDetail(db,viewer,id,false,eventId),
    db.select({userId:competitionSolves.userId,codename:user.codename,solvedAt:competitionSolves.createdAt}).from(competitionSolves)
      .innerJoin(user,eq(user.id,competitionSolves.userId)).where(and(eq(competitionSolves.competitionId,eventId),eq(competitionSolves.challengeId,id),notSuspended(now))).orderBy(competitionSolves.createdAt,competitionSolves.id),
    db.select({id:competitionSubmissions.id}).from(competitionSubmissions).where(and(eq(competitionSubmissions.competitionId,eventId),eq(competitionSubmissions.challengeId,id),eq(competitionSubmissions.userId,viewer.id))).limit(1),
    challengeRecord(db,id),
  ]);
  const solved=rows.some(r=>r.userId===viewer.id);const {solution:_solution,...content}=detail;
  return {...content,xp:access.points,solved,attempted:!!attempts.length,solveCount:rows.length,
    solvers:rows.map((r,i)=>({codename:r.codename||"Unnamed player",solvedAt:r.solvedAt.toISOString(),firstBlood:i===0})),
    competitionEndsAt:access.event.endsAt.toISOString(),submissionsOpen:new Date()<access.event.endsAt,...(solved?{solution:record.version.solution}:{})};
}
export async function submitCompetitionFlag(db:Database,viewer:Viewer,eventId:string,id:string,flag:string){
  if(!viewer.codename)throw new HttpError(409,"CODENAME_REQUIRED","Choose a codename before submitting.");
  await requireCompetitionChallenge(db,viewer,id,eventId,true);
  const digest=flagDigest(flag);
  await consumeLimit(db,`competition-flag:${eventId}:${viewer.id}:${id}`);
  return db.transaction(async tx=>{
    await tx.select({id:user.id}).from(user).where(eq(user.id,viewer.id)).for("update");
    await tx.select().from(competitions).where(eq(competitions.id,eventId)).for("share");
    await tx.select().from(challenges).where(eq(challenges.id,id)).for("share");
    const access=await requireCompetitionChallenge(tx,viewer,id,eventId,true);
    const record=await challengeRecord(tx,id);
    if(record.challenge.status!=="published"||record.challenge.visibility!=="competition")throw new HttpError(404,"NOT_FOUND","This competition challenge is unavailable.");
    const [existing]=await tx.select().from(competitionSolves).where(and(eq(competitionSolves.competitionId,eventId),eq(competitionSolves.userId,viewer.id),eq(competitionSolves.challengeId,id)));
    const correct=matchesFlag(flag,record.version.flagHash);
    await tx.insert(competitionSubmissions).values({id:randomUUID(),competitionId:eventId,userId:viewer.id,challengeId:id,digest,correct});
    if(correct&&!existing)await tx.insert(competitionSolves).values({id:randomUUID(),competitionId:eventId,userId:viewer.id,challengeId:id,points:access.points});
    const [total]=await tx.select({points:sum(competitionSolves.points)}).from(competitionSolves).where(and(eq(competitionSolves.competitionId,eventId),eq(competitionSolves.userId,viewer.id)));
    return {status:existing?"already_solved":correct?"correct":"incorrect",xp:correct&&!existing?access.points:0,totalXp:Number(total.points||0),...(correct||existing?{solution:record.version.solution}:{})};
  });
}
