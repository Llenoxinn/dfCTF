export const CATEGORIES = ["General skills", "OSINT", "Steganography", "Forensics", "Web exploitation", "Binary exploitation", "Miscellaneous"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Category = typeof CATEGORIES[number];
export type Difficulty = typeof DIFFICULTIES[number];
export type ChallengeStatus = "draft" | "review" | "published" | "archived";
export type ChallengeSummary = {
  id: string; slug: string; title: string; category: Category; difficulty: Difficulty;
  summary: string; tags: string[]; xp: number; estimatedMinutes: number;
  solved: boolean; attempted: boolean; solveCount: number; status: ChallengeStatus;
  author?: string; updatedAt?: string;
  weeklyEndsAt?: string;
};
export type ChallengeDetail = ChallengeSummary & {
  description: string; flagFormat: string; author: string; version: number;
  files: {id: string; name: string; size: number; sha256: string}[];
  solution?: string; solvers?: string[];
};
export type Viewer = {
  id: string; email: string; codename: string | null; emailVerified: boolean;
  role: "participant" | "author" | "reviewer" | "admin"; twoFactorEnabled: boolean;
};
export type Bootstrap = {
  user: Viewer | null; hasAccess: boolean; staffVerified: boolean;
  providers: { google: boolean; github: boolean }; localMail: boolean;
};
export type Standing = { rank: number; codename: string; points: number; solves: number };
export type SolveEvent = { at: string; codename: string; title: string; points: number; firstBlood: boolean };
export type WeeklyChallenge = { id: string; title: string; summary: string; category: Category; difficulty: Difficulty; xp: number; solveCount: number; solvers: string[]; endsAt: string };
export type Community = {
  weekly: WeeklyChallenge | null; recent: SolveEvent[]; top: Standing[]; topAll: Standing[];
  activity: { start: string; days: number[] };
  totals: { challenges: number; categories: { category: Category; easy: number; medium: number; hard: number }[] };
};
export type Leaderboard = {
  range: "week" | "all"; weekEndsAt: string; players: number; standings: Standing[];
  viewer: (Standing & { gap: { codename: string; points: number } | null }) | null;
  race: { snapshots: string[]; players: { codename: string; points: number; ranks: (number | null)[] }[] };
  hourly: { start: string; counts: number[]; firstBlood: boolean[] };
  challenges: { id: string; title: string; category: Category; difficulty: Difficulty; xp: number; solveCount: number; solved: boolean }[];
  mine: { start: string; days: number[] };
};
export type Progress = {
  totalXp: number; solvedCount: number; attemptedCount: number;
  categories: {category: Category; solved: number; total: number}[];
  recentSolves: {id: string; title: string; slug: string; xp: number; solvedAt: string; category: Category}[];
};
