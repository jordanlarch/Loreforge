/**
 * 2024 SRD weapon mastery properties — curated map for equipped weapons on
 * the Combat tab until full Open5e item ingest lands.
 */
import { matchWeapon } from "./sheet-loadout";

export type WeaponMastery = {
  weapon: string;
  property: string;
  description: string;
};

/** Mastery property by normalized weapon catalog key. */
const MASTERY_BY_WEAPON: Record<
  string,
  { property: string; description: string }
> = {
  dagger: {
    property: "Nick",
    description:
      "When you make the extra attack from the Light property, you can make it as part of the Attack action instead of as a Bonus Action.",
  },
  shortsword: {
    property: "Vex",
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
  scimitar: {
    property: "Vex",
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
  rapier: {
    property: "Vex",
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
  longsword: {
    property: "Sap",
    description:
      "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  },
  battleaxe: {
    property: "Topple",
    description:
      "If you hit a creature with this weapon, you can force it to make a Constitution saving throw; on a failed save, it has the Prone condition.",
  },
  warhammer: {
    property: "Push",
    description:
      "If you hit a creature with this weapon, you can push it up to 10 feet away from you.",
  },
  glaive: {
    property: "Graze",
    description:
      "If your attack roll with this weapon misses, you deal damage equal to the ability modifier used for the attack roll.",
  },
  halberd: {
    property: "Cleave",
    description:
      "Once per turn when you hit a creature with this weapon, you can make an attack roll against a second creature within 5 feet of the first.",
  },
  greataxe: {
    property: "Cleave",
    description:
      "Once per turn when you hit a creature with this weapon, you can make an attack roll against a second creature within 5 feet of the first.",
  },
  greatsword: {
    property: "Graze",
    description:
      "If your attack roll with this weapon misses, you deal damage equal to the ability modifier used for the attack roll.",
  },
  maul: {
    property: "Topple",
    description:
      "If you hit a creature with this weapon, you can force it to make a Constitution saving throw; on a failed save, it has the Prone condition.",
  },
  longbow: {
    property: "Slow",
    description:
      "If you hit a creature with this weapon, you can reduce its Speed by 10 feet until the start of your next turn.",
  },
  handaxe: {
    property: "Vex",
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
  lightcrossbow: {
    property: "Slow",
    description:
      "If you hit a creature with this weapon, you can reduce its Speed by 10 feet until the start of your next turn.",
  },
  crossbow: {
    property: "Slow",
    description:
      "If you hit a creature with this weapon, you can reduce its Speed by 10 feet until the start of your next turn.",
  },
  shortbow: {
    property: "Vex",
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
  mace: {
    property: "Sap",
    description:
      "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  },
  morningstar: {
    property: "Sap",
    description:
      "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  },
  spear: {
    property: "Sap",
    description:
      "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  },
  trident: {
    property: "Topple",
    description:
      "If you hit a creature with this weapon, you can force it to make a Constitution saving throw; on a failed save, it has the Prone condition.",
  },
  pike: {
    property: "Push",
    description:
      "If you hit a creature with this weapon, you can push it up to 10 feet away from you.",
  },
  javelin: {
    property: "Slow",
    description:
      "If you hit a creature with this weapon, you can reduce its Speed by 10 feet until the start of your next turn.",
  },
  quarterstaff: {
    property: "Topple",
    description:
      "If you hit a creature with this weapon, you can force it to make a Constitution saving throw; on a failed save, it has the Prone condition.",
  },
};

function catalogKey(name: string): string | undefined {
  const spec = matchWeapon(name);
  if (!spec) return undefined;
  const norm = name
    .toLowerCase()
    .replace(/\+\d+/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const key of Object.keys(MASTERY_BY_WEAPON)) {
    if (norm.includes(key)) return key;
  }
  return undefined;
}

/** Mastery entries for equipped martial/simple weapons we recognize. */
export function weaponMasteriesForEquipment(
  equipment: { name: string; equipped?: boolean; quantity?: number }[],
  codexMasteries?: Record<string, { property: string; description: string }>,
): WeaponMastery[] {
  const out: WeaponMastery[] = [];
  const seen = new Set<string>();
  for (const item of equipment) {
    if (!item.equipped || (item.quantity ?? 0) <= 0) continue;
    const name = item.name.trim();
    const codex = codexMasteries?.[name];
    if (codex) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ weapon: name, property: codex.property, description: codex.description });
      continue;
    }
    const key = catalogKey(item.name);
    if (!key || seen.has(key)) continue;
    const entry = MASTERY_BY_WEAPON[key];
    if (!entry) continue;
    seen.add(key);
    out.push({
      weapon: name,
      property: entry.property,
      description: entry.description,
    });
  }
  return out;
}
