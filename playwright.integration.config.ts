import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const temporaryRoot = path.dirname(process.cwd());
const directory = process.env.DFCTF_INTEGRATION_DIR ?? mkdtempSync(path.join(temporaryRoot, "dfctf-integration-"));
process.env.DFCTF_INTEGRATION_DIR = directory;
const ownershipToken = process.env.DFCTF_INTEGRATION_TOKEN ?? randomBytes(32).toString("hex");
process.env.DFCTF_INTEGRATION_TOKEN = ownershipToken;

export default defineConfig({
  testDir: "./tests/integration",
  outputDir: "./test-results/integration",
  reporter: [["list"], ["./scripts/integration-reporter.ts"]],
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:3200",
    actionTimeout: 20_000,
    channel: process.platform === "win32" ? "msedge" : undefined,
    launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] },
    extraHTTPHeaders: { Origin: "http://127.0.0.1:3200", "X-dfCTF-Request": "1" },
  },
  webServer: {
    command: "npx tsx scripts/integration-server.ts",
    url: "http://127.0.0.1:3200/api/v1/community",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DFCTF_INTEGRATION_DIR: directory,
      DFCTF_INTEGRATION_TOKEN: ownershipToken,
      DFCTF_INTEGRATION_ROOT: temporaryRoot,
      NODE_ENV: "development",
      APP_URL: "http://127.0.0.1:3200",
      DATABASE_URL: "", DATABASE_MIGRATION_URL: "", TEST_DATABASE_URL: "",
      AUTH_SECRET: randomBytes(32).toString("hex"), FLAG_SECRET: randomBytes(32).toString("hex"),
      LOCAL_MAIL: "1", SMTP_URL: "", MAIL_FROM: "dfCTF <noreply@example.test>",
      GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "",
      FACEBOOK_CLIENT_ID: "", FACEBOOK_CLIENT_SECRET: "", NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
