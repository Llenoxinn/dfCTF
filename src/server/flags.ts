import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
export function localSecret(name:"auth"|"flags") {
  const env=name==="auth"?process.env.AUTH_SECRET:process.env.FLAG_SECRET;
  if(env && env.length>=32) return env;
  if(process.env.NODE_ENV==="production") throw new Error(`${name === "auth"?"AUTH_SECRET":"FLAG_SECRET"} must contain at least 32 characters in production.`);
  const dir=path.join(process.cwd(),".data");mkdirSync(dir,{recursive:true});const file=path.join(dir,`${name}.secret`);
  try {return readFileSync(file,"utf8").trim();}catch {
    const secret=globalThis.crypto.randomUUID()+globalThis.crypto.randomUUID();
    try {writeFileSync(file,secret,{flag:"wx",mode:0o600});return secret;}catch {return readFileSync(file,"utf8").trim();}
  }
}
/** The wrapper is always written dfCTF{...}; players who type it in another case still match. */
export function canonicalFlag(flag:string) {return flag.trim().replace(/^dfctf\{/i,"dfCTF{");}
export function flagDigest(flag:string,secret=localSecret("flags")) {return createHmac("sha256",secret).update(flag.trim(),"utf8").digest("hex");}
export function matchesFlag(candidate:string,expected:string,secret=localSecret("flags")) {
  const stored=Buffer.from(expected,"hex");
  // Older digests used a lowercase wrapper; the answer inside remains case-sensitive.
  const canonical=canonicalFlag(candidate);
  return [candidate,canonical,canonical.replace(/^dfCTF\{/,"dfctf{")].some(value=>{const actual=Buffer.from(flagDigest(value,secret),"hex");return stored.length===actual.length&&timingSafeEqual(actual,stored);});
}
