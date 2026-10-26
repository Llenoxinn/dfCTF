import { route,json } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { listChallenges } from "@/server/challenges";
export const GET=route(async request=>{const {user}=await requireAccess(request.headers);return json(await listChallenges(await getDb(),user.id));});
