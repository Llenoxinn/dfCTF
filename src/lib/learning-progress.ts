import { z } from "zod";
import { LEARNING_PATHS, TOPIC_INFO, type LearningProgress } from "./resource-learning";

const id = z.string().regex(/^[a-z][a-z0-9-]{0,99}$/);
const topic = id.refine(value => Object.hasOwn(TOPIC_INFO, value), "Unknown topic.");
const bookmark = z.string().max(201).refine(value => {
  const [area, tool, extra] = value.split("/");
  return Object.hasOwn(TOPIC_INFO, area) && extra === undefined && (tool === undefined || id.safeParse(tool).success);
}, "Unknown bookmark.");
const list = (item: typeof topic | typeof bookmark) => z.array(item).max(100).transform(values => [...new Set(values)]);
const changes = (item: typeof topic | typeof bookmark) => z.object({ add: list(item), remove: list(item) }).strict();
const last = z.object({ topic, section: id, path: id.optional() }).strict().refine(value => !value.path || LEARNING_PATHS.some(path => path.id === value.path && path.topics.includes(value.topic)), "Unknown learning path.");

export const learningPatchSchema = z.object({
  bookmarks: changes(bookmark).optional(),
  completed: changes(topic).optional(),
  open: z.record(topic, z.array(id).max(100)).optional(),
  last: last.nullable().optional(),
}).strict();
export type LearningPatch = z.infer<typeof learningPatchSchema>;

export function diffLearningProgress(before: LearningProgress, after: LearningProgress): LearningPatch {
  const patch: LearningPatch = {};
  for (const key of ["bookmarks", "completed"] as const) {
    const add = after[key].filter(value => !before[key].includes(value));
    const remove = before[key].filter(value => !after[key].includes(value));
    if (add.length || remove.length) patch[key] = { add, remove };
  }
  const open = Object.fromEntries(Object.entries(after.open).filter(([key, value]) => JSON.stringify(before.open[key]) !== JSON.stringify(value)));
  if (Object.keys(open).length) patch.open = open;
  if (JSON.stringify(before.last) !== JSON.stringify(after.last)) patch.last = after.last;
  return patch;
}

export function applyLearningPatch(progress: LearningProgress, patch: LearningPatch): LearningProgress {
  const update = (key: "bookmarks" | "completed") => [...new Set([...progress[key].filter(value => !patch[key]?.remove.includes(value)), ...(patch[key]?.add ?? [])])].slice(0, 100);
  return { bookmarks: update("bookmarks"), completed: update("completed"), open: { ...progress.open, ...patch.open }, last: Object.hasOwn(patch, "last") ? patch.last ?? null : progress.last };
}

export function mergeLearningPatches(first: LearningPatch, second: LearningPatch): LearningPatch {
  const result: LearningPatch = { ...first, ...second };
  for (const key of ["bookmarks", "completed"] as const) {
    if (!first[key] && !second[key]) continue;
    const add = new Set(first[key]?.add), remove = new Set(first[key]?.remove);
    for (const value of second[key]?.remove ?? []) { add.delete(value); remove.add(value); }
    for (const value of second[key]?.add ?? []) { remove.delete(value); add.add(value); }
    result[key] = { add: [...add], remove: [...remove] };
  }
  if (first.open || second.open) result.open = { ...first.open, ...second.open };
  return result;
}
