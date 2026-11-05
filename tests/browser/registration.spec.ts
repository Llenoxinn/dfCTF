import { test, expect } from "@playwright/test";

test("registration can retry a missed verification email and preserves the destination", async ({ page }) => {
  await page.route("**/api/v1/auth/bootstrap", route => route.fulfill({ json: {
    user: null, hasAccess: false, staffVerified: false,
    providers: { google: false, github: false }, localMail: false,
  } }));
  await page.route("**/api/v1/community", route => route.fulfill({ json: { weekly: null } }));
  await page.route("**/api/auth/sign-up/email", route => route.fulfill({ json: { token: null, user: { emailVerified: false } } }));
  const requests: { email: string; callbackURL: string }[] = [];
  await page.route("**/api/auth/send-verification-email", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { error: { message: "Email delivery is temporarily unavailable. Please retry." } } }
      : { json: { status: true } });
  });
  await page.goto("/?auth=signup&returnTo=" + encodeURIComponent("/?view=profile"));
  await page.getByLabel("Email", { exact: true }).fill("retry@example.test");
  await page.getByLabel("Password", { exact: true }).fill("A registration test password 1!");
  await page.locator("form").getByRole("button", { name: "Create account", exact: true }).click();
  const resend = page.getByRole("button", { name: "Resend verification email", exact: true });
  await resend.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email delivery is temporarily unavailable");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("retry@example.test");
  await resend.click();
  await expect(page.getByRole("status").filter({ hasText: "a new verification link has been sent" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request.email).toBe("retry@example.test");
    const callback = new URL(request.callbackURL);
    expect(callback.origin).toBe(new URL(page.url()).origin);
    expect(callback.searchParams.get("view")).toBe("profile");
    expect(callback.searchParams.get("verified")).toBe("1");
  }
});

for (const next of ["signin", "forgot"] as const) {
  test(`registration gives neutral guidance and a working ${next} action`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route("**/api/v1/auth/bootstrap", route => route.fulfill({ json: {
      user: null, hasAccess: false, staffVerified: false,
      providers: { google: false, github: false }, localMail: false,
    } }));
    await page.route("**/api/v1/community", route => route.fulfill({ json: { weekly: null } }));
    await page.route("**/api/auth/sign-up/email", route => route.fulfill({ json: {
      token: null, user: { id: "synthetic-user", email: "existing@example.test", emailVerified: false },
    } }));
    let resetEmail = "";
    await page.route("**/api/auth/request-password-reset", async route => {
      resetEmail = route.request().postDataJSON().email;
      await route.fulfill({ json: { status: true } });
    });

    await page.goto("/?auth=signup");
    await page.getByLabel("Email", { exact: true }).fill("existing@example.test");
    await page.getByLabel("Password", { exact: true }).fill("A long registration test password 1!");
    await page.locator("form").getByRole("button", { name: "Create account", exact: true }).click();
    const notice = page.getByRole("status");
    await expect(notice).toContainText("If this email is eligible for a new account, check your inbox for a verification link.");
    await expect(notice).toContainText("If you already have an account, sign in or reset your password. Your existing account is unchanged.");
    await expect(page.getByText("Account created.", { exact: false })).toHaveCount(0);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await notice.getByRole("button", { name: next === "signin" ? "Sign in to your account" : "Reset your password", exact: true }).click();
    await expect(page.getByRole("heading", { name: next === "signin" ? "Sign in to dfCTF" : "Reset your password", exact: true })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("existing@example.test");
    await expect(notice).toHaveCount(0);
    if (next === "forgot") {
      await page.getByRole("button", { name: "Send reset link", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("If this address has an account, a reset link is on its way.");
      expect(resetEmail).toBe("existing@example.test");
    }
  });
}
