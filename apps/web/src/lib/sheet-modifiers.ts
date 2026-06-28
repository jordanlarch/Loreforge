/**
 * Effective sheet vitals after feat + fighting-style modifiers (CHAR-7).
 */
import {
  aggregateFeatModifiers,
  aggregateFightingStyleModifiers,
  buildCharacterSheet,
  deriveEquippedArmorClass,
  effectiveArmorClass,
  effectiveMaxHpFromFeats,
  type Ability,
  type ClassLevel,
  type ItemDefinition,
} from "@app/engine";

import type { EquipmentItem } from "./character";
import type { CharacterSheetMeta } from "./character-sheet-storage";
import { equipmentHasArmor } from "./sheet-loadout";

type CharacterInput = {
  id: string;
  name: string;
  species: string;
  background: string;
  classes: ClassLevel[];
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  maxHp: number;
  baseAc: number;
  speed: number;
  saveProficiencies: Ability[];
  skillProficiencies: string[];
  equipment?: EquipmentItem[];
};

export function effectiveSheetVitals(
  character: CharacterInput,
  meta: CharacterSheetMeta,
  opts?: { smithyDefinitions?: Readonly<Record<string, ItemDefinition>> },
) {
  const sheet = buildCharacterSheet(character);
  const feats = aggregateFeatModifiers(meta.feats);
  const derived = deriveEquippedArmorClass({
    dexScore: character.abilityScores.dex,
    storedBaseAc: character.baseAc,
    equipment: character.equipment ?? [],
    itemDefinitions: opts?.smithyDefinitions ?? {},
  });
  const baseAcForStyles =
    derived.source === "derived" ? derived.ac : character.baseAc;
  const wearingArmor =
    derived.source === "derived" ||
    equipmentHasArmor(character.equipment ?? []) ||
    character.baseAc > 12 + sheet.abilityModifiers.dex;
  const style = aggregateFightingStyleModifiers(
    character.classes,
    meta.fightingStyles,
    { wearingArmor, oneHandedMelee: false, ranged: false },
  );

  const maxHp = effectiveMaxHpFromFeats(
    character.maxHp,
    meta.feats,
    sheet.level,
  );
  const ac = effectiveArmorClass(baseAcForStyles, style.acBonus);
  const initiative = sheet.initiative + feats.initiativeBonus;
  const speed = sheet.speed + feats.speedBonus;

  return {
    sheet,
    maxHp,
    ac,
    derivedAc: derived,
    initiative,
    speed,
    passivePerceptionBonus: feats.passivePerceptionBonus,
    passiveInvestigationBonus: feats.passiveInvestigationBonus,
  };
}
