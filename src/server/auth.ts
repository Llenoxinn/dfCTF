import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { hash, verify } from "@node-rs/argon2";
import { isIP } from "node:net";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, type Database } from "./db";
import * as authSchema from "./auth-schema";
import { allowlist } from "./schema";
import { localSecret } from "./flags";
import { sendAuthEmail } from "./mail";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from "../lib/password-policy";

const commonPasswords = new Set([
  "password1!", "password123!", "qwerty123!", "welcome1!", "admin123!",
  "passwordpassword", "passwordpassword123", "password123456789", "password1234567890",
  "123456789012345", "1234567890123456", "12345678901234567890", "123456789123456789",
  "qwertyuiopasdfgh", "qwertyuiopasdfghjkl", "qwerty1234567890", "letmeinletmein123",
  "iloveyouiloveyou", "adminadminadmin", "welcome123456789", "abcdefghijklmnop",
]);
const protectedAuthPaths = new Set([
  "/update-user", "/change-email", "/change-password", "/set-password", "/delete-user", "/delete-user/callback",
  "/link-social", "/unlink-account", "/get-access-token", "/refresh-token", "/account-info", "/list-accounts",
  "/list-sessions", "/revoke-session", "/revoke-other-sessions", "/revoke-sessions",
]);
const sensitiveMfaPaths = new Set([
  "/two-factor/disable", "/two-factor/get-totp-uri", "/two-factor/generate-backup-codes", "/two-factor/view-backup-codes",
]);
const verifyMfaPaths = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

async function limitActiveMfaAttempts(db: Database, userId: string) {
  const now = Date.now();
  const cutoff = now - 60_000;
  const table = authSchema.rateLimit;
  const [attempt] = await db.insert(table).values({ id: crypto.randomUUID(), key: `staff-mfa:${userId}`, count: 1, lastRequest: now }).onConflictDoUpdate({
    target: table.key,
    set: {
      count: sql`CASE WHEN ${table.lastRequest} <= ${cutoff} THEN 1 ELSE ${table.count} + 1 END`,
      lastRequest: sql`CASE WHEN ${table.lastRequest} <= ${cutoff} THEN ${now} ELSE ${table.lastRequest} END`,
    },
  }).returning({ count: table.count });
  if (attempt.count > 5) throw new APIError("TOO_MANY_REQUESTS", {
    code: "TOO_MANY_ATTEMPTS", message: "Too many authenticator attempts. Wait one minute and try again.",
  });
}

export function configuredProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };
}

export async function isEmailAllowed(email: string, db?: Database) {
  const connection = db ?? await getDb();
  const [entry] = await connection.select({ revokedAt: allowlist.revokedAt, expiresAt: allowlist.expiresAt })
    .from(allowlist).where(eq(allowlist.email, email.trim().toLowerCase())).limit(1);
  // Registration is open; existing suspensions and expired access still take effect immediately.
  return !entry || (!entry.revokedAt && (!entry.expiresAt || entry.expiresAt > new Date()));
}

