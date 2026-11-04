import { describe, expect, it } from "vitest";
import { profileMilestoneGoals, profileMilestones } from "@/lib/player-profile";

const stats = (solved: number, firstBloods: number) => ({ rank: null, points: 0, solved, firstBloods });

describe("profile milestones", () => {
  it("keeps the public milestone list to earned results and its existing fields", () => {
    expect(profileMilestones(stats(0, 0))).toEqual([]);
    expect(profileMilestones(stats(3, 0)).map(m => m.id)).toEqual(["first-capture"]);
    for (const milestone of profileMilestones(stats(10, 1))) expect(Object.keys(milestone).sort()).toEqual(["condition", "id", "label"]);
  });
  it("lists every goal for a new player with nothing earned", () => {
    const goals = profileMilestoneGoals(stats(0, 0));
    expect(goals.map(g => g.id)).toEqual(["first-capture", "ten-captures", "first-blood"]);
    expect(goals.every(g => !g.earned)).toBe(true);
    expect(goals.find(g => g.id === "ten-captures")?.target).toEqual({ value: 0, max: 10 });
  });
  it("marks only proven goals as earned and caps progress at the target", () => {
    const goals = profileMilestoneGoals(stats(12, 0));
    expect(goals.map(g => g.earned)).toEqual([true, true, false]);
    expect(goals.find(g => g.id === "ten-captures")?.target).toEqual({ value: 10, max: 10 });
    expect(goals.find(g => g.id === "first-blood")?.text).not.toContain("earliest solve");
  });
});
