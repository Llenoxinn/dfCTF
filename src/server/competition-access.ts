import { and, eq } from "drizzle-orm";
import type { Viewer } from "@/lib/types";
import type { Database } from "./db";
import { competitions, competitionChallenges, competitionRegistrations, challenges } from "./schema";
import { HttpError } from "./http";

export async function requireCompetitionChallenge(db: Pick<Database,"select">, viewer: Viewer, challengeId: string, competitionId: string, submit = false, now = new Date()) {
  const [row] = await db.select({ event: competitions, points: competitionChallenges.points }).from(competitions)
    .innerJoin(competitionChallenges, eq(competitionChallenges.competitionId, competitions.id))
    .innerJoin(challenges,eq(challenges.id,competitionChallenges.challengeId))
    .where(and(eq(competitions.id, competitionId), eq(competitionChallenges.challengeId, challengeId),eq(challenges.status,"published"),eq(challenges.visibility,"competition"))).limit(1);
  if (!row || row.event.status !== "published" || row.event.platform !== "dfctf") throw new HttpError(404,"NOT_FOUND","This competition challenge is unavailable.");
  const [registration] = await db.select({ userId: competitionRegistrations.userId }).from(competitionRegistrations)
    .where(and(eq(competitionRegistrations.competitionId,competitionId),eq(competitionRegistrations.userId,viewer.id))).limit(1);
  if (!registration) throw new HttpError(403,"REGISTRATION_REQUIRED","Join this competition before opening its challenges.");
  if (now < row.event.startsAt) throw new HttpError(403,"COMPETITION_NOT_STARTED","The competition has not started yet.");
  if (submit && now >= row.event.endsAt) throw new HttpError(409,"COMPETITION_ENDED","This competition has ended. Submissions are closed.");
  return row;
}
