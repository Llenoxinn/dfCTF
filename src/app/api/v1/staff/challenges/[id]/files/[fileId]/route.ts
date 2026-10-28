import { route,json } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { downloadArtifact,removeArtifact } from "@/server/files";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});const {id,fileId}=await context.params;return downloadArtifact(await getDb(),user,id,fileId,true);});
export const DELETE=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});const {id,fileId}=await context.params;return json(await removeArtifact(await getDb(),user,id,fileId));});
