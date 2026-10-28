import { test, expect, type Page } from "@playwright/test";
import { RESOURCE_GUIDES } from "../../src/lib/resources";
import { LEARNING_PATHS, parseLearningProgress } from "../../src/lib/resource-learning";
import { applyLearningPatch } from "../../src/lib/learning-progress";

async function mockHome(page: Page, signedIn = false, featured = false) {
  let learning = parseLearningProgress(null);
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = {
      user: signedIn ? { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true } : null,
      hasAccess: signedIn, staffVerified: signedIn, providers: { google: false, github: false }, localMail: false,
    };
    else if (url.pathname === "/api/v1/community") response = {
      weekly: featured ? {
        id: "featured-training", title: "Fictional weekly training", summary: "A fictional exercise for the weekly feature.", category: "General skills", difficulty: "Easy",
        xp: 50, solveCount: 0, solvers: [], endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      } : null,
      recent: [], top: [], topAll: [], activity: { start: new Date().toISOString(), days: [] }, totals: { challenges: 0, categories: [] },
    };
    else if (url.pathname === "/api/v1/challenges" || url.pathname === "/api/v1/staff/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/learning/progress") {
      if (route.request().method() === "PATCH") learning = applyLearningPatch(learning, route.request().postDataJSON());
      response = { userId: "test-author", progress: learning };
    }
    else if (url.pathname === "/api/v1/leaderboard") response = {
      range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null,
      race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] },
    };
    else throw new Error(`Unexpected test request: ${route.request().method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
}


test("the public library introduces learning before topics and makes paths discoverable without API requests", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("/resources");
  await expect(page).toHaveTitle(/Tutorials & Resources/);
  await expect(page.getByRole("heading", { level: 1, name: "Tutorials & Resources", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with the big picture", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Find your next topic" }).getByRole("article")).toHaveCount(RESOURCE_GUIDES.length);
  await expect(page.getByRole("region", { name: "Learning paths", exact: true }).getByRole("article")).toHaveCount(6);
  for (const path of LEARNING_PATHS) {
    const lane = page.getByRole("article", { name: path.title, exact: true });
    await expect(lane.getByRole("list", { name: `${path.title} topic sequence`, exact: true }).getByRole("link")).toHaveCount(path.topics.length);
    const first = lane.locator(".learning-map-node").first();
    await expect(first).toHaveAttribute("href", `/resources/${path.topics[0]}?path=${path.id}`);
    await expect(lane.getByRole("link", { name: `Start path: ${path.title}`, exact: true })).toHaveAttribute("href", `/resources/${path.topics[0]}?path=${path.id}`);
  }
  await expect(page.getByRole("heading", { name: "Practice with permission" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Rules / Mechanics", exact: true })).toHaveAttribute("href", "/rules");
  await expect(page.locator("pre, .resource-exercise")).toHaveCount(0);
  for (const guide of RESOURCE_GUIDES) await expect(page.getByRole("region", { name: "Find your next topic" }).getByRole("link", { name: guide.title, exact: true })).toHaveAttribute("href", `/resources/${guide.id}`);
  const card = page.locator(".resource-topic-card").first();
  await expect(card.locator(".resource-link-arrow")).toHaveCount(1);
  await expect(card.locator(".resource-link-arrow").first()).toBeVisible();
  const bookmark = card.getByRole("button", { name: "Bookmark General skills", exact: true });
  await expect(bookmark).toHaveText("");
  await expect(bookmark.locator("svg")).toBeVisible();
  await expect(bookmark).toHaveCSS("position", "absolute");
  expect(apiRequests).toEqual([]);
});

test("every topic starts with an introduction and basics before tools, depth, and optional practice", async ({ page }) => {
  for (const guide of RESOURCE_GUIDES) {
    await page.goto(`/resources/${guide.id}`);
    await expect(page).toHaveTitle(new RegExp(guide.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.getByRole("heading", { level: 1, name: guide.title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmark topic", exact: true })).toBeEnabled();
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2 })).toHaveText(["What you’ll learn", "Start with the basics", "Your first steps", "Tools to explore next", "Go deeper", "Key takeaways", "Optional practice"]);
    await expect(page.getByRole("navigation", { name: "Topic sections" }).getByRole("link")).toHaveCount(7);
    await expect(page.locator(".resource-area-notes dt")).toHaveCount(guide.concepts.length);
    await expect(page.locator("details.resource-tool[open], details.resource-exercise[open], details.resource-deep-dive[open]")).toHaveCount(0);
    await expect(page.locator("pre:visible")).toHaveCount(0);
    const first = page.locator(`#${guide.tools[0].id}`);
    await first.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.locator(".resource-tool-copy > p")).toBeVisible();
    const exercise = first.locator("details.resource-exercise");
    await expect(exercise).not.toHaveAttribute("open", "");
    await exercise.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(exercise.locator("ol")).toBeVisible();
    if (guide.tools[0].example) await expect(exercise.getByRole("code")).toContainText(guide.tools[0].example!.code);
    await page.keyboard.press("Enter");
    await expect(exercise).not.toHaveAttribute("open", "");
    await first.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(first).not.toHaveAttribute("open", "");
  }
});

