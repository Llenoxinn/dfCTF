import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { submitCompetitionFlag } from "@/server/competitions";
import { submissionInput } from "@/server/validation";
import { HttpError,json,readJson,route } from "@/server/http";
export const POST=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers);const {competitionId,id}=await context.params;
  const {flag}=await readJson(request,submissionInput),key=request.headers.get("Idempotency-Key")||undefined;
  if(key&&!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new HttpError(422,"INVALID_KEY","Use an 8–100 character request key.");
  return json(await submitCompetitionFlag(await getDb(),user,competitionId,id,flag,key));
});
