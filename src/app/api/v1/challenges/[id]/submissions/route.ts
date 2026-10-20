import { route,json,readJson,HttpError } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { submitFlag } from "@/server/challenges";
import { submissionInput } from "@/server/validation";
export const POST=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers);const {id}=await context.params;const body=await readJson(request,submissionInput);
  const key=request.headers.get("Idempotency-Key")||undefined;
  if(key&&!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new HttpError(422,"INVALID_KEY","Use an 8–100 character request key.");
  return json(await submitFlag(await getDb(),user,id,body.flag,key));
});
