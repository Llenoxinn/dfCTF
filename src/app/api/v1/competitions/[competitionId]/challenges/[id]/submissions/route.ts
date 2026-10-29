import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { submitCompetitionFlag } from "@/server/competitions";
import { submissionInput } from "@/server/validation";
import { json,readJson,route } from "@/server/http";
export const POST=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers);const {competitionId,id}=await context.params;
  const {flag}=await readJson(request,submissionInput);
  return json(await submitCompetitionFlag(await getDb(),user,competitionId,id,flag));
});
