/**
 * Sessions tab helpers (CAMP-6, #151) — pure display logic over the MEM-4
 * `sessions` API, kept browser-safe and unit-testable so the cards stay thin.
 */

/** How long after end-session we poll for an async (Trigger.dev) recap. */
export const RECAP_PENDING_MS = 5 * 60 * 1000;

/** Number of chat messages a session covers (its `[startSeq, endSeq)` span). */
export function sessionMessageCount(startSeq: number, endSeq: number): number {
  return Math.max(0, endSeq - startSeq);
}

/** True when a session row is still waiting on a durable recap job. */
export function isRecapPending(
  recap: string,
  endedAt: Date | string,
  now = Date.now(),
): boolean {
  if (recap.trim()) return false;
  return now - new Date(endedAt).getTime() < RECAP_PENDING_MS;
}

export type RecapDisplay = {
  text: string;
  /** True when there's no real recap (render muted / placeholder styling). */
  muted: boolean;
};

export type RecapDisplayOptions = {
  /** Async recap job still in flight (Trigger.dev). */
  pending?: boolean;
};

/**
 * What to show for a session's recap: the recap text, or a muted placeholder
 * when none was generated (AI generation unconfigured, or generation failed —
 * the session is still recorded). MEM-4 leaves `recap` empty in that case.
 */
export function recapDisplay(
  recap: string,
  opts?: RecapDisplayOptions,
): RecapDisplay {
  const text = recap.trim();
  if (text) return { text, muted: false };
  if (opts?.pending) {
    return { text: "Generating recap…", muted: true };
  }
  return {
    text: "No recap was generated for this session.",
    muted: true,
  };
}
