import { route,json,readJson } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { listChallenges,createChallenge } from "@/server/challenges";
import { challengeInput } from "@/server/validation";
export const GET=route(async request=>{const {user}=await requireAccess(request.headers,{staff:true});return json(await listChallenges(await getDb(),user.id,{},user));});
export const POST=route(async request=>{const {user}=await requireAccess(request.headers,{staff:true});return json(await createChallenge(await getDb(),user,await readJson(request,challengeInput)),201);});
