/**
 * Concise SRD tooltip copy for character creation and the character sheet.
 * Full rules live in the Codex (future deep links).
 */
import type { Ability } from "@app/engine";
import { SKILL_ABILITY, type Skill } from "@app/engine";

export const ABILITY_TOOLTIPS: Record<
  Ability,
  { title: string; body: string }
> = {
  str: {
    title: "Strength",
    body: "Physical power — melee attack and damage, Athletics, and carrying capacity.",
  },
  dex: {
    title: "Dexterity",
    body: "Agility and reflexes — AC (with light armor), initiative, Dex saves, and Acrobatics / Sleight of Hand / Stealth.",
  },
  con: {
    title: "Constitution",
    body: "Endurance and vitality — hit points per level and Constitution saving throws.",
  },
  int: {
    title: "Intelligence",
    body: "Reason and memory — wizard spellcasting and Arcana / History / Investigation / Nature / Religion.",
  },
  wis: {
    title: "Wisdom",
    body: "Awareness and willpower — cleric/druid/ranger spellcasting, Perception, and Animal Handling / Insight / Medicine / Survival.",
  },
  cha: {
    title: "Charisma",
    body: "Force of personality — bard/sorcerer/warlock spellcasting and Deception / Intimidation / Performance / Persuasion.",
  },
};

const SKILL_TOOLTIPS: Partial<Record<Skill, string>> = {
  Athletics:
    "Strength (Athletics) — climb, jump, swim, grapple, and shove in combat.",
  Acrobatics:
    "Dexterity (Acrobatics) — stay on your feet, tumble, and escape grapples.",
  Stealth: "Dexterity (Stealth) — hide and move quietly.",
  Perception:
    "Wisdom (Perception) — notice hidden creatures, objects, and details.",
  Investigation:
    "Intelligence (Investigation) — deduce clues and search for hidden information.",
  Insight:
    "Wisdom (Insight) — read motives and tell when someone is lying.",
  Persuasion:
    "Charisma (Persuasion) — influence others with tact and social grace.",
  "Animal Handling":
    "Wisdom (Animal Handling) — calm or train animals and judge their intent.",
  Arcana:
    "Intelligence (Arcana) — recall lore about spells, magic items, and planes.",
  History:
    "Intelligence (History) — recall lore about people, wars, and ancient events.",
  Medicine: "Wisdom (Medicine) — stabilize dying creatures and diagnose illness.",
  Nature:
    "Intelligence (Nature) — recall lore about terrain, plants, animals, and weather.",
  Religion:
    "Intelligence (Religion) — recall lore about deities, rites, and holy symbols.",
  Deception:
    "Charisma (Deception) — conceal the truth through misdirection or lies.",
  Intimidation:
    "Charisma (Intimidation) — coerce others through threats and shows of force.",
  Performance:
    "Charisma (Performance) — entertain an audience with music, dance, or oratory.",
  "Sleight of Hand":
    "Dexterity (Sleight of Hand) — pick pockets, palm objects, and perform legerdemain.",
  Survival:
    "Wisdom (Survival) — track quarry, forage, navigate wilderness, and predict weather.",
};

export function skillTooltip(skill: string): {
  title: string;
  body: string;
} {
  const ability = (SKILL_ABILITY as Record<string, Ability | undefined>)[skill];
  const body =
    SKILL_TOOLTIPS[skill as Skill] ??
    (ability
      ? `${ABILITY_TOOLTIPS[ability].title} (${skill}) — d20 + ability mod (+ proficiency if proficient).`
      : `${skill} — d20 + relevant ability modifier (+ proficiency if proficient).`);
  return { title: skill, body };
}

export function abilityTooltip(ability: Ability): {
  title: string;
  body: string;
} {
  return ABILITY_TOOLTIPS[ability];
}
