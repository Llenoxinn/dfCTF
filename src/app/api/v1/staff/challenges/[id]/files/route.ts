import { route,json,HttpError,readBody } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { saveArtifact,MAX_ARTIFACT_BYTES } from "@/server/files";
export const POST=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers,{staff:true});
  if(Number(request.headers.get("content-length")||0)>MAX_ARTIFACT_BYTES+10000)throw new HttpError(413,"TOO_LARGE","Files must be 10 MB or smaller.");
  // Bound the streamed body even when Content-Length is omitted or untrusted.
  const bytes=await readBody(request,MAX_ARTIFACT_BYTES+10000);
  const bounded=new Request(request.url,{method:"POST",headers:{"content-type":request.headers.get("content-type")||""},body:Buffer.from(bytes)});
  const form=await bounded.formData(),file=form.get("file");if(!(file instanceof File))throw new HttpError(422,"FILE_REQUIRED","Choose a file.");
  if(file.size>MAX_ARTIFACT_BYTES)throw new HttpError(413,"TOO_LARGE","Files must be 10 MB or smaller.");
  return json(await saveArtifact(await getDb(),user,(await context.params).id,file.name,Buffer.from(await file.arrayBuffer())),201);
});
