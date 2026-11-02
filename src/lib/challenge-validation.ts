import { z } from "zod";
import { CATEGORIES, DIFFICULTIES } from "./types";

export const tagsInput = z.array(z.string().trim().min(1).max(32, "Keep each tag to 32 characters or fewer.")).max(8, "Use no more than 8 tags.");
export const flagFormatInput = z.string().trim().min(3, "Enter a flag format with at least 3 characters.").max(100, "Keep the flag format to 100 characters or fewer.");

// Shared by the editor and server so validation stays consistent for creates and edits.
export const challengeContentInput = z.object({
  title: z.string().trim().min(3, "Enter a title with at least 3 characters.").max(80, "Keep the title to 80 characters or fewer."),
  summary: z.string().trim().max(240).optional(),
  description: z.string().trim().min(20, "Enter a description with at least 20 characters.").max(20000, "Keep the description to 20,000 characters or fewer."),
  solution: z.string().trim().min(20, "Enter a walkthrough with at least 20 characters.").max(50000, "Keep the walkthrough to 50,000 characters or fewer."),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  visibility: z.enum(["practice", "competition"]).optional(),
  tags: tagsInput.default([]),
  xp: z.number({ error: "Enter a whole number of points from 0 to 1,000." }).int("Enter a whole number of points.").min(0, "Points must be at least 0.").max(1000, "Points must be 1,000 or fewer."),
  estimatedMinutes: z.number({ error: "Enter a whole number of minutes from 1 to 480." }).int("Enter a whole number of minutes.").min(1, "Minutes must be at least 1.").max(480, "Minutes must be 480 or fewer."),
  flag: z.string().trim().min(8, "Enter a correct flag with at least 8 characters.").max(200, "Keep the correct flag to 200 characters or fewer.").regex(/^dfctf\{[^\r\n{}]+\}$/i, "Use dfCTF{your_flag}."),
  flagFormat: flagFormatInput.default("dfCTF{...}"),
}).strict();