test("search combines topic and tool words with level and platform and recovers from no matches", async ({ page }) => {
  await page.goto("/resources");
  const browse = page.getByRole("region", { name: "Find your next topic" });
  const search = page.getByRole("searchbox", { name: "Search topics or tools" });
  await search.fill("PowerShell");
  await expect(browse.getByRole("link", { name: "General skills", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Platform", exact: true }).selectOption("Windows");
  await expect(browse.locator(".resource-matches").first()).toBeVisible();
  for (const text of await browse.locator(".resource-matches li > span").allTextContents()) expect(text.toLowerCase()).toContain("windows");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Starting level", exact: true }).selectOption("Beginner");
  await expect(browse.getByRole("link", { name: "Binary exploitation", exact: true })).toHaveCount(0);
  await expect(browse.getByRole("link", { name: "General skills", exact: true })).toBeVisible();
  await search.fill("nothing-matches-this-learning-query");
  await expect(page.getByRole("heading", { name: "No topics match yet" })).toBeVisible();
  await page.getByRole("button", { name: "Show all topics", exact: true }).click();
  await expect(browse.getByRole("article")).toHaveCount(RESOURCE_GUIDES.length);
  await search.fill("audio");
  await search.press("Escape");
  await expect(search).toHaveValue("");
});

test("topic and tool bookmarks, completed topics, and nested disclosures survive reloads", async ({ page }) => {
  await page.goto("/resources/general-skills");
  await page.getByRole("button", { name: "Bookmark topic", exact: true }).click();
  await page.getByRole("button", { name: "Mark topic read", exact: true }).click();
  const deeper = page.locator("#general-skills-deeper");
  await deeper.locator(":scope > summary").click();
  const cyberchef = page.locator("#cyberchef");
  await cyberchef.locator(":scope > summary").click();
  await cyberchef.getByRole("button", { name: "Bookmark CyberChef", exact: true }).click();
  await cyberchef.locator(".resource-exercise > summary").click();
  await expect(cyberchef.locator("pre")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Topic bookmarked", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Marked read", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(cyberchef.locator("pre")).toBeVisible();
  await page.getByRole("navigation", { name: "Learning breadcrumbs" }).getByRole("link", { name: "All resources", exact: true }).click();
  const saved = page.getByRole("region", { name: "Your learning" });
  await expect(saved.getByRole("link", { name: "General skills", exact: true })).toHaveAttribute("href", "/resources/general-skills");
  await expect(saved.getByRole("link", { name: "CyberChef in General skills", exact: true })).toHaveAttribute("href", "/resources/general-skills#cyberchef");
  await expect(saved).toContainText("1 of 15 topics marked read");
  const foundation = page.getByRole("article", { name: "Beginner foundations", exact: true });
  await expect(foundation.locator(".learning-map-node").first()).toContainText("Read");
  await expect(foundation.locator(".learning-map-node").nth(1)).toContainText("Up next");
  await saved.getByRole("link", { name: "CyberChef in General skills", exact: true }).click();
  await expect(cyberchef.locator(".resource-tool-copy")).toBeVisible();
  await expect(cyberchef.locator(":scope > summary")).toBeInViewport();
  await page.getByRole("button", { name: "Marked read", exact: true }).click();
  await page.getByRole("navigation", { name: "Learning breadcrumbs" }).getByRole("link", { name: "All resources", exact: true }).click();
  await saved.getByRole("button", { name: "Remove bookmark: CyberChef in General skills", exact: true }).click();
  await page.reload();
  await expect(saved.getByRole("link", { name: "CyberChef in General skills", exact: true })).toHaveCount(0);
  await expect(saved).toContainText("0 of 15 topics marked read");
});

test("resource link hovers and bookmark pops preserve saved state between tabs and respect reduced motion", async ({ page, context }) => {
  await page.goto("/resources");
  const link = page.locator(".resource-topic-card h4 a").first();
  const arrow = link.locator(".resource-link-arrow");
  const arrowWidth = await arrow.evaluate(element => element.getBoundingClientRect().width);
  await link.hover();
  await expect(link).toHaveCSS("color", "rgb(255, 210, 63)");
  await expect.poll(() => arrow.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(arrowWidth * 1.1);
  const second = await context.newPage();
  await second.goto("/resources");
  await expect(second.getByRole("button", { name: "Bookmark General skills", exact: true })).toBeEnabled();
  const bookmark = page.getByRole("button", { name: "Bookmark General skills", exact: true });
  const icon = bookmark.locator("svg");
  await bookmark.click();
  expect(await icon.evaluate(element => element.getAnimations().length)).toBe(1);
  await icon.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await expect(icon).toHaveCSS("transform", "none");
  await expect(icon).toHaveCSS("fill", "rgb(255, 210, 63)");
  await expect(bookmark).toHaveCSS("color", "rgb(255, 210, 63)");
  await expect(second.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await second.getByRole("button", { name: "Bookmark General skills", exact: true }).locator("svg").evaluate(element => element.getAnimations().length)).toBe(0);
  await second.getByRole("button", { name: "Bookmark OSINT", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmark OSINT", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bookmark.click();
  expect(await icon.evaluate(element => element.getAnimations().filter(animation => (animation.effect as KeyframeEffect).getKeyframes().some(frame => Object.hasOwn(frame, "transform"))).length)).toBe(0);
  await expect(second.getByRole("button", { name: "Bookmark General skills", exact: true })).toHaveAttribute("aria-pressed", "false");
  await link.hover();
  await expect(arrow).toHaveCSS("transform", "none");
  await second.close();
});

test("continue reading restores the last section and a learning path keeps its previous and next order", async ({ page }) => {
  await page.goto("/resources");
  await page.getByRole("link", { name: "Start with the foundations", exact: true }).click();
  await expect(page).toHaveURL(/\/resources\/general-skills\?path=foundations$/);
  await page.getByRole("navigation", { name: "Topic sections" }).getByRole("link", { name: "Tools to explore", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("dfctf:learning:v1")!).last?.section)).toBe("general-skills-tools");
  await page.getByRole("banner").getByRole("link", { name: "Resources", exact: true }).click();
  const resume = page.getByRole("link", { name: "Continue reading: General skills", exact: true });
  await expect(resume).toHaveAttribute("href", "/resources/general-skills?path=foundations#general-skills-tools");
  await resume.click();
  await expect(page.locator("#general-skills-tools")).toBeInViewport();
  await page.getByRole("navigation", { name: "Beginner foundations topic navigation", exact: true }).getByRole("link", { name: "Next topic Scripting & automation", exact: true }).click();
  await expect(page).toHaveURL(/\/resources\/scripting-automation\?path=foundations$/);
  await expect(page.getByRole("navigation", { name: "Beginner foundations topic navigation", exact: true }).getByRole("link", { name: "Previous topic General skills", exact: true })).toHaveAttribute("href", "/resources/general-skills?path=foundations");
});

test("tool recommendations and direct bookmarks reveal the requested deeper guide without exposing exercises", async ({ page }) => {
  await page.goto("/resources/general-skills#cyberchef");
  const tool = page.locator("#cyberchef");
  await expect(tool.locator(":scope > summary")).toBeInViewport();
  await expect(tool).toHaveAttribute("open", "");
  await expect(page.locator("#general-skills-deeper")).toHaveAttribute("open", "");
  await expect(tool.locator(".resource-exercise")).not.toHaveAttribute("open", "");
  await expect(tool.locator("pre")).not.toBeVisible();
  await page.goto("/resources/forensics");
  const link = page.getByRole("list", { name: "Forensics tool recommendations", exact: true }).getByRole("link").first();
  const hash = await link.getAttribute("href");
  await link.click();
  await expect(page.locator(hash!)).toHaveAttribute("open", "");
  await expect(page.locator(hash!).locator(":scope > summary")).toBeInViewport();
});

test("inline terms explain themselves by keyboard and leave literal commands untouched", async ({ page }) => {
  await page.goto("/resources/general-skills");
  await page.locator("#powershell > summary").click();
  const term = page.locator("#powershell .resource-tool-copy > p").getByRole("button", { name: "Explain SHA-256", exact: true });
  await term.focus();
  await page.keyboard.press("Enter");
  await expect(term).toHaveAttribute("aria-expanded", "true");
  const definitionId = await term.getAttribute("aria-controls");
  await expect(page.locator(`[id="${definitionId}"]`)).toContainText("64 hexadecimal characters");
  await page.keyboard.press("Escape");
  await expect(term).toHaveAttribute("aria-expanded", "false");
  await page.locator("#powershell .resource-exercise > summary").click();
  await expect(page.locator("#powershell pre button")).toHaveCount(0);
  await expect(page.locator("#powershell code")).toContainText("Get-FileHash -LiteralPath .\\notes.txt -Algorithm SHA256");
});

test("blocked and corrupt browser storage never prevent reading or using controls", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", { value() { throw new DOMException("Blocked", "SecurityError"); } });
    Object.defineProperty(Storage.prototype, "setItem", { value() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.goto("/resources/osint");
  await expect(page.getByRole("status")).toContainText("storage is unavailable");
  await page.getByRole("button", { name: "Bookmark topic", exact: true }).click();
  await expect(page.getByRole("button", { name: "Topic bookmarked", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".resource-tool > summary").first().click();
  await expect(page.locator(".resource-tool-copy").first()).toBeVisible();
});

test("corrupt saved progress resets safely and legacy links reach the equivalent topic", async ({ page }) => {
  await page.goto("/resources");
  await page.evaluate(() => localStorage.setItem("dfctf:learning:v1", "{broken"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Bookmark General skills", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Your learning" })).toHaveCount(0);
  await page.goto("/resources#audio-recovery");
  await expect(page).toHaveURL(/\/resources\/audio-recovery$/);
  await expect(page.getByRole("heading", { level: 1, name: "Audio & media recovery", exact: true })).toBeVisible();
  await page.goto("/resources#cyberchef");
  await expect(page).toHaveURL(/\/resources\/general-skills#cyberchef$/);
  await expect(page.locator("#cyberchef")).toHaveAttribute("open", "");
  const response = await page.goto("/resources/not-a-real-topic");
  expect(response?.status()).toBe(404);
});

test("optional practice opens the actual board with the recommended category and difficulty", async ({ page }) => {
  await mockHome(page, true);
  await page.route("**/api/v1/challenges", route => route.fulfill({ json: [
    { id: "osint-easy", title: "Easy OSINT exercise", category: "OSINT", difficulty: "Easy", xp: 50 },
    { id: "osint-hard", title: "Hard OSINT exercise", category: "OSINT", difficulty: "Hard", xp: 300 },
    { id: "forensics-easy", title: "Easy forensics exercise", category: "Forensics", difficulty: "Easy", xp: 50 },
  ].map(challenge => ({ ...challenge, slug: challenge.id, summary: "A fictional fixture", tags: [], estimatedMinutes: 10, solved: false, attempted: false, solveCount: 0, status: "published" })) }));
  await page.goto("/resources/osint");
  await page.getByRole("link", { name: "Browse easy OSINT challenges", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Category", exact: true }).getByRole("button", { name: /^OSINT/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Difficulty", exact: true }).getByRole("button", { name: "Easy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Easy OSINT exercise", { exact: true })).toBeVisible();
  await expect(page.getByText("Hard OSINT exercise", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Easy forensics exercise", { exact: true })).toHaveCount(0);
});

test("library and expanded topic pages fit mobile and desktop and retain the sticky navigation", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/resources");
    await expect(page.getByRole("button", { name: "Bookmark General skills", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) {
      await page.screenshot({ path: `test-results/resource-library-${width}.png` });
      await page.locator(".resource-topic-card").first().screenshot({ path: `test-results/resource-card-${width}.png` });
    }
    await page.getByRole("link", { name: "Explore learning paths", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Learning paths", exact: true })).toBeInViewport();
    const map = page.locator(".learning-map");
    expect(await map.locator(".learning-map-node").evaluateAll(nodes => nodes.every(node => {
      const bounds = node.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }))).toBe(true);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => document.querySelector("#learning-paths")!.scrollIntoView({ behavior: "instant" }));
      await page.screenshot({ path: `test-results/learning-map-${width}.png` });
    }
    if (width === 390) {
      await page.evaluate(() => document.documentElement.dataset.theme = "light");
      await page.screenshot({ path: "test-results/learning-map-light-390.png" });
      await page.evaluate(() => document.documentElement.dataset.theme = "dark");
    }
    await page.goto("/resources/audio-recovery");
    await expect(page.getByRole("button", { name: "Bookmark topic", exact: true })).toBeEnabled();
    await page.locator("details").evaluateAll(items => items.forEach(item => item.setAttribute("open", "")));
    await expect(page.locator(".resource-deep-content .resource-tool-copy").first()).toBeVisible();
    await expect(page.locator("#audio-channel-isolation pre")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("pre").evaluateAll(items => items.some(item => item.getBoundingClientRect().right > innerWidth))).toBe(false);
    await page.getByRole("navigation", { name: "Topic sections" }).getByRole("link", { name: "The basics", exact: true }).click();
    await expect(page.locator("#audio-recovery-basics")).toBeInViewport();
    await expect.poll(async () => page.locator("#audio-recovery-basics").evaluate(item => item.getBoundingClientRect().top)).toBeLessThan(200);
    await expect(page.getByRole("navigation", { name: "Topic sections" }).getByRole("link", { name: "The basics", exact: true })).toHaveAttribute("aria-current", "location");
    const headerBottom = await page.getByRole("banner").evaluate(item => item.getBoundingClientRect().bottom);
    await expect.poll(async () => page.locator("#audio-recovery-basics").evaluate(item => item.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom);
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/resource-topic-${width}.png` });
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    expect(await page.getByRole("banner").evaluate(item => item.getBoundingClientRect().top)).toBe(0);
  }
});

test("public pages keep the full navigation and link back to home sections", async ({ page }) => {
  await mockHome(page);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/resources", "/resources/osint", "/rules"]) {
      await page.goto(path);
      const sections = page.getByRole("banner").getByRole("navigation", { name: "Sections", exact: true });
      await expect(sections.getByRole("link")).toHaveText(["Leaderboard", "This week", "Categories", "Resources", "Rules", "FAQ"]);
      const resources = sections.getByRole("link", { name: "Resources", exact: true });
      await resources.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 1, name: "Tutorials & Resources", exact: true })).toBeVisible();
    }
    await page.getByRole("banner").getByRole("link", { name: "FAQ", exact: true }).click();
    await expect(page).toHaveURL(/\/\?view=home#faq$/);
    await expect(page.locator("#faq")).toBeInViewport();
  }
});

test("landing navigation, footer, and tools FAQ link to the library", async ({ page }) => {
  await mockHome(page);
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Resources", exact: true })).toHaveAttribute("href", "/resources");
  await expect(page.getByRole("contentinfo").getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "Resources", exact: true })).toHaveAttribute("href", "/resources");
  await page.getByRole("button", { name: /What tools do I need\?/ }).click();
  const answer = page.getByRole("region", { name: "What tools do I need?", exact: true });
  const resources = answer.getByRole("link", { name: "Tutorials & Resources", exact: true });
  await expect(resources).toHaveCSS("color", "rgb(236, 232, 223)");
  await expect(resources).toHaveCSS("text-decoration-line", "none");
  await expect(resources.locator(".resource-link-arrow")).toBeVisible();
  await resources.hover();
  await expect(resources).toHaveCSS("color", "rgb(255, 210, 63)");
  await resources.click();
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
});

test("signed-in Resources navigation stays in the app and preserves the discard warning for unsaved drafts", async ({ page }) => {
  await mockHome(page, true);
  await page.goto("/?view=authoring");
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  const title = page.getByPlaceholder("Night shift");
  await title.fill("Keep this unsaved resource-navigation draft");
  const resources = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Resources", exact: true });
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.type()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await resources.click();
  await expect(title).toHaveValue("Keep this unsaved resource-navigation draft");
  await expect(page).toHaveURL(/view=authoring/);
  expect(prompts).toEqual(["confirm"]);
  accept = true;
  await resources.click();
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
  expect(prompts).toEqual(["confirm", "confirm"]);
  await expect(page).toHaveURL(/view=resources/);
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
});

test("account sync retries offline changes and imports guest progress only when requested", async ({ page }) => {
  await mockHome(page, true);
  let failed = true, expired = false, remote = parseLearningProgress(null);
  await page.route("**/api/v1/learning/progress", async route => {
    expect(route.request().headers()["x-dfctf-account"]).toBe("test-author");
    if (expired) return route.fulfill({ status: 401, json: { error: { message: "Sign in to continue." } } });
    if (failed) return route.fulfill({ status: 503, json: { error: { message: "Account sync is unavailable." } } });
    if (route.request().method() === "PATCH") remote = applyLearningPatch(remote, route.request().postDataJSON());
    await route.fulfill({ json: { userId: "test-author", progress: remote } });
  });
  await page.goto("/resources");
  await page.evaluate(() => localStorage.setItem("dfctf:learning:v1", JSON.stringify({ version: 1, bookmarks: ["osint"], completed: [], open: {}, last: null })));
  await page.goto("/?view=resources");
  const general = page.getByRole("button", { name: "Bookmark General skills", exact: true });
  await expect(page.getByRole("status")).toContainText("Account sync is unavailable");
  await expect(page.getByRole("button", { name: "Bookmark OSINT", exact: true })).toHaveAttribute("aria-pressed", "false");
  await general.click();
  await page.reload();
  await expect(general).toHaveAttribute("aria-pressed", "true");
  failed = false;
  await page.getByRole("button", { name: "Retry account sync", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved to your account");
  expect(remote.bookmarks).toEqual(["general-skills"]);
  await page.getByRole("button", { name: "Add this browser’s progress to my account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved to your account");
  expect(remote.bookmarks).toEqual(["general-skills", "osint"]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Bookmark OSINT", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Add this browser’s progress to my account", exact: true })).toHaveCount(0);
  expired = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("status")).toContainText("Sign in to continue");
  await expect(page.getByRole("button", { name: "Bookmark General skills", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Your learning" })).toHaveCount(0);
});
