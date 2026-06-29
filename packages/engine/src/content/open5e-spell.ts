/**
 * Best-effort Open5e v2 raw spell → {@link SpellDefinition} conversion for Codex
 * → Smithy copy (CODEX-2 / SMITH-6). Imperative / edge-case spells may fail
 * validation and require manual Smithy authoring.
 */
import type { Ability } from "../entities/types";
import type {
  AreaShape,
  CastingTimeUnit,
  DamageType,
  DurationUnit,
  RangeType,
  SpellDefinition,
  SpellLevel,
  SpellSchool,
  TargetingType,
} from "./spells";
import {
  AREA_SHAPES,
  CASTING_TIME_UNITS,
  DAMAGE_TYPES,
  DURATION_UNITS,
  RANGE_TYPES,
  SPELL_LEVELS,
  SPELL_SCHOOLS,
} from "./spells";

const OPEN5E_ABILITY: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const CASTING_TIME_MAP: Record<string, CastingTimeUnit> = {
  action: "action",
  bonus_action: "bonus",
  bonus: "bonus",
  reaction: "reaction",
  minute: "minute",
  minutes: "minute",
  hour: "hour",
  hours: "hour",
};

const SHAPE_MAP: Record<string, AreaShape> = {
  sphere: "sphere",
  cube: "cube",
  cone: "cone",
  line: "line",
  cylinder: "cylinder",
  emanation: "emanation",
};

function slugToId(slug: string): string {
  return slug.replace(/\//g, "-").toLowerCase();
}

function clampLevel(value: unknown): SpellLevel {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isInteger(n) && n >= 0 && n <= 9) return n as SpellLevel;
  return 0;
}

function parseSchool(raw: unknown): SpellSchool {
  if (raw && typeof raw === "object" && "key" in raw) {
    const key = String((raw as { key?: string }).key ?? "").toLowerCase();
    if ((SPELL_SCHOOLS as readonly string[]).includes(key)) {
      return key as SpellSchool;
    }
  }
  if (typeof raw === "string") {
    const key = raw.toLowerCase();
    if ((SPELL_SCHOOLS as readonly string[]).includes(key)) {
      return key as SpellSchool;
    }
  }
  return "evocation";
}

function parseClasses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (entry && typeof entry === "object" && "name" in entry) {
        return String((entry as { name?: string }).name ?? "").toLowerCase();
      }
      return typeof entry === "string" ? entry.toLowerCase() : "";
    })
    .filter(Boolean);
}

function parseCastingTime(raw: unknown): SpellDefinition["castingTime"] {
  const key = String(raw ?? "action").toLowerCase().replace(/\s+/g, "_");
  const unit = CASTING_TIME_MAP[key] ?? "action";
  return { unit, amount: 1 };
}

function parseRange(raw: Record<string, unknown>): SpellDefinition["range"] {
  const rangeText = String(raw.range_text ?? "").toLowerCase();
  if (rangeText === "self" || raw.target_type === "self") {
    return { type: "self" };
  }
  if (rangeText === "touch") {
    return { type: "touch" };
  }

  const unit = String(raw.range_unit ?? "feet").toLowerCase();
  const rangeType: RangeType =
    unit === "miles" ? "miles" : unit === "feet" ? "feet" : "feet";
  const amount =
    typeof raw.range === "number" ? raw.range : undefined;

  const shapeKey = String(raw.shape_type ?? "").toLowerCase();
  const shape = SHAPE_MAP[shapeKey];
  const shapeSize =
    typeof raw.shape_size === "number" ? raw.shape_size : undefined;

  if (shape && shapeSize) {
    return {
      type: rangeType,
      amount,
      area: { shape, size: shapeSize },
    };
  }

  if (amount != null && (rangeType === "feet" || rangeType === "miles")) {
    return { type: rangeType, amount };
  }

  return { type: "self" };
}

function parseComponents(raw: Record<string, unknown>): SpellDefinition["components"] {
  const material =
    raw.material === true && typeof raw.material_specified === "string"
      ? raw.material_specified
      : typeof raw.material === "string"
        ? raw.material
        : undefined;
  return {
    verbal: Boolean(raw.verbal),
    somatic: Boolean(raw.somatic),
    material: material?.trim() || undefined,
  };
}

function parseDuration(raw: Record<string, unknown>): SpellDefinition["duration"] {
  const text = String(raw.duration ?? "instantaneous").toLowerCase();
  if (text.includes("instantaneous")) return { unit: "instantaneous" };
  if (text.includes("until dispelled")) return { unit: "until_dispelled" };
  if (text.includes("special")) return { unit: "special" };

  const match = text.match(/(\d+)\s*(round|minute|hour|day)/);
  if (match) {
    const amount = Number(match[1]);
    const unitWord = match[2] as DurationUnit;
    if ((DURATION_UNITS as readonly string[]).includes(unitWord)) {
      return { unit: unitWord, amount };
    }
  }

  if ((DURATION_UNITS as readonly string[]).includes(text)) {
    return { unit: text as DurationUnit };
  }

  return { unit: "instantaneous" };
}

function parseTargeting(raw: Record<string, unknown>): TargetingType {
  if (raw.shape_type) return "area";
  const rangeText = String(raw.range_text ?? "").toLowerCase();
  if (rangeText === "self" || raw.target_type === "self") return "self";
  return "single";
}

