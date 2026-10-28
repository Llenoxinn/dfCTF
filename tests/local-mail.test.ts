import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/auth/local-mail/route";
import { listLocalMail } from "@/server/mail";

vi.mock("@/server/mail", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/mail")>(),
  listLocalMail: vi.fn(),
}));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_MAIL", "1");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3200");
  vi.mocked(listLocalMail).mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const inbox = (headers: Record<string, string> = {}, url = "http://localhost:3200/api/v1/auth/local-mail") =>
  GET(new Request(url, { headers: { host: "127.0.0.1:3200", "sec-fetch-site": "same-origin", ...headers } }), {});

describe("loopback development mailbox", () => {
  it("uses configured browser Host and Origin when Next internally uses localhost", async () => {
    const response = await inbox({ origin: "http://127.0.0.1:3200" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [] });
    expect(listLocalMail).toHaveBeenCalledOnce();
  });

  it("defaults to the documented loopback origin when APP_URL is empty", async () => {
    vi.stubEnv("APP_URL", "");
    const response = await GET(new Request("http://localhost:3000/api/v1/auth/local-mail", {
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    }), {});
    expect(response.status).toBe(200);
  });

  it.each([
    ["a remote Host", { host: "attacker.example:3200" }, 404],
    ["an unconfigured loopback Host", { host: "localhost:3200" }, 404],
    ["cross-site fetches", { "sec-fetch-site": "cross-site" }, 404],
    ["a different loopback Origin", { origin: "http://localhost:3200" }, 403],
    ["a remote Origin", { origin: "https://attacker.example" }, 403],
  ] as const)("denies %s without reading messages", async (_name, headers, status) => {
    expect((await inbox(headers)).status).toBe(status);
    expect(listLocalMail).not.toHaveBeenCalled();
  });

  it("denies nonloopback request URLs even with matching configured headers", async () => {
    expect((await inbox({}, "http://attacker.example:3200/api/v1/auth/local-mail")).status).toBe(404);
    expect(listLocalMail).not.toHaveBeenCalled();
  });

  it("denies a nonloopback APP_URL even when the supplied Host matches it", async () => {
    vi.stubEnv("APP_URL", "http://attacker.example:3200");
    expect((await inbox({ host: "attacker.example:3200" })).status).toBe(404);
    expect(listLocalMail).not.toHaveBeenCalled();
  });

  it.each([["NODE_ENV", "production"], ["LOCAL_MAIL", "0"]])("stays unavailable with %s=%s", async (name, value) => {
    vi.stubEnv(name, value);
    expect((await inbox()).status).toBe(404);
    expect(listLocalMail).not.toHaveBeenCalled();
  });
});
