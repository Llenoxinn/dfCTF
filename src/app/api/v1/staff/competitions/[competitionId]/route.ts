import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { competitionPatchInput,getCompetition,saveCompetition,setCompetitionStatus } from "@/server/competitions";
import { HttpError,json,readJson,route } from "@/server/http";
async function admin(request:Request){const access=await requireAccess(request.headers,{staff:true});if(access.user.role!=="admin")throw new HttpError(403,"FORBIDDEN","Only administrators can host competitions.");return access;}
export const GET=route(async(request,context)=>{const {user}=await admin(request);return json(await getCompetition(await getDb(),user,(await context.params).competitionId,true));});
export const PATCH=route(async(request,context)=>{const {user}=await admin(request);const {competitionId}=await context.params;const input=await readJson(request,competitionPatchInput),db=await getDb();return json("status" in input?await setCompetitionStatus(db,user,competitionId,input.status):await saveCompetition(db,user,input,competitionId));});
