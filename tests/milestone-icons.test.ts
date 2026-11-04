import { describe, expect, it } from "vitest";
import { MILESTONE_ICONS, MILESTONE_ICON_SIZE, milestoneIconPath } from "@/lib/milestone-icons";
import { profileMilestoneGoals } from "@/lib/player-profile";
import { DEFAULT_CARD, renderProfileCard } from "@/lib/profile-card";
import { profileMilestones } from "@/lib/player-profile";

const stats = { rank: 1, points: 500, solved: 12, firstBloods: 1 };

describe("milestone icons", () => {
  it("draws every milestone on the same 16 by 16 canvas", () => {
    for (const goal of profileMilestoneGoals(stats)) {
      const rows = MILESTONE_ICONS[goal.id];
      expect(rows).toHaveLength(MILESTONE_ICON_SIZE);
      for (const row of rows) expect(row).toMatch(/^[.#]{16}$/);
    }
  });
  it("gives each milestone its own silhouette", () => {
    const ids = profileMilestoneGoals(stats).map(goal => goal.id);
    expect(new Set(ids.map(milestoneIconPath)).size).toBe(ids.length);
  });
  it("draws the same icons on the card instead of a plus sign", () => {
    const milestones = profileMilestones(stats);
    const svg = renderProfileCard({ codename: "fixture_player", displayName: "", bio: "", scope: "Practice · all time", period: "All-time practice", asOf: "2026-11-03T10:00:00Z", ...stats, milestones }, { ...DEFAULT_CARD, milestones: ["first-capture", "first-blood"] });
    expect(svg).toContain(milestoneIconPath("first-capture"));
    expect(svg).toContain(milestoneIconPath("first-blood"));
    expect(svg).not.toContain(milestoneIconPath("ten-captures"));
    expect(svg).not.toContain(">+</text>");
  });
});
