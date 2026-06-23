/**
 * Sessions tab helpers (CAMP-6, #151) — pure display logic over the MEM-4
 * `sessions` API, kept browser-safe and unit-testable so the cards stay thin.
 */

/** Number of chat messages a session covers (its `[startSeq, endSeq)` span). */
export function sessionMessageCount(startSeq: number, endSeq: number): number {
  return Math.max(0, endSeq - startSeq);
}

export type RecapDisplay = {
  text: string;
  /** True when there's no real recap (render muted / placeholder styling). */
  muted: boolean;
};

/**
 * What to show for a session's recap: the recap text, or a muted placeholder
 * when none was generated (AI generation unconfigured, or generation failed —
 * the session is still recorded). MEM-4 leaves `recap` empty in that case.
 */
export function recapDisplay(recap: string): RecapDisplay {
  const text = recap.trim();
  return text
    ? { text, muted: false }
    : {
        text: "No recap was generated for this session.",
        muted: true,
      };
}
