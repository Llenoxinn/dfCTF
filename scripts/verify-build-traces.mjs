import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, ".next");
const traces = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && (directory !== output || entry.name === "server")) await collect(filename);
    else if (entry.isFile() && entry.name.endsWith(".nft.json")) traces.push(filename);
  }
}
await collect(output);
if (!traces.length) throw new Error("No build manifests found. Build the application before checking its package.");

const forbidden = new Set([".data", "test-results", "playwright-report"]);
const violations = new Set();
const clean = process.argv.includes("--clean");
let removed = 0;
for (const trace of traces) {
  const manifest = JSON.parse(await readFile(trace, "utf8"));
  const kept = manifest.files.filter(file => {
    const relative = path.relative(root, path.resolve(path.dirname(trace), file));
    const first = relative.split(path.sep)[0];
    const blocked = forbidden.has(first) || first === ".env" || first.startsWith(".env.");
    if (blocked && !clean) violations.add(relative);
    return !blocked;
  });
  if (clean && kept.length !== manifest.files.length) {
    // Next's exclusion matching uses native paths; Windows backslashes can leave entries behind.
    removed += manifest.files.length - kept.length;
    await writeFile(trace, JSON.stringify({ ...manifest, files: kept }));
  }
}
if (violations.size) {
  console.error("Build manifests include private local files or test output:");
  for (const file of [...violations].slice(0, 10)) console.error(file);
  throw new Error(`Refusing deployment: ${violations.size} excluded files remain in the build manifests.`);
}
if (clean) console.log(`Removed ${removed} private/local file references from ${traces.length} build manifests.`);
else console.log(`Verified ${traces.length} build manifests: no local data, environment files, or test output.`);
