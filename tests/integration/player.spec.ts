import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

test("real registration, verification, private download, concurrent scoring and returning progress", async ({ page }) => {
  const fixture = JSON.parse(await readFile(path.join(process.env.DFCTF_INTEGRATION_DIR!, "fixture.json"), "utf8")) as {
    challengeId: string; file: { id: string; sha256: string }; flag: string; content: string;
  };
  const email = "smoke-player@example.test", password = "synthetic smoke-test passphrase 2026";
  const download = `/api/v1/challenges/${fixture.challengeId}/files/${fixture.file.id}`;
  expect((await page.request.get(download)).status()).toBe(401);

  await page.goto("/?auth=signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Account created. Check your email to verify your address, then sign in.")).toBeVisible();
  expect((await page.request.post("/api/auth/sign-in/email", { data: { email, password } })).status()).toBe(403);

  async function message(subject: string) {
    const response = await page.request.get("/api/v1/auth/local-mail");
    expect(response.ok()).toBe(true);
    const inbox = await response.json() as { messages: { to: string; subject: string; url: string }[] };
    const found = inbox.messages.find(item => item.to === email && item.subject === subject);
    expect(found).toBeDefined();
    return found!;
  }
  const verification = await message("Verify your dfCTF email");
  expect(new URL(verification.url).origin).toBe("http://127.0.0.1:3200");
  await page.goto(verification.url);
  await page.goto("/?auth=signin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel(/^Codename/).fill("smoke_player");
  await page.getByRole("button", { name: "Save codename and start", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();

  const artifact = await page.request.get(download);
  expect(artifact.ok()).toBe(true);
  expect(artifact.headers()["content-disposition"]).toContain("attachment;");
  const bytes = await artifact.body();
  expect(bytes.toString()).toBe(fixture.content);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.file.sha256);
  const detail = await (await page.request.get(`/api/v1/challenges/${fixture.challengeId}`)).json();
  expect(detail).not.toHaveProperty("solution");
  expect((await page.request.get("/api/v1/staff/challenges")).status()).toBe(403);

  const submissions = await Promise.all([0, 1].map(index => page.request.post(`/api/v1/challenges/${fixture.challengeId}/submissions`, {
    data: { flag: fixture.flag }, headers: { "Idempotency-Key": `smoke-request-${index}` },
  })));
  expect(submissions.every(response => response.ok())).toBe(true);
  const results = await Promise.all(submissions.map(response => response.json()));
  expect(results.map(result => result.status).sort()).toEqual(["already_solved", "correct"]);
  expect(results.reduce((sum, result) => sum + result.xp, 0)).toBe(50);
  expect(await (await page.request.get("/api/v1/progress")).json()).toMatchObject({ totalXp: 50, solvedCount: 1 });

  expect((await page.request.post("/api/auth/sign-out", { data: {} })).ok()).toBe(true);
  expect((await page.request.get(download)).status()).toBe(401);
  expect((await page.request.post("/api/auth/request-password-reset", { data: { email, redirectTo: "http://127.0.0.1:3200/?reset=1" } })).ok()).toBe(true);
  const reset = await message("Reset your dfCTF password");
  expect(new URL(reset.url).origin).toBe("http://127.0.0.1:3200");
  await page.goto(reset.url);
  const replacement = "replacement synthetic smoke-test passphrase";
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByText("Password updated. Sign in with your new password.")).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(replacement);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  expect(await (await page.request.get("/api/v1/progress")).json()).toMatchObject({ totalXp: 50, solvedCount: 1 });
  expect(await (await page.request.get(`/api/v1/challenges/${fixture.challengeId}`)).json()).toMatchObject({ solved: true, solution: expect.any(String) });
  await page.reload();
  await expect(page.locator(".standing-pill")).toContainText("50 pts");
});
