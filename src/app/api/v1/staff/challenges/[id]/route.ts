import { z } from "zod";
import { route,json,readJson } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { challengeDetail,editChallenge } from "@/server/challenges";
import { challengeInput } from "@/server/validation";
const patchInput=z.union([z.object({status:z.enum(["review","archived"])}).strict(),challengeInput.partial().omit({flagFormat:true}).extend({flagFormat:z.string().min(3).max(100).optional()}).strict()]);
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});return json(await challengeDetail(await getDb(),user,(await context.params).id,true));});
export const PATCH=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});return json(await editChallenge(await getDb(),user,(await context.params).id,await readJson(request,patchInput)));});
