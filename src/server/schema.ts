import { pgTable, text, integer, timestamp, boolean, jsonb, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
export * from "./auth-schema";

const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const allowlist = pgTable("allowlist", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  expiresAt: timestamp("expires_at", {withTimezone:true}), revokedAt: timestamp("revoked_at", {withTimezone:true}), createdAt: at("created_at")
});
export const challenges = pgTable("challenges", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), familyId: text("family_id").notNull(),
  authorId: text("author_id").notNull().references(()=>user.id),
  status: text("status", {enum:["draft","review","published","archived"]}).notNull().default("draft"),
  currentVersion: integer("current_version").notNull().default(1),
  reviewerId: text("reviewer_id").references(()=>user.id), publishedAt: timestamp("published_at", {withTimezone:true}), createdAt: at("created_at"), updatedAt: at("updated_at")
});
export const challengeVersions = pgTable("challenge_versions", {
  id: text("id").primaryKey(), challengeId: text("challenge_id").notNull().references(()=>challenges.id), version: integer("version").notNull(),
  title: text("title").notNull(), summary: text("summary").notNull(), description: text("description").notNull(),
  category: text("category").notNull(), difficulty: text("difficulty").notNull(), tags: jsonb("tags").$type<string[]>().notNull(),
  xp: integer("xp").notNull(), estimatedMinutes: integer("estimated_minutes").notNull(),
  flagFormat: text("flag_format").notNull().default("dfctf{...}"), flagHash: text("flag_hash").notNull(),
  solution: text("solution").notNull(), locked: boolean("locked").notNull().default(false), createdAt: at("created_at")
}, t=>[uniqueIndex("challenge_version_unique").on(t.challengeId,t.version), check("xp_positive",sql`${t.xp} >= 0`)]);
export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  name: text("name").notNull(), storageKey: text("storage_key").notNull(), size: integer("size").notNull(), sha256: text("sha256").notNull(), createdAt: at("created_at")
});
export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  challengeId: text("challenge_id").notNull().references(()=>challenges.id), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  digest: text("digest").notNull(), correct: boolean("correct").notNull(), createdAt: at("created_at")
}, t=>[index("submissions_user_challenge").on(t.userId,t.challengeId)]);
export const solves = pgTable("solves", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  challengeId: text("challenge_id").notNull().references(()=>challenges.id), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  assistance: text("assistance").notNull().default("independent"), createdAt: at("created_at")
},t=>[uniqueIndex("solve_once").on(t.userId,t.challengeId)]);
export const xpLedger = pgTable("xp_ledger", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  familyId: text("family_id").notNull(), solveId: text("solve_id").notNull().references(()=>solves.id),
  amount: integer("amount").notNull(), reason: text("reason").notNull().default("first_solve"), createdAt: at("created_at")
}, t=>[uniqueIndex("xp_once_per_family").on(t.userId,t.familyId)]);
export const requestResults = pgTable("request_results", {
  key: text("key").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  operation: text("operation").notNull(), fingerprint: text("fingerprint").notNull(), response: jsonb("response").notNull(), createdAt: at("created_at")
});
export const rateLimits = pgTable("app_rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), windowStart: timestamp("window_start",{withTimezone:true}).notNull()
});
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetId: text("target_id").notNull(), metadata: jsonb("metadata").$type<Record<string,unknown>>().notNull().default({}), createdAt: at("created_at")
});
