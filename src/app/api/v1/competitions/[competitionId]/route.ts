import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { getCompetition } from "@/server/competitions";
import { json, route } from "@/server/http";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers);return json(await getCompetition(await getDb(),user,(await context.params).competitionId));});
