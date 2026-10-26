import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.platform === "win32" ? "msedge" : undefined,
  },
  webServer: {
    command: "npm start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
