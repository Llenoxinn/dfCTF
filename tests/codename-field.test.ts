import { describe, expect, it } from "vitest";
import { codenameField, ditherPath } from "@/lib/pixel";

const draw = (name: string) => ditherPath(240, 60, 6, codenameField(name, 240, 60));
const coverage = (name: string) => {
  const density = codenameField(name, 240, 60);
  let on = 0, cells = 0;
  for (let y = 3; y < 60; y += 6) for (let x = 3; x < 240; x += 6) { cells++; if (density(x, y) > 0.5) on++; }
  return on / cells;
};

describe("codename field", () => {
  it("draws the same pattern for the same codename", () => {
    expect(draw("fixture_player")).toBe(draw("fixture_player"));
  });
  it("draws a different pattern for each codename", () => {
    const names = ["a", "b", "ab", "fixture_player", "fixture_playes", "学ぶ人"];
    expect(new Set(names.map(draw)).size).toBe(names.length);
  });
  it("stays in range and never draws a blank or solid field", () => {
    for (const name of ["a", "fixture_player", "x".repeat(24), "学ぶ人"]) {
      const density = codenameField(name, 240, 60);
      for (let y = 0; y < 60; y += 5) for (let x = 0; x < 240; x += 5) {
        expect(density(x, y)).toBeGreaterThanOrEqual(0);
        expect(density(x, y)).toBeLessThanOrEqual(1);
      }
      expect(draw(name).length).toBeGreaterThan(0);
      expect(coverage(name)).toBeLessThan(0.9);
    }
  });
});
