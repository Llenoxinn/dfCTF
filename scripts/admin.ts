import "../src/server/load-env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb,closeDatabase } from "../src/server/db";
import { user,allowlist } from "../src/server/schema";
import { audit } from "../src/server/challenges";
const [action,input]=process.argv.slice(2);
const email=z.email().parse(input).toLowerCase();const db=await getDb();
if(action==="allow") {
  const [entry]=await db.insert(allowlist).values({id:randomUUID(),email}).onConflictDoUpdate({target:allowlist.email,set:{revokedAt:null,expiresAt:null}}).returning();
  await audit(db,"server-console","allowlist.add",entry.id);console.log("Account access restored. Email verification is still required.");
} else if(action==="grant") {
  const [account]=await db.select().from(user).where(eq(user.email,email));
  if(!account?.emailVerified)throw new Error("Register and verify this account's email before granting administrator access.");
  await db.update(user).set({role:"admin"}).where(eq(user.id,account.id));await audit(db,"server-console","role.admin.grant",account.id);
  console.log("Administrator role granted. Enroll and verify an authenticator before using staff tools.");
} else if(action==="revoke") {
  const [entry]=await db.update(allowlist).set({revokedAt:new Date()}).where(eq(allowlist.email,email)).returning();
  if(!entry)throw new Error("No matching account access entry.");await audit(db,"server-console","allowlist.revoke",entry.id);console.log("Access revoked. Existing sessions cannot access protected operations.");
} else throw new Error("Usage: npm run admin -- allow|grant|revoke email@example.edu");
await closeDatabase();
