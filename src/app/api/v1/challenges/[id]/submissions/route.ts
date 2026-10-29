import { route,json,readJson } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { submitFlag } from "@/server/challenges";
import { submissionInput } from "@/server/validation";
export const POST=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers);const {id}=await context.params;const body=await readJson(request,submissionInput);
  return json(await submitFlag(await getDb(),user,id,body.flag));
});
