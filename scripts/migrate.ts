import "../src/server/load-env";
import { migrateDatabase,closeDatabase } from "../src/server/db";
await migrateDatabase();
await closeDatabase();
console.log("Database migrations applied.");
