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
  type EntityState,
  type WorldState,
} from "@app/engine";

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
    : inScene.filter((e) => e.kind === "character");
  return members.sort(compareMembers);
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
