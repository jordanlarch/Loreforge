/**
 * Browser-safe sheet → combat loadout helpers (#98).
 *
 * The live `EntityState` carries no equipment or spell list, so the play surface
 * fetches the campaign's character sheets (`campaigns.partyLoadout`) and derives
 * each combatant's weapons / castable spells / quick-use items here — keyed by
 * the live entity id (= the character row id the WS server seeds). The
 * deterministic engine still resolves every attack/cast; these pure helpers only
 * build the *menu* of options and compose the command the client submits.
 *
 * Weapon attack/damage are combined from a small SRD weapon catalog (dice +
 * properties) and the *live* entity's ability mods + proficiency, so they track
 * engine state. Falls back to the generic Strike when no weapon is equipped.
 */
import {
  abilityModifier,
  activeCombatAdjustments,
  aggregateFightingStyleModifiers,
  extraAttackCount,
  type ClassLevel,
  type CombatFeatToggles,
  type EntityState,
} from "@app/engine";

import type { EquipmentItem, SpellLoadout } from "./character";
import {
  CASTABLE_SPELLS,
  deriveStrike,
  MELEE_REACH_FT,
  type CastableSpell,
  type Damage,
} from "./live-combat";

/** A resolved weapon option the action bar / HUD can fire through the engine. */
export type WeaponAttack = {
  /** Stable id for React keys + the armed-action selector. */
  id: string;
  /** Display label, e.g. "Longsword +5 · 1d8+3". */
  label: string;
  attackBonus: number;
  damage: Damage;
  /** Effective reach/range in feet (drives the map target picker). */
  rangeFt: number;
};

type WeaponSpec = {
  dice: string;
  damageType: string;
  /** Use the better of STR/DEX for attack + damage. */
  finesse?: boolean;
  /** Ranged weapon: uses DEX and the listed range. */
  ranged?: boolean;
  /** Override reach/range in feet (defaults: melee 5, ranged per-weapon). */
  rangeFt?: number;
};

/**
 * A pragmatic slice of the SRD weapon table (#98). Keys are normalized weapon
 * names; magic prefixes ("+1") and adjectives ("Flametongue Longsword") still
 * match via substring. Proficiency is assumed for an equipped weapon at this
 * tracer depth; the full weapon table + proficiency checks are deferred.
 */
