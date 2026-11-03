import { CATEGORIES, DIFFICULTIES } from "./types";

const protectedViews = ["practice", "leaderboard", "progress", "competitions", "authoring", "settings"];

/** Keep login destinations inside known workspace routes; never accept an external redirect. */
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/?")) return null;
  const url = new URL(value, "https://dfctf.invalid");
  if (url.origin !== "https://dfctf.invalid" || url.pathname !== "/") return null;
  const view = url.searchParams.get("view");
  if (!view || !protectedViews.includes(view)) return null;
  const params = new URLSearchParams({ view });
  for (const key of ["challenge", "competition"] as const) {
    const id = url.searchParams.get(key);
    if (id && id.length <= 200) params.set(key, id);
  }
  const category = url.searchParams.get("category"), difficulty = url.searchParams.get("difficulty");
  if (CATEGORIES.some(value => value === category)) params.set("category", category!);
  if (DIFFICULTIES.some(value => value === difficulty)) params.set("difficulty", difficulty!);
  return `/?${params}`;
}

export function authDestination(search: string): string | null {
  const params = new URLSearchParams(search);
  return safeReturnTo(params.get("returnTo")) ?? safeReturnTo(`/?${params}`);
}

export function destinationLabel(destination: string): string {
  const params = new URLSearchParams(destination.split("?")[1]);
  const view = params.get("view");
  if (view === "practice") return params.has("challenge") ? "the selected challenge" : params.has("category") ? `${params.get("category")} challenges` : "the challenge library";
  return ({ leaderboard: "the full leaderboard", progress: "your progress", competitions: "competitions", authoring: "authoring", settings: "your settings" } as Record<string, string>)[view ?? ""] ?? "the challenge library";
}
