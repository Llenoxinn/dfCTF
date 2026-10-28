import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("real accounts sync learning across devices while guest and other-account data stay separate", async ({ browser, baseURL }) => {
  const fixture = JSON.parse(await readFile(path.join(process.env.DFCTF_INTEGRATION_DIR!, "fixture.json"), "utf8"));
  const first = await browser.newContext({ baseURL }), second = await browser.newContext({ baseURL }), other = await browser.newContext({ baseURL });
  try {
    for (const [context, email] of [[first, fixture.learners.learner], [second, fixture.learners.learner], [other, fixture.learners.otherLearner]] as const) {
      const signIn = await context.request.post("/api/auth/sign-in/email", { data: { email, password: fixture.learners.password }, headers: { Origin: baseURL!, "X-dfCTF-Request": "1" } });
      expect(signIn.ok()).toBe(true);
    }
    const page = await first.newPage(); await page.goto("/resources");
    await page.getByRole("button", { name: "Bookmark General skills", exact: true }).click();
    await page.getByRole("region", { name: "Find your next topic" }).getByRole("link", { name: "General skills", exact: true }).click();
    await page.getByRole("button", { name: "Mark topic read", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved to your account");
    const device = await second.newPage(); await device.goto("/resources");
    await expect(device.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(device.getByRole("region", { name: "Your learning" })).toContainText("1 of 15 topics marked read");
    expect(await device.evaluate(() => localStorage.getItem("dfctf:learning:v1"))).toBeNull();
    const outsider = await other.newPage(); await outsider.goto("/resources");
    await expect(outsider.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "false");
    const identity = (await (await first.request.get("/api/v1/auth/bootstrap")).json()).user.id;
    const forbidden = await other.request.get("/api/v1/learning/progress", { headers: { "X-dfCTF-Account": identity } });
    expect(forbidden.status()).toBe(409);
    expect((await first.request.post("/api/auth/sign-out", { data: {}, headers: { Origin: baseURL!, "X-dfCTF-Request": "1" } })).ok()).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("status")).toContainText("Sign in to continue");
    await expect(page.getByRole("button", { name: "Bookmark topic", exact: true })).toBeDisabled();
    await page.goto("/resources");
    await expect(page.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "false");
    const expired = await first.request.patch("/api/v1/learning/progress", { data: {}, headers: { Origin: baseURL!, "X-dfCTF-Account": identity } });
    expect(expired.status()).toBe(401);
  } finally { await first.close(); await second.close(); await other.close(); }
});
