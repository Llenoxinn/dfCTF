import { route,json } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { challengeDetail } from "@/server/challenges";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers);const {id}=await context.params;return json(await challengeDetail(await getDb(),user,id));});
