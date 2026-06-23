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
import type { Cell } from "@/lib/battle-map/geometry";
import type { BattleToken } from "@/app/(app)/campaigns/[id]/play/battle-map";
import type { WorldState } from "@app/engine";

export type ExploreModel = {
  cols: number;
  rows: number;
  walls: Cell[];
  tokens: BattleToken[];
  sceneName: string | undefined;
  sceneDescription: string | undefined;
};

/**
 * Build the exploration view model for the current scene, or null when there is
 * nothing to explore (no scene, no map, or an encounter is active — in which
 * case the combat view model owns the board). Tokens are every placed entity in
 * the scene, rendered neutral + static (no hostility, no active turn, not
 * draggable): movement + interaction in exploration are later concerns.
 */
export function buildExploreModel(state: WorldState): ExploreModel | null {
  const sceneId = state.currentSceneId;
  const scene = sceneId ? state.scenes[sceneId] : undefined;
  const map = scene?.map;
  if (!scene || !map || state.encounter) return null;

  const tokens: BattleToken[] = Object.values(state.entities)
    .filter((e) => e.sceneId === sceneId && e.position !== undefined)
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      position: e.position!,
      hp: { current: e.hp.current, max: e.hp.max },
      alive: e.alive,
      hostile: false,
      isActive: false,
      draggable: false,
    }));

  return {
    cols: map.width,
    rows: map.height,
    walls: map.blockedCells,
    tokens,
    sceneName: scene.name,
    sceneDescription: scene.description,
  };
}
