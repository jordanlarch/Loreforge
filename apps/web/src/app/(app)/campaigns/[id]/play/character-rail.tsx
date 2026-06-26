"use client";

import type { ReactNode } from "react";

/**
 * Collapsible right character rail (CAMP-UX UX-1).
 */
export function CharacterRail({
  collapsed,
  onToggle,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (collapsed) {
    return (
      <aside className="flex w-8 shrink-0 flex-col items-center border-l border-lore-border py-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-lore-border px-1 py-2 text-xs text-lore-muted transition-colors hover:text-lore-text"
          title="Show character panel"
          aria-label="Expand character panel"
        >
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-lore-border py-1 pl-2 lg:w-60">
      <div className="flex items-center justify-between gap-1 pr-1">
        <span className="text-[10px] uppercase tracking-widest text-lore-muted">
          Character
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-lore-border px-1.5 py-0.5 text-[10px] text-lore-muted transition-colors hover:text-lore-text"
          title="Hide character panel"
          aria-label="Collapse character panel"
        >
          ▶
        </button>
      </div>
      {children}
    </aside>
  );
}
