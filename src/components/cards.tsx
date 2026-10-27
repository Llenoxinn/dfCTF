"use client";

import type { MouseEvent } from "react";
import { Pips } from "./ui";

export type CardState = "open" | "solved" | "weekly" | "progress";

const STATUS: Record<CardState, [string, string]> = { solved: ["[x]", "solved"], weekly: ["[ ]", "this week"], progress: ["[~]", "in progress"], open: ["[ ]", "open"] };

/** A challenge on the board: status and points, the title, then difficulty pips with the label written out. Category shows only when the card stands alone. */
export function ChallengeCard({ title, category, xp, difficulty, solveCount, state, href, onOpen, tabIndex }: {
  title: string; category?: string; xp: number; difficulty: string; solveCount: number; state: CardState;
  href?: string; onOpen?: (event: MouseEvent) => void; tabIndex?: number;
}) {
  const [glyph, status] = STATUS[state];
  const body = <>
    <span className="card-top"><span className="card-status mono"><span aria-hidden="true">{glyph} </span>{status}</span><span className="card-pts mono">{xp}<small> pts</small></span></span>
    <strong className="card-title">{title}</strong>
    <span className="card-meta"><Pips value={difficulty} />{difficulty}<span aria-hidden="true">·</span>{solveCount} {solveCount === 1 ? "solve" : "solves"}{category ? <><span aria-hidden="true">·</span>{category}</> : null}</span>
  </>;
  const cls = `card card-${state}`;
  return href ? <a className={cls} href={href} onClick={onOpen} tabIndex={tabIndex}>{body}</a> : <div className={cls}>{body}</div>;
}
