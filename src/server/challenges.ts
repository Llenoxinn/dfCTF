import { and, eq, gt, asc, desc, sql, count, sum, inArray } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import type { Database } from "./db";
import { challenges, challengeVersions, artifacts, solves, submissions, xpLedger, requestResults, rateLimits, auditEvents, user, competitionChallenges, competitions } from "./schema";
import { flagDigest, matchesFlag } from "./flags";
import { HttpError } from "./http";
import { challengeInput, summarize } from "./validation";
import { CATEGORIES, type ChallengeSummary, type ChallengeDetail, type Category, type Difficulty, type Viewer, type Progress } from "@/lib/types";
import { currentWeekly, weekEnd } from "@/lib/week";
import type { z } from "zod";
import { requireCompetitionChallenge } from "./competition-access";

type Executor=Pick<Database,"select"|"insert"|"update"|"delete">;
export type ChallengeDraft=z.infer<typeof challengeInput>;
const current=and(eq(challengeVersions.challengeId,challenges.id),eq(challengeVersions.version,challenges.currentVersion));
export async function audit(db:Executor,actorId:string,action:string,targetId:string,metadata:Record<string,unknown>={}) {
  await db.insert(auditEvents).values({id:randomUUID(),actorId,action,targetId,metadata});
}
export async function consumeLimit(db:Executor,key:string,max=10,windowMs=60_000) {
  const now=new Date();
  const [bucket]=await db.insert(rateLimits).values({key,count:1,windowStart:now}).onConflictDoUpdate({target:rateLimits.key,set:{
    count:sql`CASE WHEN ${rateLimits.windowStart} <= ${new Date(now.getTime()-windowMs)} THEN 1 ELSE ${rateLimits.count} + 1 END`,
    windowStart:sql`CASE WHEN ${rateLimits.windowStart} <= ${new Date(now.getTime()-windowMs)} THEN ${now} ELSE ${rateLimits.windowStart} END`
  }}).returning();
  if(bucket.count>max) throw new HttpError(429,"RATE_LIMITED","Too many attempts. Wait a moment and try again.",{retryAfter:Math.max(1,Math.ceil((bucket.windowStart.getTime()+windowMs-now.getTime())/1000))});
}
export async function listChallenges(db:Database,userId:string,staff?:Viewer):Promise<ChallengeSummary[]> {
  const now=new Date();
  const visible=staff ? (staff.role==="author"?eq(challenges.authorId,userId):undefined) : and(eq(challenges.status,"published"),eq(challenges.visibility,"practice"));
  const [rows,mySolves,myAttempts,counts]=await Promise.all([
    db.select({challenge:challenges,version:challengeVersions,author:user.codename}).from(challenges).innerJoin(challengeVersions,current).innerJoin(user,eq(user.id,challenges.authorId)).where(visible).orderBy(desc(challenges.createdAt)),
    db.select({challengeId:solves.challengeId}).from(solves).where(eq(solves.userId,userId)),
    db.selectDistinct({challengeId:submissions.challengeId}).from(submissions).where(eq(submissions.userId,userId)),
    db.select({challengeId:solves.challengeId,total:count()}).from(solves).groupBy(solves.challengeId)
  ]);
  const solved=new Set(mySolves.map(s=>s.challengeId)), attempted=new Set(myAttempts.map(s=>s.challengeId)), countMap=new Map(counts.map(s=>[s.challengeId,s.total]));
  const assignments=staff?await db.select().from(competitionChallenges):[];
  const weekly=!staff?currentWeekly(rows.map(({challenge:c,version:v})=>({id:c.id,publishedAt:c.publishedAt,tags:v.tags})),now):undefined;
  return rows.map(({challenge:c,version:v,author})=>({id:c.id,slug:c.slug,title:v.title,category:v.category as Category,difficulty:v.difficulty as Difficulty,summary:v.summary,tags:v.tags,xp:v.xp,estimatedMinutes:v.estimatedMinutes,solved:solved.has(c.id),attempted:attempted.has(c.id),solveCount:countMap.get(c.id)||0,status:c.status,
    ...(weekly?.id===c.id?{weeklyEndsAt:weekEnd(now).toISOString()}:{}),
    ...(staff?{author:author||"dfCTF author",updatedAt:c.updatedAt.toISOString(),visibility:c.visibility,competitionId:assignments.find(a=>a.challengeId===c.id)?.competitionId}:{})}));
}
export async function challengeRecord(db:Executor,id:string) {
  const [row]=await db.select({challenge:challenges,version:challengeVersions,author:user.codename}).from(challenges).innerJoin(challengeVersions,current).innerJoin(user,eq(user.id,challenges.authorId)).where(eq(challenges.id,id));
  if(!row) throw new HttpError(404,"NOT_FOUND","This challenge is unavailable.");
  return row;
}
export async function challengeDetail(db:Database,viewer:Viewer,id:string,staff=false,competitionId?:string):Promise<ChallengeDetail & {authorId?:string;canPublish?:boolean}> {
  const now=new Date();
  const row=await challengeRecord(db,id);const c=row.challenge,v=row.version;
  if(competitionId)await requireCompetitionChallenge(db,viewer,id,competitionId);
  if(!staff && (c.status!=="published"||(!competitionId&&c.visibility!=="practice"))) throw new HttpError(404,"NOT_FOUND","This challenge is unavailable.");
  if(staff && viewer.role==="author" && c.authorId!==viewer.id) throw new HttpError(404,"NOT_FOUND","This challenge is unavailable.");
  const [mySolve,myAttempt,files,solverRows,weeklyRows]=await Promise.all([
    db.select().from(solves).where(and(eq(solves.userId,viewer.id),eq(solves.challengeId,id))).limit(1),
    db.select({id:submissions.id}).from(submissions).where(and(eq(submissions.userId,viewer.id),eq(submissions.challengeId,id))).limit(1),
    db.select({id:artifacts.id,name:artifacts.name,size:artifacts.size,sha256:artifacts.sha256}).from(artifacts).where(eq(artifacts.versionId,v.id)),
    db.select({codename:user.codename,solvedAt:solves.createdAt}).from(solves).innerJoin(user,eq(user.id,solves.userId)).where(eq(solves.challengeId,id)).orderBy(asc(solves.createdAt),asc(solves.id)),
    db.select({id:challenges.id,publishedAt:challenges.publishedAt,tags:challengeVersions.tags}).from(challenges).innerJoin(challengeVersions,current).where(and(eq(challenges.status,"published"),eq(challenges.visibility,"practice")))
  ]);
  return {id:c.id,slug:c.slug,title:v.title,summary:v.summary,description:v.description,category:v.category as Category,difficulty:v.difficulty as Difficulty,tags:v.tags,xp:v.xp,estimatedMinutes:v.estimatedMinutes,solved:!!mySolve.length,attempted:!!myAttempt.length,solveCount:solverRows.length,status:c.status,flagFormat:v.flagFormat,author:row.author||"dfCTF author",version:v.version,files,solvers:solverRows.map((s,i)=>({codename:s.codename||"Unnamed player",solvedAt:s.solvedAt.toISOString(),firstBlood:i===0})),
    ...(currentWeekly(weeklyRows,now)?.id===c.id?{weeklyEndsAt:weekEnd(now).toISOString()}:{}),
    ...(mySolve.length||staff?{solution:v.solution}:{}),...(staff?{visibility:c.visibility,authorId:c.authorId,canPublish:c.status==="review"&&viewer.role!=="author"&&c.authorId!==viewer.id}:{})};
}
export async function getProgress(db:Database,userId:string):Promise<Progress> {
  const [awards,completed,attempted,library]=await Promise.all([
    db.select({total:sum(xpLedger.amount)}).from(xpLedger).where(eq(xpLedger.userId,userId)),
    db.select({id:challenges.id,title:challengeVersions.title,slug:challenges.slug,category:challengeVersions.category,solvedAt:solves.createdAt,xp:sql<number>`coalesce(${xpLedger.amount},0)`}).from(solves).innerJoin(challenges,eq(challenges.id,solves.challengeId)).innerJoin(challengeVersions,eq(challengeVersions.id,solves.versionId)).leftJoin(xpLedger,eq(xpLedger.solveId,solves.id)).where(eq(solves.userId,userId)).orderBy(desc(solves.createdAt)),
    db.selectDistinct({challengeId:submissions.challengeId}).from(submissions).where(eq(submissions.userId,userId)),
    db.select({id:challenges.id,category:challengeVersions.category}).from(challenges).innerJoin(challengeVersions,current).where(and(eq(challenges.status,"published"),eq(challenges.visibility,"practice")))
  ]);
  // Counts compare against the published library; archived solves stay in history and XP only.
  const live=new Set(library.map(c=>c.id)),stillPublished=completed.filter(c=>live.has(c.id));
  return {totalXp:Number(awards[0]?.total||0),solvedCount:stillPublished.length,attemptedCount:attempted.length,
    categories:CATEGORIES.map(category=>({category,solved:stillPublished.filter(c=>c.category===category).length,total:library.filter(c=>c.category===category).length})),
    recentSolves:completed.slice(0,20).map(c=>({...c,xp:Number(c.xp),category:c.category as Category,solvedAt:c.solvedAt.toISOString()}))};
}
export async function submitFlag(db:Database,viewer:Viewer,id:string,flag:string,idempotencyKey?:string) {
  if(!viewer.codename) throw new HttpError(409,"CODENAME_REQUIRED","Choose your codename before submitting a flag.");
  const key=idempotencyKey?`${viewer.id}:${idempotencyKey}`:undefined;
  const digest=flagDigest(flag);const fingerprint=createHash("sha256").update(`${id}:${digest}`).digest("hex");
  // Limit outside the solve transaction: rejected guesses remain counted after rollback.
  if(key) {
    const [previous]=await db.select().from(requestResults).where(eq(requestResults.key,key));
    if(previous) {if(previous.fingerprint!==fingerprint) throw new HttpError(409,"IDEMPOTENCY_CONFLICT","Use a new request key for a different submission.");return previous.response;}
  }
  const row=await challengeRecord(db,id);
  if(row.challenge.status!=="published"||row.challenge.visibility!=="practice") throw new HttpError(404,"NOT_FOUND","This challenge is unavailable.");
  await consumeLimit(db,`flag:${viewer.id}:${id}`);
  return db.transaction(async tx=>{
    await tx.select({id:user.id}).from(user).where(eq(user.id,viewer.id)).for("update");
    if(key) {const [prior]=await tx.select().from(requestResults).where(eq(requestResults.key,key));if(prior){if(prior.fingerprint!==fingerprint)throw new HttpError(409,"IDEMPOTENCY_CONFLICT","Use a new request key for a different submission.");return prior.response;}}
    // Recheck publication inside the transaction so archiving races cannot award a solve.
    await tx.select({id:challenges.id}).from(challenges).where(eq(challenges.id,id)).for("share");
    const fresh=await challengeRecord(tx,id);
    if(fresh.challenge.status!=="published"||fresh.challenge.visibility!=="practice")throw new HttpError(404,"NOT_FOUND","This challenge is unavailable.");
    const correct=matchesFlag(flag,fresh.version.flagHash);
    const [existing]=await tx.select().from(solves).where(and(eq(solves.userId,viewer.id),eq(solves.challengeId,id)));
    await tx.insert(submissions).values({id:randomUUID(),userId:viewer.id,challengeId:id,versionId:fresh.version.id,digest,correct});
    let xp=0;
    if(correct&&!existing) {
      const solveId=randomUUID();await tx.insert(solves).values({id:solveId,userId:viewer.id,challengeId:id,versionId:fresh.version.id});
      const awarded=await tx.insert(xpLedger).values({id:randomUUID(),userId:viewer.id,familyId:fresh.challenge.familyId,solveId,amount:fresh.version.xp}).onConflictDoNothing().returning({amount:xpLedger.amount});
      xp=awarded[0]?.amount||0;
      await tx.update(challengeVersions).set({locked:true}).where(eq(challengeVersions.id,fresh.version.id));
    }
    const [totals]=await tx.select({total:sum(xpLedger.amount)}).from(xpLedger).where(eq(xpLedger.userId,viewer.id));
    const response={status:existing?"already_solved":correct?"correct":"incorrect",xp,totalXp:Number(totals.total||0),...(correct||existing?{solution:fresh.version.solution}:{})};
    if(key)await tx.insert(requestResults).values({key,userId:viewer.id,operation:`submit:${id}`,fingerprint,response});
    return response;
  });
}
export async function createChallenge(db:Database,viewer:Viewer,input:ChallengeDraft) {
  if(!["author","admin"].includes(viewer.role)) throw new HttpError(403,"FORBIDDEN","Only authors and administrators can create drafts.");
  const id=randomUUID(),slug=input.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+id.slice(0,6);
  await db.transaction(async tx=>{
    const {flag,visibility,...content}=input;
    await tx.insert(challenges).values({id,slug,familyId:id,authorId:viewer.id,visibility:visibility??"practice"});
    await tx.insert(challengeVersions).values({id:randomUUID(),challengeId:id,version:1,...content,summary:content.summary||summarize(content.description),flagHash:flagDigest(flag)});
    await audit(tx,viewer.id,"challenge.create",id);
  });
  return {id,slug,status:"draft"};
}
export async function editChallenge(db:Database,viewer:Viewer,id:string,input:Partial<ChallengeDraft>&{status?:string}) {
  return db.transaction(async tx=>{
    await tx.select().from(challenges).where(eq(challenges.id,id)).for("update");
    const {challenge:c,version:v}=await challengeRecord(tx,id);
    if(!["author","admin"].includes(viewer.role)||(viewer.role==="author"&&c.authorId!==viewer.id))throw new HttpError(404,"NOT_FOUND","This draft is unavailable.");
    if(input.status==="archived"&&c.status==="published") {
      const linked=await tx.select({id:competitions.id}).from(competitions).innerJoin(competitionChallenges,eq(competitionChallenges.competitionId,competitions.id))
        .where(and(eq(competitionChallenges.challengeId,id),eq(competitions.status,"published"),gt(competitions.endsAt,new Date()))).limit(1);
      if(linked.length)throw new HttpError(409,"COMPETITION_LOCKED","This challenge belongs to a published competition that has not ended. Archive the event first if it must be withdrawn.");
      await tx.update(challenges).set({status:"archived",updatedAt:new Date()}).where(eq(challenges.id,id));await audit(tx,viewer.id,"challenge.archive",id);return {id,status:"archived"};
    }
    if(input.status==="draft"&&c.status==="review"&&!v.locked) {
      await tx.update(challenges).set({status:"draft",updatedAt:new Date()}).where(eq(challenges.id,id));
      await audit(tx,viewer.id,"challenge.withdraw_review",id);return {id,status:"draft"};
    }
    if(c.status!=="draft"||v.locked)throw new HttpError(409,"IMMUTABLE_VERSION","This version is locked. Published content cannot be edited.");
    if(input.status) {
      if(input.status!=="review")throw new HttpError(422,"INVALID_STATE","Drafts can only be submitted for independent review.");
      // Files are optional: OSINT and puzzle challenges can live entirely in the description.
      await tx.update(challenges).set({status:"review",updatedAt:new Date()}).where(eq(challenges.id,id));
      await audit(tx,viewer.id,"challenge.request_review",id);return {id,status:"review"};
    }
    const {flag,visibility,...updates}=input;
    // A new description without an explicit summary refreshes the derived one; an empty summary is never stored.
    if(updates.description&&!updates.summary)updates.summary=summarize(updates.description);
    else if(updates.summary==="")delete updates.summary;
    await tx.update(challengeVersions).set({...updates,...(flag?{flagHash:flagDigest(flag)}:{})}).where(eq(challengeVersions.id,v.id));
    await tx.update(challenges).set({updatedAt:new Date(),...(visibility?{visibility}:{})}).where(eq(challenges.id,id));await audit(tx,viewer.id,"challenge.edit",id);return {id,status:"draft"};
  });
}
export async function publishChallenge(db:Database,viewer:Viewer,id:string,reviewFlag:string) {
  if(!["reviewer","admin"].includes(viewer.role))throw new HttpError(403,"FORBIDDEN","An independent reviewer must publish this challenge.");
  return db.transaction(async tx=>{
    await tx.select().from(challenges).where(eq(challenges.id,id)).for("update");const {challenge:c,version:v}=await challengeRecord(tx,id);
    if(c.authorId===viewer.id)throw new HttpError(403,"SELF_REVIEW","A different reviewer must test-solve and approve your challenge.");
    if(c.status!=="review")throw new HttpError(409,"INVALID_STATE","Only a challenge awaiting review can be published.");
    if(!matchesFlag(reviewFlag,v.flagHash))throw new HttpError(422,"REVIEW_FLAG_INCORRECT","Test-solve the challenge and submit its correct flag before publishing.");
    await tx.update(challenges).set({status:"published",reviewerId:viewer.id,publishedAt:new Date(),updatedAt:new Date()}).where(eq(challenges.id,id));
    await tx.update(challengeVersions).set({locked:true}).where(eq(challengeVersions.id,v.id));
    await audit(tx,viewer.id,"challenge.publish",id,{attestation:"Independent test solve and intended solution reviewed"});return {id,status:"published"};
  });
}
