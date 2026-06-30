/**
 * Mid-campaign party join (#98 extension) — place roster members who were added
 * after the live session was seeded onto the current scene (and into an active
 * encounter when one is running).
 */
import { areHostile } from "../combat/reactions";
import type { Command } from "../commands/types";
import type { EntityInit, GridPosition } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { FIXTURE_BATTLE_PARTY_SIDE, type PartyMember } from "./battle";

/** Chebyshev offsets scanned from an anchor when placing a new party member. */
const JOIN_OFFSETS: readonly GridPosition[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
  { x: 0, y: 2 },
  { x: 2, y: 0 },
  { x: 0, y: -2 },
  { x: -2, y: 0 },
];

function cellKey(p: GridPosition): string {
  return `${p.x},${p.y}`;
}

function isFreeCell(
  state: WorldState,
  sceneId: string,
  pos: GridPosition,
): boolean {
  const map = state.scenes[sceneId]?.map;
  if (!map) return true;
  if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) {
    return false;
  }
  if (map.blockedCells.some((c) => c.x === pos.x && c.y === pos.y)) {
    return false;
  }
  return !Object.values(state.entities).some(
    (e) =>
      e.alive &&
      e.sceneId === sceneId &&
      e.position?.x === pos.x &&
      e.position?.y === pos.y,
  );
}

/** Pick a vacant cell adjacent to an existing party-side member in `sceneId`. */
export function findPartyJoinPosition(
  state: WorldState,
  sceneId: string,
): GridPosition | undefined {
  const map = state.scenes[sceneId]?.map;
  const encounter = state.encounter;
  const anchors = Object.values(state.entities).filter((e) => {
    if (!e.alive || e.sceneId !== sceneId || !e.position) return false;
    if (!encounter) return e.kind === "character";
    const side = encounter.sides[e.id];
    return side !== undefined && !areHostile(FIXTURE_BATTLE_PARTY_SIDE, side);
  });
  if (anchors.length === 0) {
    return map ? { x: 2, y: 2 } : { x: 0, y: 0 };
  }
  const anchor = anchors[0]!.position!;
  for (const offset of JOIN_OFFSETS) {
    const pos = { x: anchor.x + offset.x, y: anchor.y + offset.y };
    if (isFreeCell(state, sceneId, pos)) return pos;
  }
  return { x: anchor.x + 1, y: anchor.y };
}

export function partyMemberToEntityInit(
  member: PartyMember,
  sceneId: string,
  position: GridPosition,
): EntityInit {
  return {
    id: member.id,
    kind: "character",
    name: member.name,
    abilityScores: member.abilityScores,
    maxHp: member.maxHp,
    baseAc: member.baseAc,
    speed: member.speed,
    classes: member.classes,
    sceneId,
    position,
    ...(member.saveProficiencies?.length
      ? { saveProficiencies: member.saveProficiencies }
      : {}),
    ...(member.meleeReachFt !== undefined
      ? { meleeReachFt: member.meleeReachFt }
      : {}),
    ...(member.spellcasting ? { spellcasting: member.spellcasting } : {}),
    ...(member.featureChoices
      ? { featureChoices: { ...member.featureChoices } }
      : {}),
    ...(member.resourceUses
      ? {
          resourceUses: Object.fromEntries(
            Object.entries(member.resourceUses).map(([k, v]) => [k, [...v]]),
          ),
        }
      : {}),
  };
}

/**
 * Commands to bring `member` into the live world. Idempotent when the entity
 * already exists (returns an empty list).
 */
export function buildPartyMemberJoinCommands(
  member: PartyMember,
  state: WorldState,
): Command[] {
  if (state.entities[member.id]) return [];
  const sceneId = state.currentSceneId;
  if (!sceneId) return [];
  const position = findPartyJoinPosition(state, sceneId);
  if (!position) return [];

  const commands: Command[] = [
    {
      type: "create_entity",
      entity: partyMemberToEntityInit(member, sceneId, position),
    },
  ];

  const encounter = state.encounter;
  if (
    encounter &&
    encounter.sceneId === sceneId &&
    encounter.initiativeRolled &&
    !encounter.combatants.includes(member.id)
  ) {
    commands.push({
      type: "add_combatant",
      entityId: member.id,
      side: FIXTURE_BATTLE_PARTY_SIDE,
    });
  }

  return commands;
}
