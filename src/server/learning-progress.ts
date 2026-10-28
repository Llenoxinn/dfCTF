import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { requireAccess } from "./access";
import { HttpError } from "./http";
import { learningProgress } from "./schema";
import { parseLearningProgress } from "@/lib/resource-learning";
import { applyLearningPatch, type LearningPatch } from "@/lib/learning-progress";

export async function readLearningProgress(db: Database, userId: string) {
  const [row] = await db.select().from(learningProgress).where(eq(learningProgress.userId, userId));
  return row?.progress ?? parseLearningProgress(null);
}

export async function updateLearningProgress(db: Database, userId: string, patch: LearningPatch) {
  return db.transaction(async tx => {
    await tx.insert(learningProgress).values({ userId, progress: parseLearningProgress(null) }).onConflictDoNothing();
    const [row] = await tx.select().from(learningProgress).where(eq(learningProgress.userId, userId)).for("update");
    const progress = applyLearningPatch(row.progress, patch);
    await tx.update(learningProgress).set({ progress, updatedAt: new Date() }).where(eq(learningProgress.userId, userId));
    return progress;
  });
}

export async function learningIdentity(headers: Headers) {
  if (!headers.get("cookie")?.includes("better-auth")) return null;
  try { return (await requireAccess(headers)).user.id; }
  catch (error) {
    if (!(error instanceof HttpError && [401, 403].includes(error.status))) console.warn("Learning session lookup unavailable; public reading remains available.");
    return null;
  }
}
