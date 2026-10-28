import { randomUUID } from "node:crypto";
import { DrizzleQueryError } from "drizzle-orm";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(public status:number, public code:string, message:string, public details?:unknown) {super(message);}
}
export function json(data:unknown,status=200) {return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});}
export function checkOrigin(request:Request) {
  if(["GET","HEAD","OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  const local = process.env.NODE_ENV !== "production" && origin && ["http://127.0.0.1:3000","http://localhost:3000"].includes(origin);
  if(!origin || (origin !== expected && !local)) throw new HttpError(403,"INVALID_ORIGIN","This request could not be verified. Refresh the page and try again.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if(fetchSite === "cross-site") throw new HttpError(403,"INVALID_ORIGIN","Cross-site requests are not permitted.");
  // JSON and custom-header mutations cannot be issued by an untrusted HTML form.
  if(!request.headers.get("content-type")?.startsWith("application/json") && !request.headers.get("x-dfctf-request")) {
    throw new HttpError(403,"INVALID_REQUEST","A same-origin application request is required.");
  }
}
export async function readJson<T>(request:Request,schema:ZodType<T>):Promise<T> {
  if(Number(request.headers.get("content-length") || 0)>100_000) throw new HttpError(413,"TOO_LARGE","The request is too large.");
  let body:unknown;
  try { const raw=new TextDecoder().decode(await readBody(request,100_000)); body=JSON.parse(raw); }
  catch(error) {if(error instanceof HttpError) throw error; throw new HttpError(400,"INVALID_JSON","Send a valid JSON request.");}
  return schema.parse(body);
}
export async function readBody(request:Request,maximum:number):Promise<Uint8Array> {
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maximum){await reader.cancel();throw new HttpError(413,"TOO_LARGE","The request is too large.");}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
// Context is deliberately generic to support every App Router dynamic route.
export function route(handler:(request:Request, context:any)=>Promise<Response>|Response) {
  return async(request:Request,context:any)=>{
    const requestId=randomUUID(); const started=Date.now();
    try {checkOrigin(request);const response=await handler(request,context);response.headers.set("X-Request-Id",requestId);return response;}
    catch(error) {
      let status=500,code="INTERNAL_ERROR",message="Something went wrong. Try again or share this request ID with staff.",details:unknown;
      const databaseError=error instanceof DrizzleQueryError?error.cause:error;
      if(error instanceof HttpError) {({status,code,message,details}=error);}
      else if(error instanceof ZodError) {status=422;code="VALIDATION_FAILED";message="Check the highlighted fields.";details=error.flatten();}
      else if(databaseError && typeof databaseError === "object" && "code" in databaseError && databaseError.code === "23505") {status=409;code="CONFLICT";message="That value is already in use.";}
      console.error(JSON.stringify({level:status>=500?"error":"warn",requestId,route:new URL(request.url).pathname,status,duration:Date.now()-started,errorType:error instanceof Error?error.name:"Unknown"}));
      const response=json({error:{code,message,details,requestId}},status);
      response.headers.set("X-Request-Id",requestId);
      if(status===429 && details && typeof details ==="object" && "retryAfter" in details) response.headers.set("Retry-After",String(details.retryAfter));
      return response;
    }
  };
}
