import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const date = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
  codename: text("codename"),
  codenameKey: text("codename_key").unique(),
  role: text("role", { enum: ["participant", "author", "reviewer", "admin"] }).notNull().default("participant"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
}, table => [index("auth_user_player_directory").on(sql`lower(${table.codename}) collate "C"`)]).enableRLS();

export const session = pgTable("auth_session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: date("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
}, (table) => [index("auth_session_user_idx").on(table.userId)]).enableRLS();

export const account = pgTable("auth_account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"),
  refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_account_provider_identity_idx").on(table.providerId, table.accountId),
  index("auth_account_user_idx").on(table.userId),
]).enableRLS();

export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").notNull().defaultNow(),
  updatedAt: date("updated_at").notNull().defaultNow(),
}, (table) => [index("auth_verification_identifier_idx").on(table.identifier)]).enableRLS();

export const twoFactor = pgTable("auth_two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").notNull().default(0),
  lockedUntil: date("locked_until"),
}, (table) => [uniqueIndex("auth_two_factor_user_idx").on(table.userId)]).enableRLS();

export const staffVerification = pgTable("staff_session_verification", {
  sessionId: text("session_id").primaryKey().references(() => session.id, { onDelete: "cascade" }),
  verifiedAt: date("verified_at").notNull().defaultNow(),
  expiresAt: date("expires_at").notNull(),
}).enableRLS();

export const rateLimit = pgTable("auth_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
}).enableRLS();
