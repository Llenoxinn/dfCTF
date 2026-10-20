import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";
import { buildScene, frameDensity, threshold } from "@/lib/scene";

describe("theme cookie parsing", () => {
  it("accepts only the two known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("Dark")).toBeNull();
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme("dark; Path=/")).toBeNull();
  });
});

describe("dither threshold", () => {
  it("covers 64 distinct levels strictly between 0 and 1", () => {
    const levels = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const t = threshold(x, y);
      expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1);
      levels.add(t);
    }
    expect(levels.size).toBe(64);
    expect(threshold(9, 10)).toBe(threshold(1, 2));
  });
});

describe("campus scene", () => {
  const scene = buildScene(192, 80);

  it("is deterministic and sized to the canvas", () => {
    const again = buildScene(192, 80);
    expect(scene.day.length).toBe(192 * 80);
    expect(Array.from(scene.night)).toEqual(Array.from(again.night));
    expect(Array.from(scene.lightDelay)).toEqual(Array.from(again.lightDelay));
  });

  it("keeps every density within 0 and 1", () => {
    for (const field of [scene.day, scene.night]) for (const value of field) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
  });

  it("shows the day field at t=0 and the night field at t=1 outside lit windows", () => {
    for (let i = 0; i < scene.day.length; i += 37) {
      expect(frameDensity(scene, i, 0)).toBeCloseTo(scene.day[i]);
      if (scene.lightDelay[i] < 0) expect(frameDensity(scene, i, 1)).toBeCloseTo(scene.night[i]);
    }
  });

  it("lights some windows at night and keeps them unlit by day", () => {
    const lit = Array.from(scene.lightDelay).map((delay, i) => delay >= 0 ? i : -1).filter(i => i >= 0);
    expect(lit.length).toBeGreaterThan(20);
    for (const i of lit) {
      expect(frameDensity(scene, i, 1)).toBeGreaterThan(0.9);
      expect(frameDensity(scene, i, 0)).toBeLessThan(0.1);
    }
  });

  it("flies the flag in both shifts", () => {
    const { x, y } = scene.flag;
    const i = y * scene.width + x;
    expect(scene.day[i]).toBe(1);
    expect(scene.night[i]).toBe(1);
  });
});
