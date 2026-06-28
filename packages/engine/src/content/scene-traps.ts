/**
 * Scene trap eligibility (GRILL-LIVE-TOOLBOX Q2b).
 * Traps belong on encounter / dungeon / building / shop / tavern maps only —
 * never settlement or region overland scenes.
 */
import type { SceneKind, SceneState } from "../entities/types";

export const TRAP_ELIGIBLE_SCENE_KINDS = [
  "encounter",
  "dungeon",
  "building",
  "shop",
  "tavern",
] as const;

export type TrapEligibleSceneKind = (typeof TRAP_ELIGIBLE_SCENE_KINDS)[number];

export function isTrapEligibleSceneKind(
  kind: SceneKind | undefined,
): kind is TrapEligibleSceneKind {
  if (!kind) return false;
  return (TRAP_ELIGIBLE_SCENE_KINDS as readonly string[]).includes(kind);
}

/** Strip traps from scenes that must not carry them (settlement / region / unknown). */
export function normalizeSceneTraps(scene: SceneState): SceneState {
  if (!scene.traps?.length) return scene;
  if (isTrapEligibleSceneKind(scene.sceneKind)) return scene;
  const { traps: _traps, ...rest } = scene;
  return rest;
}
