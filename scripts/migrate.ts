import "../src/server/load-env";
import { createStore } from "../src/server/db";
const store=await createStore(process.env.DATABASE_MIGRATION_URL||process.env.DATABASE_URL);
try { await store.migrate(); } finally { await store.close(); }
console.log("Database migrations applied.");
