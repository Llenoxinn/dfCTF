import { describe, expect, it } from "vitest";
import { authDestination, destinationLabel, safeReturnTo, verificationCallback } from "../src/lib/auth-navigation";

describe("sign-in destinations", () => {
  it("preserves a lesson's category and difficulty across the sign-in URL", () => {
    const path = "/?view=practice&category=General+skills&difficulty=Easy";
    const search = `?auth=signin&returnTo=${encodeURIComponent(path)}`;
    expect(authDestination(search)).toBe(path);
    expect(destinationLabel(path)).toBe("General skills challenges");
    expect(authDestination("?view=leaderboard")).toBe("/?view=leaderboard");
  });
  it("rejects external redirects and discards tokens and unknown filters", () => {
    for (const path of ["https://other.test/?view=practice", "//other.test/?view=practice", "/\\other.test/?view=practice", "/?view=unknown", "/api/auth/sign-out", null]) expect(safeReturnTo(path)).toBeNull();
    expect(safeReturnTo("/?view=practice&token=private&auth=signup&category=bad&difficulty=bad")).toBe("/?view=practice");
    expect(authDestination("?returnTo=https://other.test/&auth=signin")).toBeNull();
  });
  it("retains selected challenge and event identities", () => {
    expect(authDestination("?view=competitions&competition=event&challenge=round")).toBe("/?view=competitions&challenge=round&competition=event");
    expect(destinationLabel("/?view=practice&challenge=selected")).toBe("the selected challenge");
  });
  it("preserves signed-in player destinations without accepting arbitrary profile identifiers",()=>{
    expect(authDestination("?view=socials&player=packet_fox")).toBe("/?view=socials&player=packet_fox");
    expect(destinationLabel("/?view=socials&player=packet_fox")).toBe("packet_fox's player profile");
    expect(safeReturnTo("/?view=socials&player=https://other.test&token=secret")).toBe("/?view=socials");
  });
  it("marks verification callbacks without losing the destination",()=>{
    expect(verificationCallback("https://dfctf.test",null)).toBe("https://dfctf.test/?verified=1");
    const path="/?view=practice&category=General+skills&difficulty=Easy";
    const callback=verificationCallback("https://dfctf.test",path);
    expect(callback).toBe(`https://dfctf.test${path}&verified=1`);
    expect(authDestination(new URL(callback).search)).toBe(path);
    expect(authDestination("?verified=1")).toBeNull();
  });
});
