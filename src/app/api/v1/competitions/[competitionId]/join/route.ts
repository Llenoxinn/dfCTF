import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { joinCompetition } from "@/server/competitions";
import { json, route } from "@/server/http";
export const POST=route(async(request,context)=>{const {user}=await requireAccess(request.headers);return json(await joinCompetition(await getDb(),user,(await context.params).competitionId));});
