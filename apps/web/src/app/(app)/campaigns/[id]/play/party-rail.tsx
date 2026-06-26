"use client";

/**
 * Party rail (PLAY-4, #100) — used in the Party lightbox panel.
 * Live play uses {@link PlayRightRail} for the unified right column.
 */
import type { WorldState } from "@app/engine";

import {
  activeMemberId,
  partyMembersWithRoster,
  type PartyRosterRow,
} from "@/lib/live-party";

import { PartyMemberRow } from "./party-member-row";

export function PartyRail({
  state,
  roster,
  layout = "column",
  companionExpected = false,
  onViewSheet,
}: {
  state: WorldState;
  roster?: readonly PartyRosterRow[];
  layout?: "column" | "row";
  companionExpected?: boolean;
  onViewSheet?: (characterId: string) => void;
}) {
  const members = partyMembersWithRoster(state, roster, { companionExpected });
  if (members.length === 0) return null;
  const activeId = activeMemberId(state);

  return (
    <section
      aria-label="Party"
      className="h-full rounded-lg border border-lore-border bg-lore-surface px-2 py-2"
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-lore-muted">
        Party
      </div>
      <ul
        className={
          layout === "column" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
        }
      >
        {members.map((m) => {
          const npc = m.kind !== "character" || m.id.startsWith("npc:");
          return (
            <PartyMemberRow
              key={m.id}
              member={m}
              active={m.id === activeId}
              expandable={npc}
              expanded={false}
              onViewSheet={onViewSheet}
            />
          );
        })}
      </ul>
    </section>
  );
}
