import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import IntegrationCleanup from "../scripts/integration-reporter";

const temporaryRoot = process.platform === "win32" && path.parse(tmpdir()).root !== path.parse(process.cwd()).root ? path.dirname(process.cwd()) : tmpdir();
const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(path.join(temporaryRoot, "dfctf-integration-"));
  directories.push(directory);
  vi.stubEnv("DFCTF_INTEGRATION_DIR", directory);
  vi.stubEnv("DFCTF_INTEGRATION_TOKEN", "a".repeat(64));
  return directory;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    expect(path.dirname(directory)).toBe(path.resolve(temporaryRoot));
    expect(path.basename(directory)).toMatch(/^dfctf-integration-/);
    await rm(directory, { recursive: true, force: true });
  }
});

describe("integration cleanup ownership", () => {
  it.each([null, "b".repeat(64)])("preserves a directory without the current run marker: %s", async marker => {
    const directory = await fixture();
    await writeFile(path.join(directory, "keep.txt"), "Keep this existing file.");
    if (marker) await writeFile(path.join(directory, ".dfctf-integration-owner"), marker);
    await new IntegrationCleanup().onExit();
    expect(await readFile(path.join(directory, "keep.txt"), "utf8")).toBe("Keep this existing file.");
  });

  it("removes an owned fixture while preserving its linked dependencies", async () => {
    const directory = await fixture();
    const dependencies = await mkdtemp(path.join(temporaryRoot, "dfctf-integration-"));
    directories.push(dependencies);
    const content = randomBytes(16);
    await writeFile(path.join(dependencies, "keep.bin"), content);
    await writeFile(path.join(directory, ".dfctf-integration-owner"), "a".repeat(64));
    await symlink(dependencies, path.join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await new IntegrationCleanup().onExit();
    await expect(lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(dependencies, "keep.bin"))).toEqual(content);
  });
});
