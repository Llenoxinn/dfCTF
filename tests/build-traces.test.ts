import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const script = path.resolve("scripts/verify-build-traces.mjs");
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "dfctf-build-traces-"));
  await mkdir(path.join(directory, ".next", "server"), { recursive: true });
});
afterEach(async () => {
  expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(directory)).toMatch(/^dfctf-build-traces-/);
  await rm(directory, { recursive: true, force: true });
});

const verify = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8" });

describe("deployment build traces", () => {
  it.each(["next-server.js.nft.json", "next-minimal-server.js.nft.json", "server/app/page.js.nft.json"])("rejects and cleans private files in %s", async name => {
    const filename = path.join(directory, ".next", name);
    await mkdir(path.dirname(filename), { recursive: true });
    const files = ["public/icon.svg", ".env.local", ".data/mail/message.json", "test-results/result.json", "playwright-report/index.html"]
      .map(file => path.relative(path.dirname(filename), path.join(directory, file)));
    await writeFile(filename, JSON.stringify({ version: 1, files }));

    const rejected = verify();
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("Refusing deployment: 4 excluded files");
    expect(verify("--clean").status).toBe(0);
    expect(JSON.parse(await readFile(filename, "utf8"))).toEqual({ version: 1, files: [files[0]] });
    expect(verify().status).toBe(0);
  });

  it("rejects builds without deployable manifests and ignores cache manifests", async () => {
    const cached = path.join(directory, ".next", "cache");
    await mkdir(cached);
    await writeFile(path.join(cached, "cached.nft.json"), "not a deployment manifest");
    const result = verify();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No build manifests found");
  });
});
