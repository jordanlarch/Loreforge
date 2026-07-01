/**
 * Browser-safe derivation for Live Play **exploration mode** (TUT-1, D2).
 *
 * The combat surface's view model requires an active encounter (initiative,
 * action economy, movement radius). Exploration is the non-combat counterpart:
 * a scene that has a map but no encounter — used by the tutorial's arrival
 * scenes and, later, any out-of-combat scene. This module derives just the
 * static board (grid + walls + placed tokens) from the synced `WorldState`, so
 * the surface can render map + tokens + chat + HUD without combat chrome. The
 * deterministic engine remains the authority — this only drives presentation.
 */
import { FEET_PER_CELL, parseDungeonFloorSceneId } from "@app/engine";
import type { WorldState } from "@app/engine";

import type { Cell } from "@/lib/battle-map/geometry";
import { reachableCells } from "@/lib/battle-map/geometry";
import type { BattleToken } from "@/app/(app)/campaigns/[id]/play/battle-map";

export type ExploreModel = {
  cols: number;
  rows: number;
  walls: Cell[];
  tokens: BattleToken[];
  /** Movement-radius highlight for the party PC (one speed-budget step). */
  reachable: Cell[];
  /** The draggable party PC entity id, when one is on the board. */
  pcEntityId: string | undefined;
  /** When set, unrevealed dungeon cells render fog (DUN-5). */
  fog?: {
    revealed: Set<string>;
  };
  sceneName: string | undefined;
  sceneDescription: string | undefined;
};

/** The lead PC on an exploration map (not an `npc:*` companion token). */
function explorePcEntity(
  state: WorldState,
  sceneId: string,
): (typeof state.entities)[string] | undefined {
  return Object.values(state.entities).find(
    (e) =>
      e.sceneId === sceneId &&
      e.kind === "character" &&
      e.position !== undefined &&
      !e.id.startsWith("npc:"),
  );
}

/**
 * Build the exploration view model for the current scene, or null when there is
 * nothing to explore (no scene, no map, or an encounter is active — in which
 * case the combat view model owns the board). The party PC token is draggable
 * with a one-step movement radius; NPC/companion tokens stay tappable only.
 */
export function buildExploreModel(state: WorldState): ExploreModel | null {
  const sceneId = state.currentSceneId;
  const scene = sceneId ? state.scenes[sceneId] : undefined;
  const map = scene?.map;
  if (!scene || !map || state.encounter) return null;

  const pc = sceneId ? explorePcEntity(state, sceneId) : undefined;

  const placed = Object.values(state.entities).filter(
    (e) => e.sceneId === sceneId && e.position !== undefined,
  );

  const tokens: BattleToken[] = placed.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    position: e.position!,
    hp: { current: e.hp.current, max: e.hp.max },
    alive: e.alive,
    hostile: false,
    isActive: false,
    draggable: e.id === pc?.id && e.alive,
    interactive:
      e.kind === "npc" ||
      (e.kind === "character" && e.id.startsWith("npc:")),
  }));

  let reachable: Cell[] = [];
  if (pc?.position && pc.alive) {
    const maxSteps = Math.floor((pc.speed ?? 30) / FEET_PER_CELL);
    const wallSet = new Set(map.blockedCells.map((c) => `${c.x},${c.y}`));
    const occupied = new Set(
      placed
        .filter((e) => e.alive && e.id !== pc.id)
        .map((e) => `${e.position!.x},${e.position!.y}`),
    );
    reachable = reachableCells(
      pc.position,
      maxSteps,
      (c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height,
      (c) => wallSet.has(`${c.x},${c.y}`),
    ).filter((c) => !occupied.has(`${c.x},${c.y}`));
  }

  let fog: ExploreModel["fog"];
  if (sceneId && parseDungeonFloorSceneId(sceneId) && pc?.id) {
    const keys = state.dungeonFog?.[pc.id]?.[sceneId];
    if (keys && keys.length > 0) {
      fog = { revealed: new Set(keys) };
    }
  }

  return {
    cols: map.width,
    rows: map.height,
    walls: map.blockedCells,
    tokens,
    reachable,
    pcEntityId: pc?.id,
    fog,
    sceneName: scene.name,
    sceneDescription: scene.description,
  };
}
