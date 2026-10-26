import { eq } from "drizzle-orm";
import { RULE_FIELD_NOTES, RULES_CHALLENGE_TITLE } from "@/lib/rules";
import type { Viewer } from "@/lib/types";
import type { Database } from "./db";
import { challenges, challengeVersions } from "./schema";
import { createChallenge, type ChallengeDraft } from "./challenges";
import { saveArtifact } from "./files";
import { HttpError } from "./http";

export const rulesChallenge: ChallengeDraft = {
  title: RULES_CHALLENGE_TITLE,
  summary: "The first flag is already in the rules. Read carefully and piece it together.",
  description: "Before you investigate a file, investigate the rules. Open the Rules / Mechanics page and read every section. Three field notes are tucked into the text.\n\nJoin the notes in reading order with no added spaces to recover a complete flag. Submit it here to show you read the rules. The briefing file repeats these instructions; no outside tools are needed.",
  solution: "Read Rules / Mechanics from top to bottom. Collect the three field notes and join them in their displayed order, without spaces. Submit the complete flag including its wrapper.\n\nThe lesson: read the scope and instructions before you start solving.",
  category: "General skills", difficulty: "Easy", tags: ["rules", "onboarding"],
  xp: 50, estimatedMinutes: 5, flag: RULE_FIELD_NOTES.join(""), flagFormat: "dfCTF{...}",
};

export async function createRulesChallenge(db: Database, viewer: Viewer) {
  if (!["author", "admin"].includes(viewer.role)) throw new HttpError(403, "FORBIDDEN", "Only authors and administrators can create drafts.");
  const [existing] = await db.select({ id: challenges.id, slug: challenges.slug, status: challenges.status, authorId: challenges.authorId })
    .from(challenges).innerJoin(challengeVersions, eq(challengeVersions.challengeId, challenges.id))
    .where(eq(challengeVersions.title, RULES_CHALLENGE_TITLE)).limit(1);
  if (existing) {
    if (viewer.role === "author" && existing.authorId !== viewer.id) throw new HttpError(409, "RULES_CHALLENGE_EXISTS", "The rules challenge already exists. Ask its author or an administrator to open it.");
    return existing;
  }
  const draft = await createChallenge(db, viewer, rulesChallenge);
  await saveArtifact(db, viewer, draft.id, "briefing.txt", Buffer.from(
    "Read the fine print\n\nOpen /rules in dfCTF. Read all Rules / Mechanics sections. Join the three field notes in reading order, without spaces. Submit the complete flag in this challenge.\n",
  ));
  return draft;
}
