import { HttpError, json, route } from "@/server/http";
import { listLocalMail, localMailEnabled } from "@/server/mail";

export const runtime = "nodejs";
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const expected = new URL(process.env.APP_URL || "http://127.0.0.1:3000");
  const loopback = (hostname: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!localMailEnabled() || !loopback(url.hostname) || !loopback(expected.hostname) || !["http:", "https:"].includes(expected.protocol) || (host && host !== expected.host) || site === "cross-site") {
    throw new HttpError(404, "NOT_FOUND", "This page could not be found.");
  }
  if (origin && origin !== expected.origin) throw new HttpError(403, "INVALID_ORIGIN", "Open the local inbox from this application.");
  return json({ messages: await listLocalMail() });
});