export const WEAPON_CATALOG: Record<string, WeaponSpec> = {
  club: { dice: "1d4", damageType: "bludgeoning" },
  dagger: { dice: "1d4", damageType: "piercing", finesse: true },
  handaxe: { dice: "1d6", damageType: "slashing" },
  mace: { dice: "1d6", damageType: "bludgeoning" },
  quarterstaff: { dice: "1d6", damageType: "bludgeoning" },
  spear: { dice: "1d6", damageType: "piercing" },
  shortsword: { dice: "1d6", damageType: "piercing", finesse: true },
  scimitar: { dice: "1d6", damageType: "slashing", finesse: true },
  rapier: { dice: "1d8", damageType: "piercing", finesse: true },
  longsword: { dice: "1d8", damageType: "slashing" },
  battleaxe: { dice: "1d8", damageType: "slashing" },
  warhammer: { dice: "1d8", damageType: "bludgeoning" },
  morningstar: { dice: "1d8", damageType: "piercing" },
  glaive: { dice: "1d10", damageType: "slashing", rangeFt: 10 },
  halberd: { dice: "1d10", damageType: "slashing", rangeFt: 10 },
  greataxe: { dice: "1d12", damageType: "slashing" },
  greatsword: { dice: "2d6", damageType: "slashing" },
  maul: { dice: "2d6", damageType: "bludgeoning" },
  sling: { dice: "1d4", damageType: "bludgeoning", ranged: true, rangeFt: 30 },
  shortbow: { dice: "1d6", damageType: "piercing", ranged: true, rangeFt: 80 },
  longbow: { dice: "1d8", damageType: "piercing", ranged: true, rangeFt: 150 },
  "light crossbow": {
    dice: "1d8",
    damageType: "piercing",
    ranged: true,
    rangeFt: 80,
  },
  "hand crossbow": {
    dice: "1d6",
    damageType: "piercing",
    ranged: true,
    rangeFt: 30,
  },
  "heavy crossbow": {
    dice: "1d10",
    damageType: "piercing",
    ranged: true,
    rangeFt: 100,
  },
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+\d+/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match an item name to a catalog weapon (exact, then substring). */
export function matchWeapon(name: string): WeaponSpec | undefined {
  const norm = normalize(name);
  if (!norm) return undefined;
  if (WEAPON_CATALOG[norm]) return WEAPON_CATALOG[norm];
  for (const [key, spec] of Object.entries(WEAPON_CATALOG)) {
    if (norm.includes(key)) return spec;
  }
  return undefined;
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** The attack ability modifier for a weapon spec given the entity's scores. */
function weaponAbilityMod(entity: EntityState, spec: WeaponSpec): number {
  const str = abilityModifier(entity.abilityScores.str);
  const dex = abilityModifier(entity.abilityScores.dex);
  if (spec.ranged) return dex;
  if (spec.finesse) return Math.max(str, dex);
  return str;
}

/** Resolve one equipped weapon into a fireable {@link WeaponAttack}. */
function resolveWeapon(
  entity: EntityState,
  name: string,
  spec: WeaponSpec,
): WeaponAttack {
  const mod = weaponAbilityMod(entity, spec);
  const attackBonus = entity.proficiencyBonus + mod;
  const notation = mod !== 0 ? `${spec.dice}${fmtMod(mod)}` : spec.dice;
  const rangeFt = spec.rangeFt ?? (spec.ranged ? 80 : MELEE_REACH_FT);
  return {
    id: normalize(name) || "weapon",
    label: `${name.trim()} ${fmtMod(attackBonus)} · ${notation}`,
    attackBonus,
    damage: { notation, type: spec.damageType },
    rangeFt,
  };
}

const TWO_HANDED = new Set([
  "greataxe",
  "greatsword",
  "glaive",
  "halberd",
  "maul",
]);

const ARMOR_RE =
  /armor|mail|plate|leather|scale|chain|studded|splint|hide|shield/i;

/** Whether equipped gear suggests the character is wearing armor (Defense style). */
export function equipmentHasArmor(
  equipment: readonly EquipmentItem[],
): boolean {
  return equipment.some(
    (e) => e.equipped && (e.quantity ?? 0) > 0 && ARMOR_RE.test(e.name),
  );
}

function appendDamageMod(notation: string, bonus: number): string {
  if (bonus === 0) return notation;
  const m = notation.match(/^(\d+d\d+)([+-]\d+)?$/);
  if (!m) return notation;
  const mod = (m[2] ? parseInt(m[2], 10) : 0) + bonus;
  return mod !== 0 ? `${m[1]}${mod >= 0 ? `+${mod}` : mod}` : m[1]!;
}

function isOneHandedMeleeWeapon(name: string, spec: WeaponSpec): boolean {
  if (spec.ranged) return false;
  const norm = normalize(name);
  for (const key of TWO_HANDED) {
    if (norm.includes(key)) return false;
  }
  return true;
}

function isHeavyMeleeWeapon(name: string, spec: WeaponSpec): boolean {
  if (spec.ranged) return false;
  const norm = normalize(name);
  for (const key of TWO_HANDED) {
    if (norm.includes(key)) return true;
  }
  return false;
}

/**
 * Sheet Combat tab attacks: fighting-style modifiers + Extra Attack rows.
 */
export function deriveSheetCombatAttacks(
  entity: EntityState,
  equipment: readonly EquipmentItem[],
  classes: ClassLevel[],
  fightingStyles?: Record<string, string>,
  opts?: {
    feats?: string[];
    combatToggles?: CombatFeatToggles;
  },
): WeaponAttack[] {
  const base = deriveWeaponAttacks(entity, equipment);
  const wearingArmor =
    equipmentHasArmor(equipment) ||
    entity.baseAc > 12 + abilityModifier(entity.abilityScores.dex);
  const attackCount = extraAttackCount(classes);

  return base.flatMap((attack) => {
    const spec = matchWeapon(attack.label.split(" · ")[0] ?? "");
    const weaponContext = {
      wearingArmor,
      oneHandedMelee: spec
        ? isOneHandedMeleeWeapon(attack.label.split(" · ")[0] ?? "", spec)
        : false,
      ranged: spec?.ranged ?? false,
    };
    const style = aggregateFightingStyleModifiers(
      classes,
      fightingStyles,
      weaponContext,
    );
    const weaponNameRaw = attack.label.split(" · ")[0] ?? "";
    const featAdj = activeCombatAdjustments(
      opts?.feats,
      opts?.combatToggles,
      {
        ranged: weaponContext.ranged,
        melee: !weaponContext.ranged,
        heavyMelee: spec
          ? isHeavyMeleeWeapon(weaponNameRaw, spec)
          : false,
      },
    );
    const modified: WeaponAttack = {
      ...attack,
      attackBonus:
        attack.attackBonus + style.rangedAttackBonus + featAdj.attackBonus,
      damage: {
        ...attack.damage,
        notation: appendDamageMod(
          appendDamageMod(attack.damage.notation, style.meleeDamageBonus),
          featAdj.damageBonus,
        ),
      },
    };
    const weaponName = modified.label.split(" · ")[0] ?? "Attack";
    return Array.from({ length: attackCount }, (_, i) => ({
      ...modified,
      id: `${attack.id}-extra-${i}`,
      label:
        attackCount > 1
          ? modified.label.replace(
              weaponName,
              `${weaponName} (${i + 1}/${attackCount})`,
            )
          : modified.label,
    }));
  });
}

/** The generic Strike, shaped as a {@link WeaponAttack} (no weapon equipped). */
export function genericStrike(entity: EntityState): WeaponAttack {
  const strike = deriveStrike(entity);
  return {
    id: "strike",
    label: strike.label,
    attackBonus: strike.attackBonus,
    damage: strike.damage,
    rangeFt: MELEE_REACH_FT,
  };
}

/**
 * The weapon attacks an entity can make, derived from its *equipped* equipment
 * matched against {@link WEAPON_CATALOG}. Falls back to a single generic Strike
 * when nothing equipped is a recognized weapon, so combat always has an action.
 * De-duplicated by resolved weapon id.
 */
export function deriveWeaponAttacks(
  entity: EntityState,
  equipment: readonly EquipmentItem[],
): WeaponAttack[] {
  const attacks: WeaponAttack[] = [];
  const seen = new Set<string>();
  for (const item of equipment) {
    if (!item.equipped || (item.quantity ?? 0) <= 0) continue;
    const spec = matchWeapon(item.name);
    if (!spec) continue;
    const attack = resolveWeapon(entity, item.name, spec);
    if (seen.has(attack.id)) continue;
    seen.add(attack.id);
    attacks.push(attack);
  }
  return attacks.length > 0 ? attacks : [genericStrike(entity)];
}

/**
 * The names of spells a character has available to cast: cantrips, prepared, and
 * always-prepared. Known-but-unprepared leveled spells are excluded (can't be
 * cast without preparing).
 */
export function preparedSpellNames(spells: SpellLoadout): string[] {
  return spells.spells
    .filter((s) => s.level === 0 || s.prepared || s.alwaysPrepared)
    .map((s) => s.name);
}

/**
 * The engine-castable single-target spells from a character's available list:
 * the intersection of the sheet's spells with the curated registry subset the
 * map target picker supports ({@link CASTABLE_SPELLS}), gated by the live
 * entity's spellcasting + free slots (cantrips always; leveled needs a slot).
 */
export function sheetCastableSpells(
  entity: EntityState,
  spellNames: readonly string[],
): CastableSpell[] {
  if (!entity.spellcasting) return [];
  const known = new Set(spellNames.map((n) => n.trim().toLowerCase()));
  const slots = entity.spellcasting.slots;
  return CASTABLE_SPELLS.filter((spell) => {
    if (spell.reaction) return false;
    if (!known.has(spell.name.toLowerCase())) return false;
    if (spell.level === 0) return true;
    const slot = slots[spell.level];
    return slot !== undefined && slot.current > 0;
  });
}

/** Prepared reaction spells (Shield) when a reaction and slot are available. */
export function sheetReactionSpells(
  entity: EntityState,
  spellNames: readonly string[],
): CastableSpell[] {
  if (!entity.spellcasting || entity.reaction !== "available") return [];
  const known = new Set(spellNames.map((n) => n.trim().toLowerCase()));
  const slots = entity.spellcasting.slots;
  return CASTABLE_SPELLS.filter((spell) => {
    if (!spell.reaction || !known.has(spell.name.toLowerCase())) return false;
    if (spell.level === 0) return true;
    const slot = slots[spell.level];
    return slot !== undefined && slot.current > 0;
  });
}

const CONSUMABLE_RE = /potion|elixir|oil|antitoxin|tonic|draught|scroll|flask/i;

/** Quick-use consumables from the sheet (potions, scrolls, …) with a count. */
export function quickUseItems(
  equipment: readonly EquipmentItem[],
): { name: string; quantity: number }[] {
  const items: { name: string; quantity: number }[] = [];
  const seen = new Set<string>();
  for (const item of equipment) {
    if ((item.quantity ?? 0) <= 0) continue;
    if (!CONSUMABLE_RE.test(item.name)) continue;
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: item.name.trim(), quantity: item.quantity });
    if (items.length >= 6) break;
  }
  return items;
}