export function createAuth(db: Database) {
  const providers = configuredProviders();
  const appURL = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  return betterAuth({
    appName: "dfCTF",
    baseURL: appURL,
    secret: localSecret("auth"),
    trustedOrigins: process.env.NODE_ENV === "production" ? [appURL] : [appURL, "http://localhost:3000", "http://127.0.0.1:3000"],
    // Production ingress overwrites this header with the client's address.
    advanced: { ipAddress: { ipAddressHeaders: [process.env.NODE_ENV === "production" ? "x-real-ip" : "x-forwarded-for"] } },
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      password: {
        // Algorithm 2 is Argon2id; the package's ambient const enum is not usable with isolatedModules.
        hash: (password) => hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 }),
        verify: ({ hash: digest, password }) => verify(digest, password),
      },
      sendResetPassword: ({ user, url }) => sendAuthEmail(user.email, "Reset your dfCTF password", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: ({ user, url }) => sendAuthEmail(user.email, "Verify your dfCTF email", url),
    },
    socialProviders: {
      ...(providers.google ? { google: {
        clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        requireEmailVerification: true,
      } } : {}),
      ...(providers.github ? { github: {
        clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        requireEmailVerification: true,
      } } : {}),
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: ["google", "github"],
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
    verification: { storeIdentifier: "hashed" },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        // Better Auth's server-only setPassword has an operation ID but no URL path.
        const path = "operationId" in context && context.operationId === "setPassword" ? "/set-password" : context.path;
        if (process.env.NODE_ENV === "production" && context.request) {
          const ip = context.request.headers.get("x-real-ip") || "";
          // Scoped IPv6 is accepted by Node but not by Better Auth's IP parser.
          if (!isIP(ip) || ip.includes("%")) throw new APIError("FORBIDDEN", {
            code: "TRUSTED_PROXY_REQUIRED", message: "Authentication requires a valid client IP from the trusted reverse proxy.",
          });
        }
        if (protectedAuthPaths.has(path) || path.startsWith("/two-factor/")) {
          const active = await getSessionFromCtx(context, { disableCookieCache: true });
          if (active) {
            const [identity] = await db.select({
              id: authSchema.user.id, email: authSchema.user.email, emailVerified: authSchema.user.emailVerified,
              role: authSchema.user.role, twoFactorEnabled: authSchema.user.twoFactorEnabled,
            }).from(authSchema.user).where(eq(authSchema.user.id, active.user.id)).limit(1);
            if (!identity?.emailVerified || !(await isEmailAllowed(identity.email, db))) {
              throw new APIError("FORBIDDEN", { code: "ACCESS_DENIED", message: "This account does not currently have access to dfCTF." });
            }
            const needsStaffGrant = identity.role !== "participant" && (
              sensitiveMfaPaths.has(path) || (path === "/two-factor/enable" && identity.twoFactorEnabled)
            );
            if (needsStaffGrant) {
              const [grant] = await db.select({ id: authSchema.staffVerification.sessionId }).from(authSchema.staffVerification).where(and(
                eq(authSchema.staffVerification.sessionId, active.session.id), gt(authSchema.staffVerification.expiresAt, new Date()),
              )).limit(1);
              if (!identity.twoFactorEnabled || !grant) {
                throw new APIError("FORBIDDEN", { code: "MFA_REQUIRED", message: "Verify your authenticator before changing or retrieving security credentials." });
              }
            }
            // Apply this at the native endpoint seam: direct Better Auth calls
            // and the application wrapper share the same per-account budget.
            if (verifyMfaPaths.has(path)) await limitActiveMfaAttempts(db, identity.id);
          }
        }
        const passwords = path === "/sign-up/email" ? [context.body?.password]
          : ["/reset-password", "/change-password", "/set-password"].includes(path) ? [context.body?.newPassword] : [];
        for (const password of passwords) {
          if (typeof password === "string" && commonPasswords.has(password.toLowerCase())) {
            throw new APIError("BAD_REQUEST", { code: "PASSWORD_TOO_COMMON", message: "Choose a less common password or a longer passphrase." });
          }
          if (typeof password === "string" && (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH || !PASSWORD_PATTERN.test(password))) {
            throw new APIError("BAD_REQUEST", { code: "PASSWORD_REQUIREMENTS_NOT_MET", message: PASSWORD_REQUIREMENTS });
          }
        }
      }),
    },
    user: {
      additionalFields: {
        codename: { type: "string", required: false, input: false },
        codenameKey: { type: "string", required: false, input: false, returned: false },
        role: { type: ["participant", "author", "reviewer", "admin"], defaultValue: "participant", required: false, input: false },
      },
      validateUserInfo: async ({ user: identity }) => {
        if (typeof identity.email !== "string" || !(await isEmailAllowed(identity.email, db))) {
          return { error: "access_denied", errorDescription: "This email does not have access to dfCTF." };
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (identity) => {
            const email = identity.email.trim().toLowerCase();
            if (!(await isEmailAllowed(email, db))) {
              throw new APIError("FORBIDDEN", { code: "ACCESS_DENIED", message: "This email does not have access to dfCTF." });
            }
            // Track new accounts for admin revocation without reactivating an existing suspension.
            await db.insert(allowlist).values({ id: crypto.randomUUID(), email }).onConflictDoNothing();
            return { data: { ...identity, email } };
          },
        },
        update: {
          before: async (identity) => {
            if (identity.email && !(await isEmailAllowed(identity.email, db))) {
              throw new APIError("FORBIDDEN", { code: "ACCESS_DENIED", message: "This email does not have access to dfCTF." });
            }
            return { data: identity };
          },
        },
      },
      session: {
        create: {
          before: async (pending) => {
            const [identity] = await db.select({ email: authSchema.user.email }).from(authSchema.user).where(eq(authSchema.user.id, pending.userId)).limit(1);
            if (!identity || !(await isEmailAllowed(identity.email, db))) {
              throw new APIError("FORBIDDEN", { code: "ACCESS_DENIED", message: "This account no longer has access to dfCTF." });
            }
            return { data: pending };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
      },
    },
    plugins: [twoFactor({ issuer: "dfCTF", allowPasswordless: true }), nextCookies()],
    logger: { level: "error" },
  });
}

export type Auth = ReturnType<typeof createAuth>;
const authGlobal = globalThis as unknown as { dfctfAuth?: Promise<Auth> };
export function getAuth(): Promise<Auth> {
  authGlobal.dfctfAuth ??= getDb().then(createAuth);
  return authGlobal.dfctfAuth;
}

/** Calls the real HTTP handler so Better Auth's CSRF and rate limits still run. */
export async function invokeAuth(request: Request, endpoint: string, body: unknown) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const base = process.env.APP_URL || "http://localhost:3000";
  return (await getAuth()).handler(new Request(new URL(`/api/auth${endpoint}`, base), {
    method: "POST", headers, body: JSON.stringify(body),
  }));
}

export function forwardAuthCookies(source: Response, destination: Response) {
  for (const cookie of source.headers.getSetCookie()) destination.headers.append("set-cookie", cookie);
}

export function headersAfterAuth(request: Request, response: Response) {
  const headers = new Headers(request.headers);
  const cookies = new Map<string, string>();
  for (const part of (headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  return headers;
}
