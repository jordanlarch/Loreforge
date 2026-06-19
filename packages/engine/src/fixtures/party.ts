/**
 * Fixture party + campaign.
 *
 * Drives the read-only character sheet and serves as a tiny end-to-end smoke of
 * the engine: scenes and entities are created through the Command API, so the
 * resulting {@link WorldState} is produced by the real event → projection path
 * rather than hand-built. Replaced by user data once Character Creation (P2)
 * ships.
 */
import { Engine } from "../engine";
import {
  abilityModifier,
  proficiencyBonusForLevel,
  totalLevel,
} from "../entities/abilities";
import type {
  Ability,
  AbilityScores,
  ClassLevel,
} from "../entities/types";
import { ABILITIES } from "../entities/types";
import type { WorldState } from "../projections/world-state";

/**
 * Structural input {@link buildCharacterSheet} needs to derive a presentation
 * sheet. Both the in-repo fixtures and persisted DB rows satisfy this shape, so
 * the same engine-owned derivation path serves fixtures and real characters.
 */
export type CharacterSheetInput = {
  id: string;
  name: string;
  species: string;
  background: string;
  classes: ClassLevel[];
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
  saveProficiencies: Ability[];
  skillProficiencies: string[];
};

export type FixtureCharacter = CharacterSheetInput;

export const FIXTURE_CHARACTERS: FixtureCharacter[] = [
  {
    id: "pc:thorin",
    name: "Thorin Ironfist",
    species: "Hill Dwarf",
    background: "Soldier",
    classes: [{ class: "Fighter", level: 5, subclass: "Battle Master" }],
    abilityScores: { str: 17, dex: 12, con: 16, int: 9, wis: 11, cha: 8 },
    maxHp: 44,
    baseAc: 18,
    speed: 25,
    saveProficiencies: ["str", "con"],
    skillProficiencies: ["Athletics", "Intimidation", "Survival"],
  },
  {
    id: "pc:elara",
    name: "Elara Moonwhisper",
    species: "Wood Elf",
    background: "Entertainer",
    classes: [{ class: "Bard", level: 3, subclass: "College of Lore" }],
    abilityScores: { str: 8, dex: 16, con: 13, int: 12, wis: 10, cha: 17 },
    maxHp: 21,
    baseAc: 14,
    speed: 35,
    saveProficiencies: ["dex", "cha"],
    skillProficiencies: ["Performance", "Persuasion", "Perception", "Deception"],
  },
];

export type SavingThrow = {
  ability: Ability;
  modifier: number;
  proficient: boolean;
};

export type CharacterSheet = {
  id: string;
  name: string;
  species: string;
  background: string;
  classLine: string;
  level: number;
  proficiencyBonus: number;
  abilityScores: AbilityScores;
  abilityModifiers: Record<Ability, number>;
  hp: { current: number; max: number; temp: number };
  ac: number;
  speed: number;
  initiative: number;
  savingThrows: SavingThrow[];
  skillProficiencies: string[];
};

function classLine(classes: ClassLevel[]): string {
  return classes
    .map((c) => `${c.class}${c.subclass ? ` (${c.subclass})` : ""} ${c.level}`)
    .join(" / ");
}

/** Derive a presentation-ready sheet from character data using engine helpers. */
export function buildCharacterSheet(
  character: CharacterSheetInput,
): CharacterSheet {
  const level = totalLevel(character.classes);
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const abilityModifiers = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(character.abilityScores[a])]),
  ) as Record<Ability, number>;

  const savingThrows: SavingThrow[] = ABILITIES.map((ability) => {
    const proficient = character.saveProficiencies.includes(ability);
    return {
      ability,
      proficient,
      modifier: abilityModifiers[ability] + (proficient ? proficiencyBonus : 0),
    };
  });

  return {
    id: character.id,
    name: character.name,
    species: character.species,
    background: character.background,
    classLine: classLine(character.classes),
    level,
    proficiencyBonus,
    abilityScores: character.abilityScores,
    abilityModifiers,
    hp: { current: character.maxHp, max: character.maxHp, temp: 0 },
    ac: character.baseAc,
    speed: character.speed,
    initiative: abilityModifiers.dex,
    savingThrows,
    skillProficiencies: character.skillProficiencies,
  };
}

/**
 * Build a fixture campaign world state by driving commands through the engine.
 * Proves the event → projection path; useful in tests and demos.
 */
export function buildFixtureCampaign(campaignId = "fixture:test-dungeon"): {
  engine: Engine;
  state: WorldState;
} {
  const engine = new Engine();
  engine.execute(campaignId, {
    type: "create_scene",
    scene: { id: "scene:tavern", name: "The Hearth & Hemlock", description: "A rain-lashed tavern." },
  });
  engine.execute(campaignId, { type: "change_scene", sceneId: "scene:tavern" });

  for (const character of FIXTURE_CHARACTERS) {
    engine.execute(campaignId, {
      type: "create_entity",
      entity: {
        id: character.id,
        kind: "character",
        name: character.name,
        abilityScores: character.abilityScores,
        maxHp: character.maxHp,
        baseAc: character.baseAc,
        speed: character.speed,
        classes: character.classes,
        sceneId: "scene:tavern",
      },
    });
  }

  return { engine, state: engine.getState(campaignId) };
}
