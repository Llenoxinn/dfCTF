import { pgTable, text, integer, timestamp, boolean, jsonb, uniqueIndex, index, check, primaryKey, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
import type { LearningProgress } from "@/lib/resource-learning";
export * from "./auth-schema";

export const playerProfiles = pgTable("player_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default(""),
  bio: text("bio").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  githubUrl: text("github_url").notNull().default(""),
  shareProfile: boolean("share_profile").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const friendships = pgTable("friendships", {
  lowUserId: text("low_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  highUserId: text("high_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.lowUserId, table.highUserId] }),
  index("friendships_recipient").on(table.highUserId),
  check("friendship_pair", sql`${table.lowUserId} collate "C" < ${table.highUserId} collate "C"`),
  check("friendship_requester", sql`${table.requestedBy} in (${table.lowUserId}, ${table.highUserId})`),
  check("friendship_status", sql`${table.status} in ('pending','accepted','declined')`),
]).enableRLS();

export const learningProgress = pgTable("learning_progress", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  progress: jsonb("progress").$type<LearningProgress>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
  fromDriver: value => Buffer.from(value),
});
export const allowlist = pgTable("allowlist", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  expiresAt: timestamp("expires_at", {withTimezone:true}), revokedAt: timestamp("revoked_at", {withTimezone:true}), createdAt: at("created_at")
}).enableRLS();
export const challenges = pgTable("challenges", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), familyId: text("family_id").notNull(),
  authorId: text("author_id").notNull().references(()=>user.id),
  status: text("status", {enum:["draft","review","published","archived"]}).notNull().default("draft"),
  visibility: text("visibility", {enum:["practice","competition"]}).notNull().default("practice"),
  currentVersion: integer("current_version").notNull().default(1),
  reviewerId: text("reviewer_id").references(()=>user.id), publishedAt: timestamp("published_at", {withTimezone:true}), createdAt: at("created_at"), updatedAt: at("updated_at")
}).enableRLS();
export const challengeVersions = pgTable("challenge_versions", {
  id: text("id").primaryKey(), challengeId: text("challenge_id").notNull().references(()=>challenges.id), version: integer("version").notNull(),
  title: text("title").notNull(), summary: text("summary").notNull(), description: text("description").notNull(),
  category: text("category").notNull(), difficulty: text("difficulty").notNull(), tags: jsonb("tags").$type<string[]>().notNull(),
  xp: integer("xp").notNull(), estimatedMinutes: integer("estimated_minutes").notNull(),
  flagFormat: text("flag_format").notNull().default("dfctf{...}"), flagHash: text("flag_hash").notNull(),
  solution: text("solution").notNull(), locked: boolean("locked").notNull().default(false), createdAt: at("created_at")
}, t=>[uniqueIndex("challenge_version_unique").on(t.challengeId,t.version), check("xp_positive",sql`${t.xp} >= 0`)]).enableRLS();
export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  name: text("name").notNull(), storageKey: text("storage_key").notNull(), size: integer("size").notNull(), sha256: text("sha256").notNull(), createdAt: at("created_at")
}).enableRLS();
export const artifactContents = pgTable("artifact_contents", {
  artifactId: text("artifact_id").primaryKey().references(()=>artifacts.id, {onDelete:"cascade"}),
  content: bytea("content").notNull(),
}, ()=>[check("artifact_contents_size",sql.raw("octet_length(content) BETWEEN 1 AND 10485760"))]).enableRLS();
export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  challengeId: text("challenge_id").notNull().references(()=>challenges.id), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  digest: text("digest").notNull(), correct: boolean("correct").notNull(), createdAt: at("created_at")
}, t=>[index("submissions_user_challenge").on(t.userId,t.challengeId)]).enableRLS();
export const solves = pgTable("solves", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  challengeId: text("challenge_id").notNull().references(()=>challenges.id), versionId: text("version_id").notNull().references(()=>challengeVersions.id),
  assistance: text("assistance").notNull().default("independent"), createdAt: at("created_at")
},t=>[uniqueIndex("solve_once").on(t.userId,t.challengeId), index("solve_owner_history").on(t.userId,t.createdAt,t.id), index("solve_first_blood").on(t.challengeId,t.createdAt,t.id)]).enableRLS();
export const xpLedger = pgTable("xp_ledger", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  familyId: text("family_id").notNull(), solveId: text("solve_id").notNull().references(()=>solves.id),
  amount: integer("amount").notNull(), reason: text("reason").notNull().default("first_solve"), createdAt: at("created_at")
}, t=>[uniqueIndex("xp_once_per_family").on(t.userId,t.familyId)]).enableRLS();
// shortcut: unused since flag submissions dropped idempotency keys; drop it in a later release so a rollback to the previous image can still write it.
export const requestResults = pgTable("request_results", {
  key: text("key").primaryKey(), userId: text("user_id").notNull().references(()=>user.id),
  operation: text("operation").notNull(), fingerprint: text("fingerprint").notNull(), response: jsonb("response").notNull(), createdAt: at("created_at")
}).enableRLS();
export const rateLimits = pgTable("app_rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), windowStart: timestamp("window_start",{withTimezone:true}).notNull()
}).enableRLS();
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetId: text("target_id").notNull(), metadata: jsonb("metadata").$type<Record<string,unknown>>().notNull().default({}), createdAt: at("created_at")
}).enableRLS();

