import { sql } from "drizzle-orm";
import { allowlist, user } from "./schema";

/** Public standings and First Blood use eligible solvers; suspension never deletes history. */
export const notSuspended = (now: Date) => sql`not exists(select 1 from ${allowlist} where ${allowlist.email}=${user.email}
  and (${allowlist.revokedAt} is not null or ${allowlist.expiresAt}<=${now}))`;
