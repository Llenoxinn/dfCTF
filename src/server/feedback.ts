import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { feedbackInput, legacyFeedbackInput, FEEDBACK_FIELDS, FEEDBACK_LABELS, type FeedbackInput } from "@/lib/feedback";
import { localMailEnabled, sendTextEmail } from "./mail";
import type { Database } from "./db";
import { feedbackReceipts } from "./schema";
import { consumeLimit } from "./challenges";
import { HttpError } from "./http";

function digest(value: string) {
  const secret=process.env.AUTH_SECRET;
  if(!secret)throw new HttpError(503,"FEEDBACK_UNAVAILABLE","Reporting is temporarily unavailable. Your text has been kept; try again later.");
  return createHmac("sha256",secret).update(value).digest("hex");
}

export function feedbackMail(input: FeedbackInput) {
  const details=FEEDBACK_FIELDS[input.kind].map(([key,label])=>`${label}:\n${(input as unknown as Record<string,string>)[key]}`).join("\n\n");
  return {
    subject: `[dfCTF ${FEEDBACK_LABELS[input.kind]}] ${input.title}`,
    text: `Submission: ${input.id}\nType: ${input.kind}\nTitle: ${input.title}\n\n${details}\n\nPrivate contact email: ${input.contactEmail || "Not provided"}\n\nPrivate intake. Remove contact details and personal information before sharing any report publicly.`,
  };
}

export async function deliverFeedback(input: FeedbackInput) {
  const destination=process.env.FEEDBACK_TO?.trim();
  if(!destination || (!localMailEnabled()&&(!process.env.SMTP_URL || !process.env.MAIL_FROM)))throw new HttpError(503,"FEEDBACK_UNAVAILABLE","Reporting is temporarily unavailable. Your text has been kept; try again later.");
  try {
    await sendTextEmail({to:destination,...feedbackMail(input),...(input.contactEmail?{replyTo:input.contactEmail}:{})});
  } catch {
    // SMTP errors may contain addresses or credentials; return only a safe, actionable error.
    throw new HttpError(503,"FEEDBACK_DELIVERY_FAILED","We could not deliver your submission. Your text has been kept; please retry.");
  }
}

function parseFeedback(raw:unknown):FeedbackInput {
  if(raw&&typeof raw==="object"&&"kind" in raw)return feedbackInput.parse(raw);
  const legacy=legacyFeedbackInput.parse(raw);
  return feedbackInput.parse({id:randomUUID(),kind:"feedback",title:legacy.subject,message:legacy.message,contactEmail:legacy.email});
}

// shortcut: one SMTP transaction per instance; use a shared queue if reporting volume grows.
let activeFeedback:{id:string;digest:string;delivery:Promise<void>}|undefined;

export async function submitFeedback(db: Database, raw: unknown, headers: Headers, deliver=deliverFeedback) {
  const input=parseFeedback(raw);
  const fingerprint=digest(JSON.stringify(input));
  if(activeFeedback) {
    if(activeFeedback.id!==input.id)throw new HttpError(503,"FEEDBACK_BUSY","Reporting is busy. Your text has been kept; please retry shortly.");
    if(activeFeedback.digest!==fingerprint)throw new HttpError(409,"SUBMISSION_CHANGED","This submission changed. Close and reopen the form to send a new report.");
    await activeFeedback.delivery;
    return {accepted:true,id:input.id};
  }
  const delivery=(async()=>{
    const [receipt]=await db.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,input.id)).limit(1);
    if(receipt) {
      if(receipt.digest!==fingerprint)throw new HttpError(409,"SUBMISSION_CHANGED","This submission changed. Close and reopen the form to send a new report.");
      return;
    }
    // Production trusts only the hosting proxy's address header, never a client-supplied forwarded chain.
    const address=headers.get(process.env.NODE_ENV==="production"?"x-real-ip":"x-forwarded-for") || "unknown";
    try {await consumeLimit(db,`feedback:${digest(address)}`,5,3_600_000);}
    catch(error){if(error instanceof HttpError&&error.status===429)throw new HttpError(429,"FEEDBACK_RATE_LIMITED","Too many feedback submissions. Please wait before trying again.",error.details);throw error;}
    await db.transaction(async tx=>{
      const inserted=await tx.insert(feedbackReceipts).values({id:input.id,digest:fingerprint}).onConflictDoNothing().returning();
      if(!inserted.length) {
        const [existing]=await tx.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,input.id));
        if(existing.digest!==fingerprint)throw new HttpError(409,"SUBMISSION_CHANGED","This submission changed. Close and reopen the form to send a new report.");
        return;
      }
      // The receipt also deduplicates across instances; failed delivery rolls it back for a safe retry.
      await deliver(input);
    });
  })();
  activeFeedback={id:input.id,digest:fingerprint,delivery};
  try { await delivery;return {accepted:true,id:input.id}; }
  finally { activeFeedback=undefined; }
}
