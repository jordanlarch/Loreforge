/** @deprecated Use character-sheet-storage — kept for imports. */
export type { PersonalityFields } from "./character-sheet-storage";

import {
  EMPTY_PERSONALITY,
  parseCharacterNotes,
  serializeCharacterNotes,
  type PersonalityFields,
} from "./character-sheet-storage";

export function parseNotes(notes: string): {
  backstory: string;
  personality: PersonalityFields;
} {
  const parsed = parseCharacterNotes(notes);
  return {
    backstory: parsed.sessionNotes,
    personality: parsed.personality,
  };
}

export function mergeNotes(
  backstory: string,
  personality: PersonalityFields,
): string {
  return serializeCharacterNotes(backstory, personality, {});
}

export { EMPTY_PERSONALITY };
