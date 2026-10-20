import { route } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { downloadArtifact } from "@/server/files";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers,{staff:true});const {id,fileId}=await context.params;return downloadArtifact(await getDb(),user,id,fileId,true);});
