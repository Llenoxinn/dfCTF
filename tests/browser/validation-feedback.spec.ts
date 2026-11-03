import { test, expect, type Page } from "@playwright/test";

async function anonymous(page: Page) {
  await page.route("**/api/v1/auth/bootstrap", route => route.fulfill({ json: {
    user: null, hasAccess: false, staffVerified: false, providers: { google: false, github: false }, localMail: false,
  } }));
  await page.route("**/api/v1/community", route => route.fulfill({ json: { weekly: null } }));
}

for (const theme of ["dark", "light"] as const) {
  test(`themed validation blocks invalid submissions and clears after correction in ${theme} mode`, async ({ page, context }) => {
    await context.addCookies([{ name: "dfctf-theme", value: theme, url: "http://127.0.0.1:3100" }]);
    await page.setViewportSize({ width: theme === "dark" ? 1440 : 375, height: 900 });
    await anonymous(page);
    let submissions = 0;
    await page.route("**/api/auth/sign-up/email", async route => {
      submissions++;
      await route.fulfill({ json: { token: null, user: { id: "synthetic", email: "player@example.test", emailVerified: false } } });
    });
    await page.goto("/?auth=signup");
    const form = page.locator("form"), email = page.getByLabel("Email", { exact: true }), password = page.getByLabel("Password", { exact: true });
    const submit = form.getByRole("button", { name: "Create account", exact: true });
    const card = form.locator(".validation-popover");
    await expect(form).toHaveAttribute("novalidate", "");
    await submit.click();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Email");
    await expect(card).toContainText("This field is required.");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(/This field is required/);
    expect(submissions).toBe(0);
    await page.locator(".auth-form").screenshot({ path: test.info().outputPath(`validation-${theme}.png`) });
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(email).toBeFocused();
    await expect(email).not.toHaveAttribute("aria-invalid", "true");

    await email.fill("not-an-email");
    await email.press("Enter");
    await expect(card).toContainText("Enter a valid email address.");
    expect(submissions).toBe(0);
    await email.fill("player@example.test");
    await expect(card).toBeHidden();
    await submit.click();
    await expect(card).toContainText("Password");
    await expect(password).toBeFocused();
    await expect(password).toHaveAccessibleDescription(/Use 8–128 characters.*This field is required/);
    await password.fill("short");
    await submit.click();
    await expect(card).toContainText("Use at least 8 characters.");
    expect(submissions).toBe(0);
    for (const invalid of ["lower1!a", "UPPER1!A", "Abcdefg!", "Abcdefg1", "Abcdef1 "]) {
      await password.fill(invalid);
      await submit.click();
      await expect(card).toContainText("at least one uppercase letter, one lowercase letter, one number, and one symbol");
      expect(submissions).toBe(0);
    }
    await password.fill("Abcdef1!");
    await expect(card).toBeHidden();
    await expect(password).toHaveAttribute("aria-describedby", "password-help");
    await submit.click();
    await expect(page.getByRole("status")).toContainText("If this email is eligible for a new account");
    expect(submissions).toBe(1);
  });
}

test("validation follows auth mode changes and explains an invalid authenticator code", async ({ page }) => {
  await anonymous(page);
  await page.route("**/api/auth/sign-in/email", route => route.fulfill({ json: { twoFactorRedirect: true } }));
  let attempts = 0;
  await page.route("**/api/v1/auth/mfa/verify", async route => {
    attempts++; await route.fulfill({ status: 401, json: { error: { message: "Invalid authenticator code." } } });
  });
  await page.goto("/?auth=signup");
  await page.locator("form").getByRole("button", { name: "Create account", exact: true }).click();
  const card = page.locator(".validation-popover");
  await expect(card).toBeVisible();
  await page.getByRole("group", { name: "Choose an option" }).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(card).toBeHidden();
  await page.getByLabel("Email", { exact: true }).fill("player@example.test");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("minlength", "1");
  await expect(password).not.toHaveAttribute("pattern");
  await password.fill("a correct sign-in password");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  const code = page.getByLabel("Authenticator code", { exact: true });
  await code.fill("123");
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(card).toContainText("Enter the 6-digit code from your authenticator app.");
  await expect(code).toBeFocused();
  expect(attempts).toBe(0);
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid authenticator code.");
  expect(attempts).toBe(1);
});
