import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.platform === "win32" ? "msedge" : undefined,
    // The landing hero's WebGL field can crash headless Chrome's GPU process on CI, which then breaks the next
    // test's screenshot. Tests check behavior, not the decoration, so they run the canvas-2D fallback instead.
    launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] },
  },
  webServer: {
    command: "npm start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