/**
 * Most save spells do *nothing* on a success (Hold Person, Sacred Flame); only
 * AoE/area damage spells grant half. Open5e carries no structured "save effect"
 * field, so we infer from the rules text: a spell is save-for-half only when it
 * explicitly says half damage on a success. Everything else is no-effect, which
 * is the correct default for the ~165 single-target save spells that were
 * previously (incorrectly) treated as save-for-half. (SRD-FID-6.)
 */
function inferSaveOutcome(
  raw: Record<string, unknown>,
): "half_damage" | "no_effect" {
  const text = `${String(raw.desc ?? raw.description ?? "")} ${String(
    raw.higher_level ?? "",
  )}`.toLowerCase();
  const halfOnSuccess =
    /half as much/.test(text) ||
    /half the damage/.test(text) ||
    /half damage/.test(text) ||
    /or half\b/.test(text);
  return halfOnSuccess ? "half_damage" : "no_effect";
}

function parseSave(
  raw: Record<string, unknown>,
): SpellDefinition["saveAgainst"] {
  const abilityKey = String(raw.saving_throw_ability ?? "").toLowerCase();
  const ability = OPEN5E_ABILITY[abilityKey];
  if (!ability) return undefined;
  return { ability, dc: "spellsave", onSuccess: inferSaveOutcome(raw) };
}

function parseDamage(
  raw: Record<string, unknown>,
): SpellDefinition["damage"] {
  const dice = typeof raw.damage_roll === "string" ? raw.damage_roll.trim() : "";
  if (!dice) return undefined;
  const types = Array.isArray(raw.damage_types) ? raw.damage_types : [];
  const typeStr = String(types[0] ?? "force").toLowerCase();
  const type = (DAMAGE_TYPES as readonly string[]).includes(typeStr)
    ? (typeStr as DamageType)
    : "force";
  return [{ dice, type }];
}

function parseUpcast(
  raw: Record<string, unknown>,
  level: SpellLevel,
  damage: SpellDefinition["damage"],
): SpellDefinition["upcastScaling"] {
  if (!damage?.[0]?.dice || level >= 9) return undefined;
  const options = raw.casting_options;
  if (!Array.isArray(options)) return undefined;

  const baseDice = damage[0].dice;
  const next = options.find(
    (o) =>
      o &&
      typeof o === "object" &&
      (o as { type?: string }).type === `slot_level_${level + 1}`,
  ) as { damage_roll?: string } | undefined;
  const nextDice = next?.damage_roll?.trim();
  if (!nextDice || nextDice === baseDice) return undefined;

  const baseMatch = baseDice.match(/^(\d+)d(\d+)$/);
  const nextMatch = nextDice.match(/^(\d+)d(\d+)$/);
  if (
    baseMatch &&
    nextMatch &&
    baseMatch[2] === nextMatch[2] &&
    Number(nextMatch[1]) > Number(baseMatch[1])
  ) {
    const diff = Number(nextMatch[1]) - Number(baseMatch[1]);
    return {
      perSlotDice: `${diff}d${baseMatch[2]}`,
      appliesTo: "damage",
    };
  }

  return undefined;
}

/**
 * Convert an Open5e v2 spell record (as stored in `codex_spells.raw`) into the
 * engine's declarative spell shape for Smithy / combat resolution.
 */
export function open5eRawToSpellDefinition(
  raw: Record<string, unknown>,
  meta: { slug: string; name?: string },
): SpellDefinition {
  const name = meta.name ?? String(raw.name ?? "Spell");
  const level = clampLevel(raw.level);
  const damage = parseDamage(raw);

  let description = String(raw.desc ?? raw.description ?? "").trim();
  if (raw.higher_level) {
    description += `${description ? "\n\n" : ""}At Higher Levels. ${String(raw.higher_level)}`;
  }

  const definition: SpellDefinition = {
    id: slugToId(meta.slug),
    name,
    level,
    school: parseSchool(raw.school),
    classes: parseClasses(raw.classes),
    castingTime: parseCastingTime(raw.casting_time),
    range: parseRange(raw),
    components: parseComponents(raw),
    duration: parseDuration(raw),
    concentration: Boolean(raw.concentration),
    ritual: Boolean(raw.ritual),
    targeting: parseTargeting(raw),
    saveAgainst: parseSave(raw),
    attackAgainst: raw.attack_roll
      ? { type: "ranged" }
      : undefined,
    damage,
    upcastScaling: parseUpcast(raw, level, damage),
    description,
  };

  return definition;
}

/** Whether a level integer is a valid spell level (exported for tests). */
export function isSpellLevel(n: number): n is SpellLevel {
  return (SPELL_LEVELS as readonly number[]).includes(n);
}

/** Whether a range type string is recognized (exported for tests). */
export function isRangeType(s: string): s is RangeType {
  return (RANGE_TYPES as readonly string[]).includes(s);
}

/** Whether an area shape string is recognized (exported for tests). */
export function isAreaShape(s: string): s is AreaShape {
  return (AREA_SHAPES as readonly string[]).includes(s);
}

/** Whether a casting-time unit string is recognized (exported for tests). */
export function isCastingTimeUnit(s: string): s is CastingTimeUnit {
  return (CASTING_TIME_UNITS as readonly string[]).includes(s);
}
