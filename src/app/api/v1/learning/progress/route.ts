import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { HttpError, json, readJson, route } from "@/server/http";
import { learningPatchSchema } from "@/lib/learning-progress";
import { readLearningProgress, updateLearningProgress } from "@/server/learning-progress";

export const runtime = "nodejs";

async function account(request: Request) {
  const { user } = await requireAccess(request.headers);
  if (request.headers.get("x-dfctf-account") !== user.id) throw new HttpError(409, "ACCOUNT_CHANGED", "Your signed-in account changed. Refresh this page before syncing.");
  return user.id;
}

export const GET = route(async request => {
  const userId = await account(request);
  return json({ userId, progress: await readLearningProgress(await getDb(), userId) });
});

export const PATCH = route(async request => {
  const userId = await account(request);
  const patch = await readJson(request, learningPatchSchema);
  return json({ userId, progress: await updateLearningProgress(await getDb(), userId, patch) });
});
