import { route,json,readJson } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { publishChallenge,consumeLimit } from "@/server/challenges";
import { submissionInput } from "@/server/validation";
export const POST=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});const {flag}=await readJson(request,submissionInput);const db=await getDb();await consumeLimit(db,`review:${user.id}`,10);return json(await publishChallenge(db,user,(await context.params).id,flag));});
