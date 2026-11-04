import { z } from "zod";

const title = z.string().trim().min(3).max(160).regex(/^[^\r\n]+$/, "Use a single line.");
const detail = z.string().trim().min(10).max(6000);
export const feedbackSubject = z.string().regex(/^[^\r\n]*$/, "Use a single line.").trim().min(1, "Enter a subject.").max(120);
export const feedbackMessage = z.string().trim().min(1, "Enter a feedback message.").max(5000);
const feedbackEmail = z.string().regex(/^[^\r\n]*$/, "Use a single line.").trim().max(254).refine(value=>value===""||z.email().safeParse(value).success,"Enter a valid email address.").optional().default("");
export const legacyFeedbackInput = z.object({subject:feedbackSubject,message:feedbackMessage,email:feedbackEmail}).strict();
const common = { id: z.uuid(), title, contactEmail: feedbackEmail };
export const feedbackInput = z.discriminatedUnion("kind", [
  z.object({ ...common, title:feedbackSubject, kind: z.literal("feedback"), message: feedbackMessage }).strict(),
  z.object({ ...common, kind: z.literal("bug"), steps: detail, expected: detail, actual: detail }).strict(),
  z.object({ ...common, kind: z.literal("feature"), problem: detail, improvement: detail }).strict(),
]);
export type FeedbackInput = z.infer<typeof feedbackInput>;
export type FeedbackKind = FeedbackInput["kind"];
export const FEEDBACK_LABELS = { feedback: "Send feedback", bug: "Report a bug", feature: "Suggest a feature" } as const;
export const FEEDBACK_FIELDS = {
  feedback: [["message", "Feedback message"]],
  bug: [["steps", "Steps to reproduce"], ["expected", "Expected behavior"], ["actual", "Actual behavior"]],
  feature: [["problem", "Problem or need"], ["improvement", "Proposed improvement"]],
} as const;
