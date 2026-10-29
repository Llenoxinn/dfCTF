import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const fixtures = JSON.parse(await readFile(new URL("staff-review.json", root), "utf8"));
assert.equal(fixtures.length, 3);
assert.equal(new Set(fixtures.map(fixture => fixture.category)).size, 3);

for (const fixture of fixtures) {
  assert.match(fixture.flag, /^dfCTF\{[^{}\r\n]+\}$/);
  const directory = new URL(`player/${fixture.directory}/`, root);
  const description = await readFile(new URL("description.md", directory), "utf8");
  const bytes = await readFile(new URL(fixture.artifact, directory));
  const text = bytes.toString("utf8");
  assert(!/dfctf\{(?!\.\.\.\})[^}]+\}/i.test(description), `${fixture.title}: description reveals an answer`);
  assert(bytes.length > 0 && bytes.length < 10 * 1024 * 1024 && !bytes.includes(0));
  let recovered;
  if (fixture.directory === "first-contact") recovered = text.match(/dfCTF\{[^}]+\}/)?.[0];
  if (fixture.directory === "midnight-request") recovered = decodeURIComponent(text.match(/evidence=([^\s]+)/)?.[1] ?? "");
  if (fixture.directory === "cookie-crumbs") recovered = Buffer.from(text.match(/training_evidence=([^;\s]+)/)?.[1] ?? "", "base64").toString("utf8");
  assert.equal(recovered, fixture.flag, `${fixture.title}: artifact and staff key disagree`);
  console.log(`${fixture.artifact}: ${bytes.length} bytes; SHA-256 ${createHash("sha256").update(bytes).digest("hex")}`);
}
console.log("Three staging fixtures passed. This check does not establish independent human review.");
