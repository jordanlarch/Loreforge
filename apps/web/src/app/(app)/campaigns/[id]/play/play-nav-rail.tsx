"use client";

import {
  PLAY_NAV_ITEMS,
  type PlayNavId,
} from "@/lib/play-shell";
import type { CampaignAccessRole } from "@/lib/campaign-access";

/**
 * Left icon nav for the play shell (CAMP-UX UX-1).
 */
export function PlayNavRail({
  active,
  campaignId,
  role,
  onSelect,
}: {
  active: PlayNavId | null;
  campaignId?: string;
  /** Seated players see a reduced nav (CAMP-14). */
  role?: CampaignAccessRole | null;
  onSelect: (id: PlayNavId) => void;
}) {
  const items = PLAY_NAV_ITEMS.filter((item) => {
    if (item.campaignOnly && !campaignId) return false;
    if (item.ownerOnly && role === "player") return false;
    return true;
  });

  return (
    <nav
      aria-label="Play navigation"
      className="flex w-11 shrink-0 flex-col gap-0.5 border-r border-lore-border py-1 sm:w-12"
    >
      {items.map((item) => {
        const selected = active === item.id || (item.id === "play" && active === null);
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={selected ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={`mx-1 flex flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] transition-colors ${
              selected
                ? "bg-lore-accent-dim text-lore-accent"
                : "text-lore-muted hover:bg-lore-surface hover:text-lore-text"
            }`}
          >
            <span className="text-base leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="hidden leading-tight sm:block">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
