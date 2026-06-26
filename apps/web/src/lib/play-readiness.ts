import { entityIdFromSceneId } from "@app/engine";

export type PlayReadinessBlocker = "starting_scene" | "party";

/** Derived prep gates for first Play Now vs Continue (CAMP-UX UX-5). */
export type PlayReadiness = {
  hasEngineState: boolean;
  hasStartingScene: boolean;
  hasActivePc: boolean;
  startingSceneId: string | null;
  startingEntityId: string | null;
  startingLocationName: string | null;
  /** First Play Now when gates pass and the engine log is still empty. */
  canFirstPlay: boolean;
  /** Resume when the campaign has persisted engine events. */
  canContinue: boolean;
  blockers: PlayReadinessBlocker[];
};

export function derivePlayReadiness(input: {
  startingSceneId: string | null | undefined;
  activePcCount: number;
  engineEventCount: number;
  startingLocationName?: string | null;
}): PlayReadiness {
  const hasEngineState = input.engineEventCount > 0;
  const startingSceneId = input.startingSceneId?.trim() || null;
  const hasStartingScene = startingSceneId !== null;
  const hasActivePc = input.activePcCount > 0;
  const startingEntityId =
    entityIdFromSceneId(startingSceneId ?? undefined) ?? null;

  const blockers: PlayReadinessBlocker[] = [];
  if (!hasEngineState) {
    if (!hasStartingScene) blockers.push("starting_scene");
    if (!hasActivePc) blockers.push("party");
  }

  return {
    hasEngineState,
    hasStartingScene,
    hasActivePc,
    startingSceneId,
    startingEntityId,
    startingLocationName: input.startingLocationName ?? null,
    canFirstPlay: !hasEngineState && hasStartingScene && hasActivePc,
    canContinue: hasEngineState,
    blockers,
  };
}
