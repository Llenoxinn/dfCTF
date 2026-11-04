import { feedbackInput } from "@/lib/feedback";
import { getDb } from "@/server/db";
import { submitFeedback } from "@/server/feedback";
import { json, readJson, route } from "@/server/http";

export const runtime="nodejs";
export const POST=route(async request=>{
  const input=await readJson(request,feedbackInput);
  return json(await submitFeedback(await getDb(),input,request.headers));
});
