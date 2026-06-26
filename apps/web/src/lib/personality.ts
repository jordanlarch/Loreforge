/** Personality fields stored inline in `characters.notes` (no migration). */
export type PersonalityFields = {
  traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
};

const MARKER = "\n\n---loreforge-personality-v1---\n";

const EMPTY: PersonalityFields = {
  traits: "",
  ideals: "",
  bonds: "",
  flaws: "",
};

export function parseNotes(notes: string): {
  backstory: string;
  personality: PersonalityFields;
} {
  const idx = notes.indexOf(MARKER);
  if (idx === -1) {
    return { backstory: notes.trim(), personality: { ...EMPTY } };
  }
  const backstory = notes.slice(0, idx).trim();
  try {
    const raw = JSON.parse(notes.slice(idx + MARKER.length)) as Partial<
      PersonalityFields
    >;
    return {
      backstory,
      personality: {
        traits: raw.traits ?? "",
        ideals: raw.ideals ?? "",
        bonds: raw.bonds ?? "",
        flaws: raw.flaws ?? "",
      },
    };
  } catch {
    return { backstory: notes.trim(), personality: { ...EMPTY } };
  }
}

export function mergeNotes(
  backstory: string,
  personality: PersonalityFields,
): string {
  const trimmed = backstory.trim();
  const hasPersonality = Object.values(personality).some((v) => v.trim());
  if (!hasPersonality) return trimmed;
  return `${trimmed}${MARKER}${JSON.stringify(personality)}`;
}
