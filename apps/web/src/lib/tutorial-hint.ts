/**
 * Tutorial idle hint logic (TUT-1, #178, D3) — pure client-side decision rules.
 *
 * After 45s of inactivity in a scene, the surface shows a scripted hint chip.
 * Three dismissals trigger gentle auto-progress via the ws-server.
 */

/** Idle duration before the "Stuck?" chip appears (`tutorial-adventure.md` §7). */
export const TUTORIAL_HINT_IDLE_MS = 45_000;

/** Dismissals in one scene before auto-progress fires. */
export const TUTORIAL_HINT_AUTO_DISMISS_THRESHOLD = 3;

/** Whether the idle timer has elapsed enough to show a hint. */
export function shouldShowTutorialHint(
  idleMs: number,
  dismissedThisScene: number,
): boolean {
  if (dismissedThisScene >= TUTORIAL_HINT_AUTO_DISMISS_THRESHOLD) return false;
  return idleMs >= TUTORIAL_HINT_IDLE_MS;
}

/** Whether the player has dismissed enough hints to auto-progress the scene. */
export function shouldAutoProgressScene(dismissedThisScene: number): boolean {
  return dismissedThisScene >= TUTORIAL_HINT_AUTO_DISMISS_THRESHOLD;
}
