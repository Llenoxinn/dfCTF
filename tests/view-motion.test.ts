import { describe, expect, it } from "vitest";
import { viewKeyframes, viewMotion } from "../src/lib/view-motion";

const ORDER = ["home", "practice", "leaderboard", "competitions"];
const app = (view: string) => ({ surface: "app" as const, view });

describe("view motion", () => {
  it("slides between app views in navigation order, so Back reverses Forward", () => {
    expect(viewMotion(app("practice"), app("leaderboard"), ORDER)).toBe("forward");
    expect(viewMotion(app("leaderboard"), app("practice"), ORDER)).toBe("back");
  });
  it("fades between the landing page, sign-in and the application", () => {
    expect(viewMotion({ surface: "landing", view: "home" }, app("practice"), ORDER)).toBe("fade");
    expect(viewMotion(app("practice"), { surface: "landing", view: "home" }, ORDER)).toBe("fade");
    expect(viewMotion({ surface: "landing", view: "practice" }, { surface: "auth", view: "practice" }, ORDER)).toBe("fade");
  });
  it("stays still on first paint and when the view is unchanged", () => {
    expect(viewMotion({ surface: "boot", view: "practice" }, app("leaderboard"), ORDER)).toBe("none");
    expect(viewMotion({ surface: "boot", view: "practice" }, { surface: "landing", view: "practice" }, ORDER)).toBe("none");
    expect(viewMotion(app("practice"), app("practice"), ORDER)).toBe("none");
    expect(viewMotion({ surface: "auth", view: "practice" }, { surface: "auth", view: "leaderboard" }, ORDER)).toBe("none");
  });
  it("enters from the side travelled towards, and drops movement for reduced motion", () => {
    expect(viewKeyframes("forward", false)[0].transform).toBe("translateX(20px)");
    expect(viewKeyframes("back", false)[0].transform).toBe("translateX(-20px)");
    expect(viewKeyframes("fade", false)[0]).toEqual({ opacity: 0 });
    expect(viewKeyframes("forward", true)[0]).toEqual({ opacity: 0 });
  });
});
