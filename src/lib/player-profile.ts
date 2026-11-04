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

const MILESTONES: (ProfileMilestone & { goal: string; earned: (stats: ProfileStats) => boolean; target?: (stats: ProfileStats) => { value: number; max: number } })[] = [
  { id: "first-capture", label: "First solve", condition: "At least one valid solve in this scope.", goal: "Solve any practice challenge.", earned: stats => stats.solved >= 1 },
  { id: "ten-captures", label: "Ten solves", condition: "At least ten distinct solves in this scope.", goal: "Solve ten different practice challenges.", earned: stats => stats.solved >= 10, target: stats => ({ value: Math.min(stats.solved, 10), max: 10 }) },
  { id: "first-blood", label: "First Blood", condition: "At least one earliest solve, with timestamp ties resolved by solve ID, in this scope.", goal: "Be the first player to solve a challenge.", earned: stats => stats.firstBloods >= 1 },
];

export function profileMilestones(stats: ProfileStats): ProfileMilestone[] {
  return MILESTONES.filter(m => m.earned(stats)).map(({ id, label, condition }) => ({ id, label, condition }));
}

/** Every milestone, earned or not, so the owner can see what to aim for. Only proven results count as earned. */
export function profileMilestoneGoals(stats: ProfileStats) {
  return MILESTONES.map(m => ({ id: m.id, label: m.label, earned: m.earned(stats), text: m.earned(stats) ? m.condition : m.goal, target: m.target?.(stats) ?? null }));
}
