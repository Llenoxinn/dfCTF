import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import * as schema from "./schema";
import { validateRuntimeConfig } from "./config";

export type Database = NodePgDatabase<typeof schema>;
type Store = { db: Database; close: ()=>Promise<void>; migrate: ()=>Promise<void> };
const globalStore = globalThis as unknown as {dfctfStore?: Promise<Store>};
export async function createStore(url?:string, memory = false): Promise<Store> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (url) {
    const pool = new Pool({connectionString:url, max:10});
    const db = drizzle(pool,{schema});
    return {db, close:()=>pool.end(), migrate:()=>migratePg(db,{migrationsFolder})};
  }
  if (process.env.NODE_ENV === "production" && !memory) throw new Error("DATABASE_URL is required in production.");
  const dataDir = memory ? undefined : path.resolve(process.env.PGLITE_DIR || ".data/postgres");
  if(dataDir) await mkdir(dataDir,{recursive:true});
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = pgliteDrizzle(client,{schema});
  return {db:db as unknown as Database, close:()=>client.close(), migrate:()=>migratePglite(db,{migrationsFolder})};
}
async function getStore() {
  globalStore.dfctfStore ??= (async()=>{
    validateRuntimeConfig();
    const store = await createStore(process.env.DATABASE_URL);
    if(process.env.NODE_ENV !== "production") await store.migrate();
    return store;
  })();
  return globalStore.dfctfStore;
}
export async function getDb(): Promise<Database> { return (await getStore()).db; }
export async function migrateDatabase() { await (await getStore()).migrate(); }
export async function closeDatabase() { if(globalStore.dfctfStore) await (await globalStore.dfctfStore).close(); delete globalStore.dfctfStore; }
