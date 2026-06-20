/**
 * Declarative 5E spell schema — the subset of `docs/engine/architecture.md` §7.2
 * that covers cleanly-declarative spells (pure damage / healing / save-or-attack)
 * without depending on subsystems that aren't built yet (the Effect system,
 * condition registry, and the imperative `onCast` escape hatch all arrive in
 * E2+). Homebrew spells authored in the Smithy (#8) are stored and validated
 * against this shape so they are engine-consumable once resolution lands.
 *
 * Like `content/items.ts`, this module is the single source of truth for the
 * taxonomy constants shared by the DB/zod/UI, plus a pure structural validator.
 * It holds no engine state and no randomness.
 *
 * @see docs/engine/architecture.md §7
 */
import { parseDice } from "../rng/dice";
import type { Ability } from "../entities/types";
import { ABILITIES } from "../entities/types";

/** Spell levels: 0 (cantrip) through 9. */
export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SpellLevel = (typeof SPELL_LEVELS)[number];

/** The eight schools of magic. */
export const SPELL_SCHOOLS = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
] as const;
export type SpellSchool = (typeof SPELL_SCHOOLS)[number];

/** SRD damage types. */
export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Units a casting time can be expressed in. */
export const CASTING_TIME_UNITS = [
  "action",
  "bonus",
  "reaction",
  "minute",
  "hour",
] as const;
export type CastingTimeUnit = (typeof CASTING_TIME_UNITS)[number];

/** Range categories. `feet`/`miles` require an `amount`. */
export const RANGE_TYPES = [
  "self",
  "touch",
  "feet",
  "miles",
  "sight",
  "unlimited",
] as const;
export type RangeType = (typeof RANGE_TYPES)[number];

/** Area-of-effect shapes. Each carries a `size` in feet. */
export const AREA_SHAPES = [
  "sphere",
  "cube",
  "cone",
  "line",
  "cylinder",
] as const;
export type AreaShape = (typeof AREA_SHAPES)[number];

/** How a spell selects its targets. */
export const TARGETING_TYPES = ["single", "multi", "area", "self"] as const;
export type TargetingType = (typeof TARGETING_TYPES)[number];

/** What happens on a successful save. */
export const SAVE_OUTCOMES = ["half_damage", "no_effect", "partial"] as const;
export type SaveOutcome = (typeof SAVE_OUTCOMES)[number];

/** Duration units. Ongoing/while-concentrating spells use `concentration`. */
export const DURATION_UNITS = [
  "instantaneous",
  "round",
  "minute",
  "hour",
  "day",
  "until_dispelled",
  "special",
] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

/** A single damage component (a spell may roll several, e.g. Ice Knife). */
export type DamageComponent = {
  /** Dice notation, e.g. `8d6`. Validated via the engine dice parser. */
  dice: string;
  type: DamageType;
};

/** Healing component (HP restored). */
export type HealingComponent = {
  /** Dice notation, e.g. `1d8`. */
  dice: string;
};

export type CastingTime = {
  unit: CastingTimeUnit;
  amount: number;
};

export type SpellRange = {
  type: RangeType;
  /** Required when `type` is `feet` or `miles`. */
  amount?: number;
  area?: { shape: AreaShape; size: number };
};

export type SpellComponents = {
  verbal: boolean;
  somatic: boolean;
  /** Material component description (presence implies a material component). */
  material?: string;
};

export type SpellDuration = {
  unit: DurationUnit;
  /** Required for round/minute/hour/day. */
  amount?: number;
};

export type SaveAgainst = {
  ability: Ability;
  /** `"spellsave"` resolves to the caster's spell save DC at cast time. */
  dc: "spellsave" | number;
  onSuccess: SaveOutcome;
};

export type SpellAttack = {
  type: "melee" | "ranged";
};

/**
 * Declarative per-slot scaling: extra damage/healing dice added per slot level
 * above the spell's base level. The imperative `custom` handler variant from the
 * arch doc is intentionally out of scope here (no escape hatch yet).
 */
export type UpcastScaling = {
  /** Dice added per slot above base, e.g. `1d6`. */
  perSlotDice: string;
  /** Which roll the extra dice apply to. */
  appliesTo: "damage" | "healing";
};

