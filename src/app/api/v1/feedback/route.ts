import { z } from "zod";
import { getDb } from "@/server/db";
import { submitFeedback } from "@/server/feedback";
import { localMailEnabled } from "@/server/mail";
import { json, readJson, route } from "@/server/http";

export const runtime="nodejs";
export const POST=route(async request=>{
  const input=await readJson(request,z.unknown());
  return json({...await submitFeedback(await getDb(),input,request.headers),...(localMailEnabled()?{delivery:"local"}:{})});
});
