"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { WorldState } from "@app/engine";

import {
  activeMemberId,
  partyMembersWithRoster,
  type PartyRosterRow,
} from "@/lib/live-party";

import { CharacterRail } from "./character-rail";
import { PartyMemberRow } from "./party-member-row";
import { PlayerCharacterPanel } from "./play-character-panel";

function isNpcMember(member: { id: string; kind: string }): boolean {
  return member.kind !== "character" || member.id.startsWith("npc:");
}

/**
 * Unified right rail (CAMP-UX): party list + expandable player character.
 * Other PCs stay compact; NPC companions can expand inline.
 */
export function PlayRightRail({
  state,
  roster,
  pcCharacterId,
  companionExpected = false,
  onViewSheet,
  onOpenCharacterSheet,
  playerHudExtra,
  tutorialControls,
  inCombat = false,
  collapsed,
  onToggle,
}: {
  state: WorldState;
  roster?: readonly PartyRosterRow[];
  pcCharacterId?: string;
  companionExpected?: boolean;
  onViewSheet?: (characterId: string) => void;
  onOpenCharacterSheet?: () => void;
  playerHudExtra?: ReactNode;
  tutorialControls?: ReactNode;
  inCombat?: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const members = partyMembersWithRoster(state, roster, { companionExpected });
  const playerEntity =
    (pcCharacterId && state.entities[pcCharacterId]) ||
    members.find((m) => m.kind === "character" && !m.id.startsWith("npc:"));
  const playerId = playerEntity?.id;
  const others = members.filter((m) => m.id !== playerId);

  const activeId = activeMemberId(state);
  const [playerExpanded, setPlayerExpanded] = useState(true);
  useEffect(() => {
    if (inCombat) setPlayerExpanded(true);
  }, [inCombat]);
  const [expandedNpcIds, setExpandedNpcIds] = useState<Set<string>>(() => new Set());

  function toggleNpc(id: string) {
    setExpandedNpcIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <CharacterRail collapsed={collapsed} onToggle={onToggle} label="Party">
      {tutorialControls}
      {playerEntity ? (
        <PlayerCharacterPanel
          pc={playerEntity}
          expanded={playerExpanded}
          onToggleExpand={() => setPlayerExpanded((v) => !v)}
          openSheet={onOpenCharacterSheet}
          hudExtra={playerHudExtra}
          coachmark="tut-scene1-hud"
        />
      ) : null}
      {others.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {others.map((member) => {
            const npc = isNpcMember(member);
            return (
              <PartyMemberRow
                key={member.id}
                member={member}
                active={member.id === activeId}
                expandable={npc}
                expanded={npc && expandedNpcIds.has(member.id)}
                onToggleExpand={npc ? () => toggleNpc(member.id) : undefined}
                onViewSheet={onViewSheet}
              />
            );
          })}
        </ul>
      ) : null}
    </CharacterRail>
  );
}
