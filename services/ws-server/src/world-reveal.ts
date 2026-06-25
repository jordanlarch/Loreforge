/**
 * CAMP-4 / Q11 — auto-reveal campaign world entities when the GM references them.
 *
 * Matches explicit narration `mentions` plus entity names that appear in the
 * prose (longest name first, word-boundary safe). Only undiscovered members are
 * returned so callers can idempotently flip `discovered`.
 */
export type WorldEntityRef = {
  entityId: string;
  name: string;
  discovered: boolean;
};

function isNameChar(ch: string | undefined): boolean {
  return ch !== undefined && /[a-zA-Z0-9]/.test(ch);
}

/** Names from `mentions` plus names found verbatim in `narrationText`. */
export function namesReferencedInNarration(
  narrationText: string,
  mentions: readonly string[],
  worldEntities: readonly WorldEntityRef[],
): string[] {
  const undiscovered = worldEntities.filter((e) => !e.discovered && e.name.trim());
  if (undiscovered.length === 0) return [];

  const found = new Set<string>();

  for (const mention of mentions) {
    const key = mention.trim().toLowerCase();
    if (!key) continue;
    const hit = undiscovered.find((e) => e.name.toLowerCase() === key);
    if (hit) found.add(hit.entityId);
  }

  const sorted = undiscovered
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  const lower = narrationText.toLowerCase();
  const claimed: { start: number; end: number }[] = [];
  const overlaps = (at: number, len: number) =>
    claimed.some((c) => at < c.end && at + len > c.start);
  for (const entity of sorted) {
    const name = entity.name.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(name, from);
      if (at === -1) break;
      const before = at > 0 ? lower[at - 1] : undefined;
      const after = lower[at + name.length];
      if (
        !isNameChar(before) &&
        !isNameChar(after) &&
        !overlaps(at, name.length)
      ) {
        found.add(entity.entityId);
        claimed.push({ start: at, end: at + name.length });
        break;
      }
      from = at + 1;
    }
  }

  return [...found];
}
