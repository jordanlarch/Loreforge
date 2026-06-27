/**
 * Extended character sheet data stored in `characters.notes` (no migration).
 * Backward-compatible with legacy personality markers.
 */

import type { AsiChoice } from "@app/engine";

export type PersonalityFields = {
  traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
};

export type Currency = {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
};

export type Characteristics = {
  alignment: string;
  gender: string;
  eyeColor: string;
  size: string;
  height: string;
  faith: string;
  hairColor: string;
  skinColor: string;
  age: string;
  weight: string;
};

export type Defenses = {
  resistances: string;
  vulnerabilities: string;
  immunities: string;
  conditionImmunities: string;
};

export type Senses = {
  darkvision: string;
  blindsight: string;
  tremorsense: string;
  truesight: string;
};

export type ProficiencyTags = {
  weapons: string[];
  armor: string[];
  tools: string[];
  languages: string[];
};

export type ActiveEffect = {
  id: string;
  name: string;
  mod: string;
  affects: string;
  enabled: boolean;
};

export type NoteEntry = {
  id: string;
  name: string;
  description: string;
};

export type NoteCategory = {
  id: string;
  name: string;
  entries: NoteEntry[];
};

export type CharacterSheetMeta = {
  currentHp?: number;
  tempHp?: number;
  inspiration?: boolean;
  currency?: Currency;
  characteristics?: Partial<Characteristics>;
  appearance?: string;
  backgroundDescription?: string;
  defenses?: Partial<Defenses>;
  senses?: Partial<Senses>;
  proficiencies?: Partial<ProficiencyTags>;
  deathSaves?: { successes: number; failures: number };
  /** featureKey → used slots (true = spent) */
  resourceUses?: Record<string, boolean[]>;
  activeEffects?: ActiveEffect[];
  noteCategories?: NoteCategory[];
  /** className → { current, max } hit dice remaining */
  hitDice?: Record<string, { current: number; max: number }>;
  /** Feats chosen instead of ASI or from background origin. */
  feats?: string[];
  /** className → fighting style label (Fighter, Ranger, Paladin). */
  fightingStyles?: Record<string, string>;
  /** When true, level-up ignores XP thresholds (milestone mode). */
  milestoneXp?: boolean;
  /** Warlock pact magic — separate from pooled spell slots. */
  pactMagic?: PactMagicPool;
  /** Level-up audit trail (CHAR-8). */
  levelHistory?: LevelHistoryEntry[];
  /** Action Surge spent — ready for an extra action this turn (sheet/Live Play). */
  actionSurgeReady?: boolean;
  /** Active combat feat toggles (Sharpshooter, GWM). */
  combatToggles?: {
    sharpshooter?: boolean;
    greatWeaponMaster?: boolean;
  };
};

export type LevelHistoryEntry = {
  at: string;
  totalLevel: number;
  /** e.g. "Fighter 4→5" or "Multiclass: Wizard 1" */
  classGain: string;
  hpGain: number;
  subclass?: string;
  feat?: string;
  /** ASI taken instead of a feat at this level. */
  asi?: AsiChoice;
};

export type PactMagicPool = {
  max: number;
  used: number;
  slotLevel: number;
};

export type ParsedCharacterNotes = {
  sessionNotes: string;
  personality: PersonalityFields;
  meta: CharacterSheetMeta;
};

const PERSONALITY_MARKER = "\n\n---loreforge-personality-v1---\n";
const META_MARKER = "\n\n---loreforge-sheet-meta-v1---\n";

export const EMPTY_PERSONALITY: PersonalityFields = {
  traits: "",
  ideals: "",
  bonds: "",
  flaws: "",
};

export const EMPTY_CURRENCY: Currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

export const EMPTY_CHARACTERISTICS: Characteristics = {
  alignment: "",
  gender: "",
  eyeColor: "",
  size: "Medium",
  height: "",
  faith: "",
  hairColor: "",
  skinColor: "",
  age: "",
  weight: "",
};

export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: "organizations", name: "Organizations", entries: [] },
  { id: "allies", name: "Allies", entries: [] },
  { id: "enemies", name: "Enemies", entries: [] },
];

export function parseCharacterNotes(raw: string): ParsedCharacterNotes {
  let body = raw;
  let meta: CharacterSheetMeta = {};

  const metaIdx = body.indexOf(META_MARKER);
  if (metaIdx >= 0) {
    try {
      meta = JSON.parse(body.slice(metaIdx + META_MARKER.length)) as CharacterSheetMeta;
    } catch {
      meta = {};
    }
    body = body.slice(0, metaIdx);
  }

  const persIdx = body.indexOf(PERSONALITY_MARKER);
  let sessionNotes = body.trim();
  let personality = { ...EMPTY_PERSONALITY };

  if (persIdx >= 0) {
    sessionNotes = body.slice(0, persIdx).trim();
    try {
      const parsed = JSON.parse(
        body.slice(persIdx + PERSONALITY_MARKER.length),
      ) as Partial<PersonalityFields>;
      personality = {
        traits: parsed.traits ?? "",
        ideals: parsed.ideals ?? "",
        bonds: parsed.bonds ?? "",
        flaws: parsed.flaws ?? "",
      };
    } catch {
      /* keep empty personality */
    }
  }

  return { sessionNotes, personality, meta };
}

export function serializeCharacterNotes(
  sessionNotes: string,
  personality: PersonalityFields,
  meta: CharacterSheetMeta,
): string {
  const parts: string[] = [sessionNotes.trim()];

  const hasPersonality = (Object.values(personality) as string[]).some((v) =>
    v.trim(),
  );
  if (hasPersonality) {
    parts.push(`${PERSONALITY_MARKER}${JSON.stringify(personality)}`);
  }

  const hasMeta = Object.keys(meta).length > 0;
  if (hasMeta) {
    parts.push(`${META_MARKER}${JSON.stringify(meta)}`);
  }

  return parts.filter(Boolean).join("");
}

/** Patch meta while preserving session notes + personality. */
export function patchCharacterMeta(
  raw: string,
  patch: Partial<CharacterSheetMeta>,
): string {
  const parsed = parseCharacterNotes(raw);
  return serializeCharacterNotes(parsed.sessionNotes, parsed.personality, {
    ...parsed.meta,
    ...patch,
  });
}

export function patchPersonalityFields(
  raw: string,
  patch: Partial<PersonalityFields>,
): string {
  const parsed = parseCharacterNotes(raw);
  return serializeCharacterNotes(
    parsed.sessionNotes,
    { ...parsed.personality, ...patch },
    parsed.meta,
  );
}

export function patchSessionNotes(raw: string, sessionNotes: string): string {
  const parsed = parseCharacterNotes(raw);
  return serializeCharacterNotes(sessionNotes, parsed.personality, parsed.meta);
}
