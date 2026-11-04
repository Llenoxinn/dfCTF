export type ViewSurface = "boot" | "landing" | "auth" | "gate" | "app";
export type ViewMotion = "none" | "fade" | "forward" | "back";

export const VIEW_MOTION_MS = 220;

/** Slides follow the navigation order; anything crossing between whole screens only fades. */
export function viewMotion(from: { surface: ViewSurface; view: string }, to: { surface: ViewSurface; view: string }, order: readonly string[]): ViewMotion {
  if (from.surface === "boot" || to.surface === "boot") return "none";
  if (from.surface !== to.surface) return "fade";
  if (to.surface !== "app" || from.view === to.view) return "none";
  return order.indexOf(to.view) > order.indexOf(from.view) ? "forward" : "back";
}

export function viewKeyframes(motion: Exclude<ViewMotion, "none">, reducedMotion: boolean): Keyframe[] {
  if (motion === "fade" || reducedMotion) return [{ opacity: 0 }, { opacity: 1 }];
  return [{ opacity: 0, transform: `translateX(${motion === "forward" ? 20 : -20}px)` }, { opacity: 1, transform: "none" }];
}
