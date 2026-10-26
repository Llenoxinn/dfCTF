import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { competitionInput,listCompetitions,saveCompetition } from "@/server/competitions";
import { HttpError,json,readJson,route } from "@/server/http";
async function admin(request:Request){const access=await requireAccess(request.headers,{staff:true});if(access.user.role!=="admin")throw new HttpError(403,"FORBIDDEN","Only administrators can host competitions.");return access;}
export const GET=route(async request=>{await admin(request);return json(await listCompetitions(await getDb(),true));});
export const POST=route(async request=>{const {user}=await admin(request);return json(await saveCompetition(await getDb(),user,await readJson(request,competitionInput)),201);});
