import { lstat, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Reporter } from "@playwright/test/reporter";

export default class IntegrationCleanup implements Reporter {
  async onExit() {
    const directory = path.resolve(process.env.DFCTF_INTEGRATION_DIR ?? "");
    const temporaryRoot = process.platform === "win32" && path.parse(tmpdir()).root !== path.parse(process.cwd()).root ? path.dirname(process.cwd()) : tmpdir();
    if (path.dirname(directory) !== path.resolve(temporaryRoot) || !/^dfctf-integration-[A-Za-z0-9]+$/.test(path.basename(directory))) {
      throw new Error("Refusing to remove a directory outside the integration-test temporary root.");
    }
    const ownershipToken = process.env.DFCTF_INTEGRATION_TOKEN ?? "";
    const owner = await readFile(path.join(directory, ".dfctf-integration-owner"), "utf8").catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return null;
    });
    if (!/^[a-f0-9]{64}$/.test(ownershipToken) || owner !== ownershipToken) return;
    const modules = path.join(directory, "node_modules");
    const link = await lstat(modules).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return null;
    });
    if (link && !link.isSymbolicLink()) throw new Error("Integration dependencies must be a link, not a directory.");
    if (link) await unlink(modules);
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
