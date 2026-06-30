/**
 * Interactive class / subclass feature choices for creation and level-up.
 * Keys are stored in character meta `featureChoices: Record<string, string>`.
 */
import { SKILLS, type Skill } from "./character-build";

export type FeatureChoiceKind = "single" | "multi";

export type ClassFeatureChoiceDef = {
  id: string;
  featureName: string;
  label: string;
  hint?: string;
  kind: FeatureChoiceKind;
  choose: number;
  options: readonly string[];
  /** Only show when the character's subclass at this level matches. */
  subclass?: string;
  /** Hide fighting-style picker unless this path is selected (Paladin/Ranger L2). */
  requiresPath?: string;
};

/** Common SRD languages for Deft Explorer and similar picks. */
export const SRD_LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
] as const;

const BARBARIAN_PRIMAL_SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Athletics",
  "History",
  "Intimidation",
  "Nature",
  "Perception",
  "Stealth",
  "Survival",
] as const satisfies readonly Skill[];

const CHOICE_DEFS: ClassFeatureChoiceDef[] = [
  {
    id: "divine-order",
    featureName: "Divine Order",
    label: "Divine Order",
    hint: "Protector grants martial training; Thaumaturge grants an extra cantrip and Arcana/Religion expertise.",
    kind: "single",
    choose: 1,
    options: ["Protector", "Thaumaturge"],
  },
  {
    id: "primal-order",
    featureName: "Primal Order",
    label: "Primal Order",
    hint: "Magician adds a cantrip and Arcana/Nature expertise; Warden grants martial weapons and Medium armor.",
    kind: "single",
    choose: 1,
    options: ["Magician", "Warden"],
  },
  {
    id: "paladin-calling",
    featureName: "Fighting Style",
    label: "Fighting Style or Blessed Warrior",
    hint: "Blessed Warrior grants two Cleric cantrips instead of a Fighting Style feat.",
    kind: "single",
    choose: 1,
    options: ["Fighting Style", "Blessed Warrior"],
  },
  {
    id: "ranger-calling",
    featureName: "Fighting Style",
    label: "Fighting Style or Druidic Warrior",
    hint: "Druidic Warrior grants two Druid cantrips instead of a Fighting Style feat.",
    kind: "single",
    choose: 1,
    options: ["Fighting Style", "Druidic Warrior"],
  },
  {
    id: "deft-explorer-expertise",
    featureName: "Deft Explorer",
    label: "Deft Explorer — Expertise skill",
    hint: "Choose one skill that lacks Expertise.",
    kind: "single",
    choose: 1,
    options: SKILLS,
  },
  {
    id: "deft-explorer-languages",
    featureName: "Deft Explorer",
    label: "Deft Explorer — Languages",
    hint: "Learn two languages of your choice.",
    kind: "multi",
    choose: 2,
    options: SRD_LANGUAGES,
  },
  {
    id: "primal-knowledge-skill",
    featureName: "Primal Knowledge",
    label: "Primal Knowledge — extra skill",
    kind: "single",
    choose: 1,
    options: BARBARIAN_PRIMAL_SKILLS,
  },
  {
    id: "blessed-strikes",
    featureName: "Blessed Strikes",
    label: "Blessed Strikes",
    kind: "single",
    choose: 1,
    options: ["Divine Strike", "Potent Spellcasting"],
  },
  {
    id: "elemental-fury",
    featureName: "Elemental Fury",
    label: "Elemental Fury",
    kind: "single",
    choose: 1,
    options: ["Potent Spellcasting", "Primal Strike"],
  },
  {
    id: "land-terrain",
    featureName: "Circle of the Land Spells",
    label: "Land terrain",
    hint: "Terrain determines your always-prepared Circle spells.",
    subclass: "Circle of the Land",
    kind: "single",
    choose: 1,
    options: [
      "Arctic",
      "Coast",
      "Desert",
      "Forest",
      "Grassland",
      "Mountain",
      "Swamp",
      "Underdark",
    ],
  },
  {
    id: "lore-bonus-skills",
    featureName: "Bonus Proficiencies",
    label: "Bonus Proficiencies — skills",
    hint: "Gain proficiency with three skills of your choice.",
    subclass: "College of Lore",
    kind: "multi",
    choose: 3,
    options: SKILLS,
  },
];