export const competitions = pgTable("competitions", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description").notNull(),
  rules: text("rules").notNull().default(""), platform: text("platform", {enum:["dfctf","ctfd"]}).notNull(),
  externalUrl: text("external_url"), status: text("status", {enum:["draft","published","archived"]}).notNull().default("draft"),
  startsAt: timestamp("starts_at", {withTimezone:true}).notNull(), endsAt: timestamp("ends_at", {withTimezone:true}).notNull(),
  createdBy: text("created_by").notNull().references(()=>user.id), createdAt: at("created_at"), updatedAt: at("updated_at"),
},t=>[check("competition_dates",sql`${t.endsAt} > ${t.startsAt}`)]).enableRLS();
export const competitionChallenges = pgTable("competition_challenges", {
  competitionId: text("competition_id").notNull().references(()=>competitions.id),
  challengeId: text("challenge_id").notNull().references(()=>challenges.id), points: integer("points").notNull(),
},t=>[primaryKey({columns:[t.competitionId,t.challengeId]}),uniqueIndex("competition_challenge_exclusive").on(t.challengeId),check("competition_points_positive",sql`${t.points} > 0`)]).enableRLS();
export const competitionRegistrations = pgTable("competition_registrations", {
  competitionId: text("competition_id").notNull().references(()=>competitions.id),
  userId: text("user_id").notNull().references(()=>user.id), joinedAt: at("joined_at"),
},t=>[primaryKey({columns:[t.competitionId,t.userId]})]).enableRLS();
export const competitionSolves = pgTable("competition_solves", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(()=>competitions.id),
  userId: text("user_id").notNull().references(()=>user.id), challengeId: text("challenge_id").notNull().references(()=>challenges.id),
  points: integer("points").notNull(), createdAt: at("created_at"),
},t=>[uniqueIndex("competition_solve_once").on(t.competitionId,t.userId,t.challengeId),index("competition_solve_order").on(t.competitionId,t.challengeId,t.createdAt,t.id)]).enableRLS();
export const competitionSubmissions = pgTable("competition_submissions", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(()=>competitions.id),
  userId: text("user_id").notNull().references(()=>user.id), challengeId: text("challenge_id").notNull().references(()=>challenges.id),
  digest: text("digest").notNull(), correct: boolean("correct").notNull(), createdAt: at("created_at"),
},t=>[index("competition_attempt_lookup").on(t.competitionId,t.userId,t.challengeId)]).enableRLS();
