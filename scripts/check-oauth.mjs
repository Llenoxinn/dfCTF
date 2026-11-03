import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

try {
  if (!process.env.APP_URL) throw new Error("Set APP_URL to the exact application origin first.");
  const url = new URL(process.env.APP_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("APP_URL must be an HTTPS origin, or an HTTP loopback origin for local development, with no credentials, path, query, or fragment.");
  }
  console.log(`Application origin: ${url.origin}`);
  for (const [provider, prefix] of [["google", "GOOGLE"], ["github", "GITHUB"]]) {
    const id = Boolean(process.env[`${prefix}_CLIENT_ID`]);
    const secret = Boolean(process.env[`${prefix}_CLIENT_SECRET`]);
    console.log(`${provider}: ${id && secret ? "both credentials configured (validity not verified)" : !id && !secret ? "disabled; credentials not configured" : "incomplete; supply both client ID and secret"}`);
    console.log(`  Authorized callback: ${url.origin}/api/auth/callback/${provider}`);
    if (id !== secret) process.exitCode = 1;
  }
  console.log("Register each callback on the matching provider client. This check does not contact providers, display credentials, or validate saved dashboard settings.");
} catch (error) {
  console.error(error instanceof Error && error.name !== "TypeError" ? error.message : "APP_URL is not a valid application origin.");
  process.exitCode = 1;
}
