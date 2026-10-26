import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { downloadArtifact } from "@/server/files";
import { route } from "@/server/http";
export const GET=route(async(request,context)=>{const {user}=await requireAccess(request.headers);const {competitionId,id,fileId}=await context.params;return downloadArtifact(await getDb(),user,id,fileId,false,competitionId);});
