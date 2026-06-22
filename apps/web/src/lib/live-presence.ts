/**
 * Browser-safe helpers for async-play affordances (PLAY-13, #105).
 *
 * The play surface is one shell in two sync modes (async/solo vs live); these
 * pure helpers drive the affordances that bridge them: a "someone joined —
 * you're now Live" prompt when the peer count rises, and a "mid-session" resume
 * summary derived from the persisted engine projection.
 */
import type { WorldState } from "@app/engine";

/**
 * A prompt to surface when the connected-peer count rises into Live territory
 * (≥2). Returns null when no one new joined or we're still solo. `prev`/`next`
 * are awareness peer counts (1 = just you).
 */
export function joinedSincePrompt(prev: number, next: number): string | null {
  if (next <= prev || next < 2) return null;
  const others = next - 1;
  return `${others} other ${
    others === 1 ? "player" : "players"
  } connected — you're now in a Live session.`;
}

export type ResumeSummary = {
  sceneName?: string;
  round?: number;
  inCombat: boolean;
};

/**
 * A "mid-session" summary for the resume banner, or null when there's nothing to
 * resume. A campaign is resumable once it has a current scene or an active
 * encounter in its persisted projection.
 */
export function resumeSummary(
  state: WorldState | undefined,
): ResumeSummary | null {
  if (!state) return null;
  const sceneId = state.currentSceneId;
  if (!sceneId && !state.encounter) return null;
  const sceneName = sceneId ? state.scenes[sceneId]?.name : undefined;
  return {
    sceneName,
    round: state.encounter?.round,
    inCombat: state.encounter !== undefined,
  };
}
