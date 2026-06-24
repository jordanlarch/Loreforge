/**
 * Browser-safe derivation for the Live Play party rail (PLAY-4, #100).
 *
 * Pure helpers that pick the party-side members out of the synced `WorldState`
 * so the rail and its hover mini-HUD render from the server-authoritative
 * projection. During an encounter the party side is "everyone not hostile to the
 * party" (PCs + allied NPCs); outside combat we fall back to the placed PCs in
 * the current scene. The deterministic engine remains the authority — this only
 * drives presentation.
 */
import {
  areHostile,
  FIXTURE_BATTLE_PARTY_SIDE,
  TUTORIAL_COMPANION,
  type AbilityScores,
  type ClassLevel,
  type EntityState,
  type WorldState,
} from "@app/engine";

/** Active campaign roster row used to backfill the rail when the engine entity lags. */
export type PartyRosterRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  maxHp: number;
  baseAc: number;
  speed: number;
  abilityScores: AbilityScores;
  classes: ClassLevel[];
};

/** Stable ordering: PCs first, then allies, alphabetical within each group. */
function compareMembers(a: EntityState, b: EntityState): number {
  if (a.kind !== b.kind) return a.kind === "character" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * The party-side combatants in the current scene. With an active encounter this
 * is every entity not hostile to {@link FIXTURE_BATTLE_PARTY_SIDE} (so allied
 * NPCs ride along); without one it's the placed PCs (`kind === "character"`).
 * Returns a stably-sorted copy so the rail order doesn't jitter as the
 * projection updates.
 */
export function partyMembers(state: WorldState): EntityState[] {
  const sceneId = state.currentSceneId;
  if (!sceneId) return [];
  const encounter = state.encounter;
  const inScene = Object.values(state.entities).filter(
    (e) => e.sceneId === sceneId,
  );
  const members = encounter
    ? inScene.filter(
        (e) => !areHostile(FIXTURE_BATTLE_PARTY_SIDE, encounter.sides[e.id]),
      )
    : inScene.filter(
        (e) => e.kind === "character" || e.id === TUTORIAL_COMPANION.id,
      );
  return members.sort(compareMembers);
}

/**
 * Merge engine party members with active DB roster rows so the rail shows
 * Brennar immediately after hook accept even if the WS summon is still catching up.
 */
export function partyMembersWithRoster(
  state: WorldState,
  roster?: readonly PartyRosterRow[],
  opts?: { companionExpected?: boolean },
): EntityState[] {
  const members = partyMembers(state);
  const extras: EntityState[] = [];

  if (roster?.length) {
    const active = roster.filter(
      (m) =>
        m.status === "active" &&
        (m.role === "pc" || m.role === "companion"),
    );
    const coveredNames = new Set(members.map((m) => m.name.toLowerCase()));
    const coveredIds = new Set(members.map((m) => m.id));

    for (const row of active) {
      const engineId = row.role === "companion" ? TUTORIAL_COMPANION.id : row.id;
      if (
        coveredNames.has(row.name.toLowerCase()) ||
        coveredIds.has(engineId)
      ) {
        continue;
      }
      extras.push({
        id: engineId,
        kind: "character",
        name: row.name,
        abilityScores: row.abilityScores,
        hp: { current: row.maxHp, max: row.maxHp, temp: 0 },
        baseAc: row.baseAc,
        speed: row.speed,
        classes: row.classes,
        proficiencyBonus: 2,
        alive: true,
        dead: false,
        conditions: [],
        sceneId: state.currentSceneId,
      });
      coveredNames.add(row.name.toLowerCase());
      coveredIds.add(engineId);
    }
  }

  if (opts?.companionExpected) {
    const all = [...members, ...extras];
    const hasBrennar = all.some(
      (m) =>
        m.id === TUTORIAL_COMPANION.id ||
        m.name.toLowerCase() === TUTORIAL_COMPANION.name.toLowerCase(),
    );
    if (!hasBrennar) {
      extras.push({
        id: TUTORIAL_COMPANION.id,
        kind: "character",
        name: TUTORIAL_COMPANION.name,
        abilityScores: TUTORIAL_COMPANION.abilityScores,
        hp: {
          current: TUTORIAL_COMPANION.maxHp,
          max: TUTORIAL_COMPANION.maxHp,
          temp: 0,
        },
        baseAc: TUTORIAL_COMPANION.baseAc,
        speed: TUTORIAL_COMPANION.speed,
        classes: TUTORIAL_COMPANION.classes,
        proficiencyBonus: 2,
        alive: true,
        dead: false,
        conditions: [],
        sceneId: state.currentSceneId,
      });
    }
  }

  if (extras.length === 0) return members;
  return [...members, ...extras].sort(compareMembers);
}

/** The id of the combatant whose turn it is, if an encounter is running. */
export function activeMemberId(state: WorldState): string | undefined {
  const encounter = state.encounter;
  if (!encounter) return undefined;
  return encounter.order[encounter.activeIndex]?.entity;
}

/** Clamp a 0–100 HP percentage from current/max (max 0 → 0%). */
export function hpPercent(hp: { current: number; max: number }): number {
  if (hp.max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((hp.current / hp.max) * 100)));
}
