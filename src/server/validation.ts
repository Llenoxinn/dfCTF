import { z } from "zod";
import { challengeContentInput, flagFormatInput, tagsInput } from "@/lib/challenge-validation";
import { canonicalFlag } from "./flags";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
export function codenameKey(value:string) {return value.toLowerCase().replace(/0/g,"o").replace(/[1il]/g,"l");}
const reserved=new Set(["admin","administrator","staff","mod","moderator","system","root","dfctf","support"].map(codenameKey));
export const codenameSchema=z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/,"Use letters, numbers, underscores, periods, or hyphens.").refine(value=>!reserved.has(codenameKey(value)),"Choose a codename that does not impersonate staff.");
/** The one-line summary for lists and search: the description's first sentence, so authors write the prompt once.
 *  shortcut: it ends at the first ". ", "! " or "? ", so "e.g. " cuts it short; send an explicit summary if that matters. */
export function summarize(description:string) {
  const parser=unified().use(remarkParse).use(remarkGfm);
  const tree=parser.parse(description);
  const block=tree.children.find(node=>node.type==="paragraph"||node.type==="list"||node.type==="blockquote");
  const paragraph=block?.type==="list"?block.children[0]?.children.find(node=>node.type==="paragraph"):block?.type==="blockquote"?block.children.find(node=>node.type==="paragraph"):block;
  const plain=toString(paragraph??tree,{includeHtml:false}).replace(/\s+/g," ").trim();
  const sentence=plain.match(/^.+?[.!?](?=\s|$)/)?.[0]??plain;
  return sentence.length<=240?sentence:sentence.slice(0,239).replace(/\s+\S*$/,"")+"…";
}
export const challengeInput=challengeContentInput.extend({flag:challengeContentInput.shape.flag.transform(canonicalFlag)});
export const challengePatchInput=challengeInput.partial().extend({
  tags:tagsInput.optional(),flagFormat:flagFormatInput.optional(),status:z.enum(["draft","review","archived"]).optional()
}).strict().refine(input=>!("status" in input)||Object.keys(input).length===1,{
  message:"Change the status separately from challenge content.",path:["status"]
});
export const submissionInput=z.object({flag:z.string().max(1000).transform(value=>value.trim()).pipe(z.string().min(1).max(200))}).strict();
