import { z } from "zod";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { canonicalFlag } from "./flags";
export function codenameKey(value:string) {return value.toLowerCase().replace(/0/g,"o").replace(/[1il]/g,"l");}
const reserved=new Set(["admin","administrator","staff","mod","moderator","system","root","dfctf","support"].map(codenameKey));
const tagsInput=z.array(z.string().trim().min(1).max(32)).max(8);
const flagFormatInput=z.string().trim().min(3).max(100);
export const codenameSchema=z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/,"Use letters, numbers, underscores, periods, or hyphens.").refine(value=>!reserved.has(codenameKey(value)),"Choose a codename that does not impersonate staff.");
export const challengeInput=z.object({
  title:z.string().trim().min(3).max(80), summary:z.string().trim().min(10).max(240),
  description:z.string().trim().min(20).max(20000), solution:z.string().trim().min(20).max(50000),
  category:z.enum(CATEGORIES),difficulty:z.enum(DIFFICULTIES),
  visibility:z.enum(["practice","competition"]).optional(),
  tags:tagsInput.default([]),
  xp:z.number().int().min(0).max(1000),estimatedMinutes:z.number().int().min(1).max(480),
  flag:z.string().trim().min(8).max(200).regex(/^dfctf\{[^\r\n{}]+\}$/i, "Use dfCTF{your_flag}.").transform(canonicalFlag),
  flagFormat:flagFormatInput.default("dfCTF{...}")
}).strict();
export const challengePatchInput=z.union([
  z.object({status:z.enum(["draft","review","archived"])}).strict(),
  challengeInput.partial().extend({tags:tagsInput.optional(),flagFormat:flagFormatInput.optional()}).strict()
]);
export const submissionInput=z.object({flag:z.string().max(1000).transform(value=>value.trim()).pipe(z.string().min(1).max(200))}).strict();
