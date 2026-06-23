/**
 * `@Entity` autolink parsing for campaign notes (CAMP-9).
 *
 * A mention is the `@` sigil immediately followed by a known Realms entity name
 * (case-insensitive). Multi-word names are supported by matching against the
 * owner's actual entity names rather than a naive `@token` rule, longest name
 * first so `@Ravenwood Keep` wins over `@Ravenwood`. A trailing word-boundary
 * check prevents `@Raven` from matching inside `@Ravenna`.
 *
 * Pure + deterministic so it's unit-testable; the Notes editor renders the
 * resulting segments, turning mentions into links to the entity detail page.
 */
export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; entityId: string };

export type MentionEntity = { id: string; name: string };

/** Whether `ch` continues a name token (so a match must end at a non-name char). */
function isNameChar(ch: string | undefined): boolean {
  return ch !== undefined && /[a-zA-Z0-9]/.test(ch);
}

/** Split `body` into ordered text + `@mention` segments. */
export function linkifyMentions(
  body: string,
  entities: readonly MentionEntity[],
): MentionSegment[] {
  if (!body) return [];
  const named = entities
    .filter((e) => e.name.trim().length > 0)
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return [{ kind: "text", text: body }];

  const segments: MentionSegment[] = [];
  let buf = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@") {
      const rest = body.slice(i + 1);
      const lower = rest.toLowerCase();
      const match = named.find((e) => {
        const name = e.name.toLowerCase();
        return (
          lower.startsWith(name) && !isNameChar(rest[name.length])
        );
      });
      if (match) {
        if (buf) {
          segments.push({ kind: "text", text: buf });
          buf = "";
        }
        // Preserve the note's original casing in the displayed mention text.
        const shown = body.slice(i, i + 1 + match.name.length);
        segments.push({ kind: "mention", text: shown, entityId: match.id });
        i += 1 + match.name.length;
        continue;
      }
    }
    buf += body[i];
    i += 1;
  }
  if (buf) segments.push({ kind: "text", text: buf });
  return segments;
}

/** Whether any segment is a resolved mention (drives whether to show a preview). */
export function hasMentions(segments: readonly MentionSegment[]): boolean {
  return segments.some((s) => s.kind === "mention");
}
