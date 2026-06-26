"use client";

import type { ReactNode } from "react";

import type { EntityState } from "@app/engine";

/** Compact stats + optional sheet link for the signed-in player's character. */
export function PlayerCharacterPanel({
  pc,
  expanded,
  onToggleExpand,
  openSheet,
  hudExtra,
  coachmark,
}: {
  pc: EntityState;
  expanded: boolean;
  onToggleExpand: () => void;
  openSheet?: () => void;
  hudExtra?: ReactNode;
  coachmark?: string;
}) {
  return (
    <div
      data-coachmark={coachmark}
      className="rounded-lg border border-lore-border bg-lore-surface"
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="font-display text-base leading-tight text-lore-text">
            {pc.name}
          </div>
          <div className="mt-0.5 text-[11px] text-lore-muted">
            {pc.hp.current}/{pc.hp.max} HP · AC {pc.baseAc} · {pc.speed}ft
          </div>
        </div>
        <span className="shrink-0 text-xs text-lore-muted" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-lore-border px-2.5 py-2">
          {openSheet ? (
            <button
              type="button"
              onClick={openSheet}
              className="mb-2 text-[11px] text-lore-accent hover:text-lore-text"
            >
              Open character sheet
            </button>
          ) : null}
          {hudExtra}
        </div>
      ) : null}
    </div>
  );
}
