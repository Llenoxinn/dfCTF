import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";
import { createRulesChallenge } from "@/server/rules-challenge";

export const POST = route(async request => {
  const { user } = await requireAccess(request.headers, { staff: true });
  return json(await createRulesChallenge(await getDb(), user));
});
