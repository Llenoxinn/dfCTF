export const CATEGORIES = ["General skills", "OSINT", "Steganography", "Forensics", "Web exploitation", "Binary exploitation", "Miscellaneous"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Category = typeof CATEGORIES[number];
export type Difficulty = typeof DIFFICULTIES[number];
export type ChallengeStatus = "draft" | "review" | "published" | "archived";
export type ChallengeSummary = {
  id: string; slug: string; title: string; category: Category; difficulty: Difficulty;
  summary: string; tags: string[]; xp: number; estimatedMinutes: number;
  solved: boolean; attempted: boolean; solveCount: number; status: ChallengeStatus;
};
export type ChallengeDetail = ChallengeSummary & {
  description: string; flagFormat: string; author: string; version: number;
  files: {id: string; name: string; size: number; sha256: string}[];
  solution?: string;
};
export type Viewer = {
  id: string; email: string; codename: string | null; emailVerified: boolean;
  role: "participant" | "author" | "reviewer" | "admin"; twoFactorEnabled: boolean;
};
export type Bootstrap = {
  user: Viewer | null; hasAccess: boolean; staffVerified: boolean;
  providers: { google: boolean; github: boolean }; localMail: boolean;
};
export type Progress = {
  totalXp: number; solvedCount: number; attemptedCount: number;
  categories: {category: Category; solved: number; total: number}[];
  recentSolves: {id: string; title: string; slug: string; xp: number; solvedAt: string; category: Category}[];
};
