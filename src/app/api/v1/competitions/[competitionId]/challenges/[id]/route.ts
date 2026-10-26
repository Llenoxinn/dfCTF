import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { competitionChallengeDetail } from "@/server/competitions";
import { json, route } from "@/server/http";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers);const {competitionId,id}=await context.params;return json(await competitionChallengeDetail(await getDb(),user,competitionId,id));});
