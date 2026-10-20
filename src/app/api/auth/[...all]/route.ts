import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { HttpError, json, readBody } from "@/server/http";

export const runtime = "nodejs";
export async function GET(request: Request) { return toNextJsHandler(await getAuth()).GET(request); }
export async function POST(request: Request) {
  try {
    const bytes=await readBody(request,100_000);
    const headers=new Headers(request.headers);headers.delete("content-length");
    const bounded=new Request(request.url,{method:"POST",headers,body:Buffer.from(bytes)});
    return toNextJsHandler(await getAuth()).POST(bounded);
  } catch(error) {
    if(error instanceof HttpError)return json({error:{code:error.code,message:error.message,requestId:crypto.randomUUID()}},error.status);
    throw error;
  }
}
