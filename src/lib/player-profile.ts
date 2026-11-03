import type { Category } from "./types";

export type ProfileScope = "all" | "week";
export type ProfileIdentity = { codename: string; displayName: string; bio: string; websiteUrl: string; githubUrl: string; shareProfile: boolean };
export type ProfileStats = { rank: number | null; points: number; solved: number; firstBloods: number };
export type ProfileMilestone = { id: "first-capture" | "ten-captures" | "first-blood"; label: string; condition: string };
export type ProfileActivity = { challengeId: string; title: string; category: Category; at: string; points: number; firstBlood: boolean };
export type ProfileActivityPage = { items: ProfileActivity[]; nextCursor: string | null };
export type PublicProfileCard = {
  codename: string; displayName: string; bio: string;
  scope: string; period: string; asOf: string;
  rank: number | null; points: number; solved: number; firstBloods: number;
  milestones: ProfileMilestone[];
};
export type PlayerProfile = {
  identity: ProfileIdentity;
  scope: { id: ProfileScope; label: string; period: string };
  asOf: string;
  stats: ProfileStats;
  categories: { category: Category; solved: number; total: number; points: number }[];
  milestones: ProfileMilestone[];
  activity: ProfileActivityPage;
  card: PublicProfileCard;
};

export function profileMilestones(stats: ProfileStats): ProfileMilestone[] {
  return [
    ...(stats.solved >= 1 ? [{ id: "first-capture" as const, label: "First capture", condition: "At least one valid capture in this scope." }] : []),
    ...(stats.solved >= 10 ? [{ id: "ten-captures" as const, label: "Ten captures", condition: "At least ten distinct captures in this scope." }] : []),
    ...(stats.firstBloods >= 1 ? [{ id: "first-blood" as const, label: "First Blood", condition: "At least one earliest solve, with timestamp ties resolved by solve ID, in this scope." }] : []),
  ];
}
