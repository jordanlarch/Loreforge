/**
 * SRD feat definitions — passive modifiers + active combat toggles (CHAR-7).
 */
export type FeatPassiveModifiers = {
  initiativeBonus?: number;
  /** +2 max HP per character level (Tough). */
  hpPerLevel?: number;
  speedBonus?: number;
  passivePerceptionBonus?: number;
  passiveInvestigationBonus?: number;
};

export type FeatActiveCombat = {
  /** −5 attack / +10 damage (Sharpshooter, GWM). */
  attackPenalty?: number;
  damageBonus?: number;
};

export type FeatDefinition = {
  id: string;
  name: string;
  passive?: FeatPassiveModifiers;
  activeCombat?: FeatActiveCombat;
};

function norm(name: string): string {
  return name.trim().toLowerCase();
}

export const FEAT_REGISTRY: FeatDefinition[] = [
  {
    id: "alert",
    name: "Alert",
    passive: { initiativeBonus: 5 },
  },
  {
    id: "tough",
    name: "Tough",
    passive: { hpPerLevel: 2 },
  },
  {
    id: "mobile",
    name: "Mobile",
    passive: { speedBonus: 10 },
  },
  {
    id: "observant",
    name: "Observant",
    passive: {
      passivePerceptionBonus: 5,
      passiveInvestigationBonus: 5,
    },
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    activeCombat: { attackPenalty: 5, damageBonus: 10 },
  },
  {
    id: "great-weapon-master",
    name: "Great Weapon Master",
    activeCombat: { attackPenalty: 5, damageBonus: 10 },
  },
  {
    id: "war-caster",
    name: "War Caster",
    passive: {},
  },
  {
    id: "lucky",
    name: "Lucky",
    passive: {},
  },
];

const BY_NORM = new Map(
  FEAT_REGISTRY.flatMap((f) => [
    [norm(f.name), f],
    [f.id, f],
  ]),
);

export function featDefinition(name: string): FeatDefinition | undefined {
  const n = norm(name);
  return BY_NORM.get(n) ?? FEAT_REGISTRY.find((f) => n.includes(f.id));
}

export type AggregatedFeatModifiers = {
  initiativeBonus: number;
  hpPerLevel: number;
  speedBonus: number;
  passivePerceptionBonus: number;
  passiveInvestigationBonus: number;
};

export function aggregateFeatModifiers(
  feats: string[] | undefined,
): AggregatedFeatModifiers {
  const out: AggregatedFeatModifiers = {
    initiativeBonus: 0,
    hpPerLevel: 0,
    speedBonus: 0,
    passivePerceptionBonus: 0,
    passiveInvestigationBonus: 0,
  };
  for (const name of feats ?? []) {
    const def = featDefinition(name);
    if (!def?.passive) continue;
    out.initiativeBonus += def.passive.initiativeBonus ?? 0;
    out.hpPerLevel += def.passive.hpPerLevel ?? 0;
    out.speedBonus += def.passive.speedBonus ?? 0;
    out.passivePerceptionBonus += def.passive.passivePerceptionBonus ?? 0;
    out.passiveInvestigationBonus += def.passive.passiveInvestigationBonus ?? 0;
  }
  return out;
}

export function effectiveMaxHpFromFeats(
  baseMax: number,
  feats: string[] | undefined,
  totalLevel: number,
): number {
  const { hpPerLevel } = aggregateFeatModifiers(feats);
  return baseMax + hpPerLevel * totalLevel;
}

export type CombatFeatToggles = {
  sharpshooter?: boolean;
  greatWeaponMaster?: boolean;
};

export function activeCombatAdjustments(
  feats: string[] | undefined,
  toggles: CombatFeatToggles | undefined,
  opts: { ranged: boolean; melee: boolean; heavyMelee: boolean },
): { attackBonus: number; damageBonus: number } {
  let attackBonus = 0;
  let damageBonus = 0;
  const names = new Set((feats ?? []).map(norm));
  if (
    toggles?.sharpshooter &&
    opts.ranged &&
    (names.has("sharpshooter") || [...names].some((n) => n.includes("sharpshooter")))
  ) {
    attackBonus -= 5;
    damageBonus += 10;
  }
  if (
    toggles?.greatWeaponMaster &&
    opts.heavyMelee &&
    (names.has("great weapon master") ||
      names.has("great-weapon-master") ||
      [...names].some((n) => n.includes("great weapon master")))
  ) {
    attackBonus -= 5;
    damageBonus += 10;
  }
  return { attackBonus, damageBonus };
}
