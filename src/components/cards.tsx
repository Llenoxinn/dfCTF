"use client";

import type { MouseEvent } from "react";
import { Pips } from "./ui";

export type CardState = "open" | "solved" | "weekly" | "progress";

/** A challenge on the board. Difficulty shows as an edge stripe plus pips, and the label is always written out. */
export function ChallengeCard({ title, category, xp, difficulty, solveCount, state, href, onOpen, tabIndex }: {
  title: string; category: string; xp: number; difficulty: string; solveCount: number; state: CardState;
  href?: string; onOpen?: (event: MouseEvent) => void; tabIndex?: number;
}) {
  const status = state === "solved" ? "[x] solved" : state === "weekly" ? "[ ] this week" : state === "progress" ? "[~] in progress" : "[ ] open";
  const body = <>
    <span className="card-top"><span className="card-cat">{category.toLowerCase()}</span><span className="card-pts mono">{xp}</span></span>
    <strong className="card-title">{title}</strong>
    <span className="card-meta"><Pips value={difficulty} />{difficulty}, {solveCount} {solveCount === 1 ? "solve" : "solves"}</span>
    <span className="card-status mono">{status}</span>
  </>;
  const cls = `card card-${state} diff-${difficulty.toLowerCase()}`;
  return href ? <a className={cls} href={href} onClick={onOpen} tabIndex={tabIndex}>{body}</a> : <div className={cls}>{body}</div>;
}
