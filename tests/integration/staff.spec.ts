import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

// Independent RFC 6238 code generator, using only Node's standard HMAC implementation.
function authenticatorCode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=/g, "")].map(character => alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  return ((digest.readUInt32BE(digest.at(-1)! & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

test("real staff MFA, draft-file removal and independent publication keep published files locked", async ({ playwright }) => {
  const fixture = JSON.parse(await readFile(path.join(process.env.DFCTF_INTEGRATION_DIR!, "fixture.json"), "utf8")) as {
    staff: { author: string; reviewer: string; password: string };
  };
  const options = { baseURL: "http://127.0.0.1:3200", extraHTTPHeaders: { Origin: "http://127.0.0.1:3200", "X-dfCTF-Request": "1" } };
  const author = await playwright.request.newContext(options), reviewer = await playwright.request.newContext(options);
  try {
    for (const [client, email] of [[author, fixture.staff.author], [reviewer, fixture.staff.reviewer]] as const) {
      let signedIn = await client.post("/api/auth/sign-in/email", { data: { email, password: fixture.staff.password } });
      // All contexts share loopback's auth budget; honor a preceding test's server-issued cooldown.
      if (signedIn.status() === 429) {
        const seconds = Number(signedIn.headers()["retry-after"] ?? 10);
        expect(seconds).toBeGreaterThanOrEqual(0); expect(seconds).toBeLessThanOrEqual(60);
        await new Promise(resolve => setTimeout(resolve, (seconds + 1) * 1000));
        signedIn = await client.post("/api/auth/sign-in/email", { data: { email, password: fixture.staff.password } });
      }
      expect(signedIn.status()).toBe(200);
      const locked = await client.get("/api/v1/staff/challenges");
      expect(locked.status()).toBe(403);
      expect((await locked.json()).error.code).toBe("MFA_REQUIRED");
      const setup = await client.post("/api/v1/auth/mfa/setup", { data: { password: fixture.staff.password } });
      expect(setup.ok()).toBe(true);
      const secret = new URL((await setup.json()).totpURI).searchParams.get("secret")!;
      expect((await client.post("/api/v1/auth/mfa/verify", { data: { code: authenticatorCode(secret) } })).ok()).toBe(true);
      expect(await (await client.get("/api/v1/auth/bootstrap")).json()).toMatchObject({ staffVerified: true });
    }

    const flag = "dfCTF{staff_synthetic_fixture}";
    const created = await author.post("/api/v1/staff/challenges", { data: {
      title: "Staff integration training case", summary: "A synthetic case for testing draft files and independent review.",
      description: "Use the synthetic fixture evidence to verify staff publication boundaries.",
      solution: "The test provides a synthetic answer so publication checks do not solve real challenges.",
      category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 1, flag,
    } });
    expect(created.status()).toBe(201);
    const { id } = await created.json(), endpoint = `/api/v1/staff/challenges/${id}`;
    const uploaded = [] as { id: string; name: string }[];
    for (const name of ["wrong.txt", "replacement.txt"]) {
      const response = await author.post(`${endpoint}/files`, { multipart: { file: { name, mimeType: "text/plain", buffer: Buffer.from(`Synthetic ${name} evidence.\n`) } } });
      expect(response.status()).toBe(201);
      uploaded.push(await response.json());
    }
    expect((await reviewer.delete(`${endpoint}/files/${uploaded[0].id}`)).status()).toBe(404);
    expect((await author.delete(`${endpoint}/files/${uploaded[0].id}`)).ok()).toBe(true);
    expect((await author.get(`${endpoint}/files/${uploaded[0].id}`)).status()).toBe(404);
    expect((await author.get(`${endpoint}/files/${uploaded[1].id}`)).ok()).toBe(true);
    expect((await (await author.get(endpoint)).json()).files).toEqual([expect.objectContaining({ id: uploaded[1].id, name: "replacement.txt" })]);

    expect((await author.patch(endpoint, { data: { status: "review" } })).ok()).toBe(true);
    expect((await author.post(`${endpoint}/publish`, { data: { flag } })).status()).toBe(403);
    expect((await author.delete(`${endpoint}/files/${uploaded[1].id}`)).status()).toBe(409);
    expect((await reviewer.post(`${endpoint}/publish`, { data: { flag } })).ok()).toBe(true);
    expect((await (await author.get(endpoint)).json()).status).toBe("published");
    expect((await author.delete(`${endpoint}/files/${uploaded[1].id}`)).status()).toBe(409);
    expect((await author.get(`${endpoint}/files/${uploaded[1].id}`)).ok()).toBe(true);
  } finally {
    await author.dispose(); await reviewer.dispose();
  }
});
