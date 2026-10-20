import { route,json } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { getProgress } from "@/server/challenges";
export const GET=route(async request=>{const {user}=await requireAccess(request.headers);return json(await getProgress(await getDb(),user.id));});
