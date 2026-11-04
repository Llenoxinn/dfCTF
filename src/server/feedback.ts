import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { feedbackInput, FEEDBACK_FIELDS, FEEDBACK_LABELS, type FeedbackInput } from "@/lib/feedback";
import { SUPPORT_EMAIL } from "@/lib/site";
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
  if(!process.env.SMTP_URL || !process.env.MAIL_FROM)throw new HttpError(503,"FEEDBACK_UNAVAILABLE","Reporting is temporarily unavailable. Your text has been kept; try again later.");
  try {
    const transport=nodemailer.createTransport({url:process.env.SMTP_URL,connectionTimeout:10_000,socketTimeout:15_000});
    const result=await transport.sendMail({from:process.env.MAIL_FROM,to:process.env.FEEDBACK_TO || SUPPORT_EMAIL,...feedbackMail(input),...(input.contactEmail?{replyTo:input.contactEmail}:{})});
    if(!result.accepted?.length)throw new Error("Inbox did not accept the submission.");
  } catch {
    // SMTP errors may contain addresses or credentials; return only a safe, actionable error.
    throw new HttpError(503,"FEEDBACK_DELIVERY_FAILED","We could not deliver your submission. Your text has been kept; please retry.");
  }
}

export async function submitFeedback(db: Database, raw: unknown, headers: Headers, deliver=deliverFeedback) {
  const input=feedbackInput.parse(raw);
  const fingerprint=digest(JSON.stringify(input));
  const [receipt]=await db.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,input.id)).limit(1);
  if(receipt) {
    if(receipt.digest!==fingerprint)throw new HttpError(409,"SUBMISSION_CHANGED","This submission changed. Close and reopen the form to send a new report.");
    return {accepted:true,id:input.id};
  }
  // Production trusts only the hosting proxy's address header, never a client-supplied forwarded chain.
  const address=headers.get(process.env.NODE_ENV==="production"?"x-real-ip":"x-forwarded-for") || "unknown";
  await consumeLimit(db,`feedback:${digest(address)}`,5,3_600_000);
  await db.transaction(async tx=>{
    const inserted=await tx.insert(feedbackReceipts).values({id:input.id,digest:fingerprint}).onConflictDoNothing().returning();
    if(!inserted.length) {
      const [existing]=await tx.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,input.id));
      if(existing.digest!==fingerprint)throw new HttpError(409,"SUBMISSION_CHANGED","This submission changed. Close and reopen the form to send a new report.");
      return;
    }
    // Concurrent retries wait on the receipt; failed delivery rolls it back so the same report can be retried.
    await deliver(input);
  });
  return {accepted:true,id:input.id};
}
