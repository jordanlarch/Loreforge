/**
 * Tutorial plot-hook helpers (TUT-1, Scene 2) — detect when Lily has offered
 * the central hook so the Accept panel can appear regardless of which path
 * triggered her dialogue (sidebar button, token drawer, or free-text chat).
 */

type ChatLike = { kind: string; text: string };

/** True when Lily's hook-offer narration already appears in chat. */
export function tutorialLilyHookOfferedInChat(
  chat: readonly ChatLike[],
): boolean {
  return chat.some(
    (e) => e.kind !== "player" && e.text.includes(LILY_HOOK_MARKER),
  );
}