/**
 * Declarative spell definition (subset). Condition/effect application and
 * imperative handlers (`onCast`, summoning, transformation) are deferred to the
 * Effect system in E2+; author those nuances in `description` for now.
 */
export type SpellDefinition = {
  id: string;
  name: string;
  level: SpellLevel;
  school: SpellSchool;
  classes: string[];
  castingTime: CastingTime;
  range: SpellRange;
  components: SpellComponents;
  duration: SpellDuration;
  concentration: boolean;
  ritual: boolean;
  targeting: TargetingType;
  saveAgainst?: SaveAgainst;
  attackAgainst?: SpellAttack;
  damage?: DamageComponent[];
  healing?: HealingComponent;
  upcastScaling?: UpcastScaling;
  description: string;
};

function isValidDice(notation: unknown): boolean {
  if (typeof notation !== "string") return false;
  try {
    parseDice(notation);
    return true;
  } catch {
    return false;
  }
}

/**
 * Structural + semantic validation of a declarative {@link SpellDefinition}.
 * Returns the list of human-readable problems; an empty array means valid.
 *
 * This is the authoritative shape gate — the Smithy API runs assembled
 * definitions through it before persisting so stored homebrew spells always
 * satisfy the engine contract. Wire-level field/enum checks are handled by the
 * router's zod; this layer owns the cross-field rules zod is awkward at.
 */
export function validateSpellDefinition(def: SpellDefinition): string[] {
  const errors: string[] = [];

  if (!def.name?.trim()) errors.push("Name is required.");
  if (!(SPELL_LEVELS as readonly number[]).includes(def.level)) {
    errors.push("Level must be 0–9.");
  }
  if (!(SPELL_SCHOOLS as readonly string[]).includes(def.school)) {
    errors.push("Unknown school of magic.");
  }
  if (def.castingTime.amount < 1) {
    errors.push("Casting time amount must be at least 1.");
  }

  // Range: feet/miles need a positive distance; an area needs a positive size.
  if (
    (def.range.type === "feet" || def.range.type === "miles") &&
    !(def.range.amount && def.range.amount > 0)
  ) {
    errors.push(`Range of type "${def.range.type}" needs a distance.`);
  }
  if (def.range.area && def.range.area.size <= 0) {
    errors.push("Area size must be positive.");
  }

  // Duration: timed units need an amount.
  if (
    (["round", "minute", "hour", "day"] as DurationUnit[]).includes(
      def.duration.unit,
    ) &&
    !(def.duration.amount && def.duration.amount > 0)
  ) {
    errors.push(`Duration of "${def.duration.unit}" needs an amount.`);
  }

  // A spell resolves via a save OR an attack roll, not both.
  if (def.saveAgainst && def.attackAgainst) {
    errors.push("A spell cannot use both a saving throw and an attack roll.");
  }
  if (def.saveAgainst && !ABILITIES.includes(def.saveAgainst.ability)) {
    errors.push("Save ability must be a valid ability score.");
  }
  if (
    def.saveAgainst &&
    typeof def.saveAgainst.dc === "number" &&
    def.saveAgainst.dc < 1
  ) {
    errors.push("Fixed save DC must be positive.");
  }

  // Damage / healing dice must parse.
  def.damage?.forEach((d, i) => {
    if (!isValidDice(d.dice)) {
      errors.push(`Damage component ${i + 1} has invalid dice "${d.dice}".`);
    }
    if (!(DAMAGE_TYPES as readonly string[]).includes(d.type)) {
      errors.push(`Damage component ${i + 1} has an unknown damage type.`);
    }
  });
  if (def.healing && !isValidDice(def.healing.dice)) {
    errors.push(`Healing has invalid dice "${def.healing.dice}".`);
  }

  // Upcast scaling: only level 1+ spells use a spell slot to upcast.
  if (def.upcastScaling) {
    if (def.level === 0) {
      errors.push("Cantrips cannot have slot-based upcast scaling.");
    }
    if (!isValidDice(def.upcastScaling.perSlotDice)) {
      errors.push(
        `Upcast scaling has invalid dice "${def.upcastScaling.perSlotDice}".`,
      );
    }
  }

  return errors;
}

/** Convenience boolean form of {@link validateSpellDefinition}. */
export function isValidSpellDefinition(def: SpellDefinition): boolean {
  return validateSpellDefinition(def).length === 0;
}