/** Registry keyed by `${ClassName}:${level}:${choiceId}`. */
const CHOICES_BY_LEVEL: Record<string, ClassFeatureChoiceDef[]> = {
  "Cleric:1": [CHOICE_DEFS[0]!],
  "Druid:1": [CHOICE_DEFS[1]!],
  "Paladin:2": [CHOICE_DEFS[2]!],
  "Ranger:2": [CHOICE_DEFS[3]!, CHOICE_DEFS[4]!, CHOICE_DEFS[5]!],
  "Barbarian:3": [CHOICE_DEFS[6]!],
  "Cleric:7": [CHOICE_DEFS[7]!],
  "Druid:7": [CHOICE_DEFS[8]!],
  "Any:3": [CHOICE_DEFS[9]!, CHOICE_DEFS[10]!],
};

export function featureChoiceStorageKey(
  className: string,
  level: number,
  choiceId: string,
): string {
  return `${className}:${level}:${choiceId}`;
}

export function parseFeatureChoiceValues(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatFeatureChoiceValues(values: readonly string[]): string {
  return values.join(", ");
}

/** Choices that apply at exactly this class level. */
export function classFeatureChoicesForLevel(
  className: string,
  level: number,
  subclass?: string,
): ClassFeatureChoiceDef[] {
  const direct = CHOICES_BY_LEVEL[`${className}:${level}`] ?? [];
  const subclassLevel = level === 3 ? (CHOICES_BY_LEVEL["Any:3"] ?? []) : [];
  const all = [...direct, ...subclassLevel];
  if (!subclass?.trim()) {
    return all.filter((c) => !c.subclass);
  }
  const sub = subclass.trim();
  return all.filter((c) => !c.subclass || c.subclass === sub);
}

export function readFeatureChoice(
  choices: Record<string, string>,
  className: string,
  level: number,
  def: ClassFeatureChoiceDef,
): string[] {
  const key = featureChoiceStorageKey(className, level, def.id);
  return parseFeatureChoiceValues(choices[key]);
}

export function writeFeatureChoice(
  choices: Record<string, string>,
  className: string,
  level: number,
  def: ClassFeatureChoiceDef,
  values: readonly string[],
): Record<string, string> {
  const key = featureChoiceStorageKey(className, level, def.id);
  const next = { ...choices };
  const formatted = formatFeatureChoiceValues(values);
  if (!formatted) delete next[key];
  else next[key] = formatted;
  return next;
}

export function isFeatureChoiceComplete(
  choices: Record<string, string>,
  className: string,
  level: number,
  def: ClassFeatureChoiceDef,
): boolean {
  const selected = readFeatureChoice(choices, className, level, def);
  if (selected.length !== def.choose) return false;
  if (def.kind === "multi" && new Set(selected).size !== selected.length) {
    return false;
  }
  return selected.every((v) => def.options.includes(v));
}

/** Whether every required feature choice is filled for the given levels. */
export function featureChoicesCompleteForLevels(
  className: string,
  levels: number[],
  choices: Record<string, string>,
  subclassForLevel: (level: number) => string | undefined,
): boolean {
  for (const level of levels) {
    const defs = classFeatureChoicesForLevel(
      className,
      level,
      subclassForLevel(level),
    );
    for (const def of defs) {
      if (!isFeatureChoiceComplete(choices, className, level, def)) {
        return false;
      }
    }
  }
  return true;
}

/** Paladin/Ranger L2: fighting style required only when that path is chosen. */
export function needsFightingStyleForLevel(
  className: string,
  level: number,
  choices: Record<string, string>,
): boolean {
  if (className === "Paladin" && level === 2) {
    const path = readFeatureChoice(choices, className, level, CHOICE_DEFS[2]!);
    return path[0] === "Fighting Style";
  }
  if (className === "Ranger" && level === 2) {
    const path = readFeatureChoice(choices, className, level, CHOICE_DEFS[3]!);
    return path[0] === "Fighting Style";
  }
  return true;
}
