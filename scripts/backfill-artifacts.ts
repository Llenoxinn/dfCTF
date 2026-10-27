import "../src/server/load-env";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, isNull } from "drizzle-orm";
import { createStore } from "../src/server/db";
import { artifacts, artifactContents } from "../src/server/schema";

const store = await createStore(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
try {
  const copied = await store.db.transaction(async tx => {
    const pending = await tx.select({ file: artifacts }).from(artifacts)
      .leftJoin(artifactContents, eq(artifacts.id, artifactContents.artifactId))
      .where(isNull(artifactContents.artifactId));
    let count = 0;
    for (const { file } of pending) {
      if (!/^[a-f0-9-]{36}$/.test(file.storageKey)) throw new Error("Invalid artifact storage key.");
      const bytes = await readFile(path.join(path.resolve(process.env.ARTIFACT_DIR || ".data/artifacts"), file.storageKey));
      const matches = (value: Buffer) => value.length === file.size && createHash("sha256").update(value).digest("hex") === file.sha256;
      if (!matches(bytes)) throw new Error("Artifact checksum mismatch; backfill rolled back.");
      const inserted = await tx.insert(artifactContents).values({ artifactId: file.id, content: bytes })
        .onConflictDoNothing().returning({ id: artifactContents.artifactId });
      const [stored] = await tx.select({ content: artifactContents.content }).from(artifactContents)
        .where(eq(artifactContents.artifactId, file.id));
      if (!stored || !matches(stored.content)) throw new Error("Stored artifact checksum mismatch; backfill rolled back.");
      count += inserted.length;
    }
    return count;
  });
  console.log("Artifact contents copied to the configured database: " + copied);
} finally {
  await store.close();
}
