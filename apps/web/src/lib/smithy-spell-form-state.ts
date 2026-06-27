import type {
  DamageType,
  DurationUnit,
  ItemSource,
  SpellDefinition,
  SpellSchool,
} from "@app/engine";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type Resolution = "none" | "save" | "attack";

/** Wire payload shared by createSpell / updateSpell. */
export type SmithySpellFormPayload = {
  name: string;
  level: number;
  school: SpellSchool;
  classes: string[];
  castingTime: SpellDefinition["castingTime"];
  range: SpellDefinition["range"];
  components: SpellDefinition["components"];
  duration: SpellDefinition["duration"];
  concentration: boolean;
  ritual: boolean;
  targeting: SpellDefinition["targeting"];
  saveAgainst?: SpellDefinition["saveAgainst"];
  attackAgainst?: SpellDefinition["attackAgainst"];
  damage?: SpellDefinition["damage"];
  healing?: SpellDefinition["healing"];
  upcastScaling?: SpellDefinition["upcastScaling"];
  description: string;
  source?: ItemSource;
  copiedFromSlug?: string;
};

export type SmithySpellFormState = {
  name: string;
  level: number;
  school: SpellSchool;
  classesText: string;
  castUnit: SpellDefinition["castingTime"]["unit"];
  castAmount: number;
  rangeType: SpellDefinition["range"]["type"];
  rangeAmount: number;
  hasArea: boolean;
  areaShape: NonNullable<SpellDefinition["range"]["area"]>["shape"];
  areaSize: number;
  verbal: boolean;
  somatic: boolean;
  material: string;
  durationUnit: DurationUnit;
  durationAmount: number;
  concentration: boolean;
  ritual: boolean;
  targeting: SpellDefinition["targeting"];
  resolution: Resolution;
  saveAbility: Ability;
  saveOutcome: NonNullable<SpellDefinition["saveAgainst"]>["onSuccess"];
  attackType: NonNullable<SpellDefinition["attackAgainst"]>["type"];
  damages: { dice: string; type: DamageType }[];
  healingDice: string;
  upcastDice: string;
  upcastApplies: NonNullable<SpellDefinition["upcastScaling"]>["appliesTo"];
  description: string;
};

export function emptySpellFormState(): SmithySpellFormState {
  return {
    name: "",
    level: 1,
    school: "evocation",
    classesText: "",
    castUnit: "action",
    castAmount: 1,
    rangeType: "feet",
    rangeAmount: 60,
    hasArea: false,
    areaShape: "sphere",
    areaSize: 20,
    verbal: true,
    somatic: true,
    material: "",
    durationUnit: "instantaneous",
    durationAmount: 1,
    concentration: false,
    ritual: false,
    targeting: "single",
    resolution: "none",
    saveAbility: "dex",
    saveOutcome: "half_damage",
    attackType: "ranged",
    damages: [{ dice: "", type: "fire" }],
    healingDice: "",
    upcastDice: "",
    upcastApplies: "damage",
    description: "",
  };
}

export function spellDefinitionToFormState(
  def: SpellDefinition,
): SmithySpellFormState {
  return {
    name: def.name,
    level: def.level,
    school: def.school,
    classesText: def.classes.join(", "),
    castUnit: def.castingTime.unit,
    castAmount: def.castingTime.amount ?? 1,
    rangeType: def.range.type,
    rangeAmount: def.range.amount ?? 60,
    hasArea: Boolean(def.range.area),
    areaShape: def.range.area?.shape ?? "sphere",
    areaSize: def.range.area?.size ?? 20,
    verbal: def.components.verbal ?? false,
    somatic: def.components.somatic ?? false,
    material: def.components.material ?? "",
    durationUnit: def.duration.unit,
    durationAmount: def.duration.amount ?? 1,
    concentration: def.concentration ?? false,
    ritual: def.ritual ?? false,
    targeting: def.targeting,
    resolution: def.saveAgainst ? "save" : def.attackAgainst ? "attack" : "none",
    saveAbility: def.saveAgainst?.ability ?? "dex",
    saveOutcome: def.saveAgainst?.onSuccess ?? "half_damage",
    attackType: def.attackAgainst?.type ?? "ranged",
    damages:
      def.damage && def.damage.length > 0
        ? def.damage.map((d) => ({ dice: d.dice, type: d.type }))
        : [{ dice: "", type: "fire" }],
    healingDice: def.healing?.dice ?? "",
    upcastDice: def.upcastScaling?.perSlotDice ?? "",
    upcastApplies: def.upcastScaling?.appliesTo ?? "damage",
    description: def.description ?? "",
  };
}

export function spellFormStateToPayload(
  state: SmithySpellFormState,
): SmithySpellFormPayload {
  const timedDuration = (
    ["round", "minute", "hour", "day"] as DurationUnit[]
  ).includes(state.durationUnit);
  const rangedDistance =
    state.rangeType === "feet" || state.rangeType === "miles";

  return {
    name: state.name.trim(),
    level: state.level,
    school: state.school,
    classes: state.classesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    castingTime: { unit: state.castUnit, amount: state.castAmount },
    range: {
      type: state.rangeType,
      amount: rangedDistance ? state.rangeAmount : undefined,
      area: state.hasArea
        ? { shape: state.areaShape, size: state.areaSize }
        : undefined,
    },
    components: {
      verbal: state.verbal,
      somatic: state.somatic,
      material: state.material.trim() || undefined,
    },
    duration: {
      unit: state.durationUnit,
      amount: timedDuration ? state.durationAmount : undefined,
    },
    concentration: state.concentration,
    ritual: state.ritual,
    targeting: state.targeting,
    saveAgainst:
      state.resolution === "save"
        ? {
            ability: state.saveAbility,
            dc: "spellsave",
            onSuccess: state.saveOutcome,
          }
        : undefined,
    attackAgainst:
      state.resolution === "attack" ? { type: state.attackType } : undefined,
    damage: (() => {
      const rows = state.damages
        .map((d) => ({ dice: d.dice.trim(), type: d.type }))
        .filter((d) => d.dice);
      return rows.length > 0 ? rows : undefined;
    })(),
    healing: state.healingDice.trim()
      ? { dice: state.healingDice.trim() }
      : undefined,
    upcastScaling: state.upcastDice.trim()
      ? { perSlotDice: state.upcastDice.trim(), appliesTo: state.upcastApplies }
      : undefined,
    description: state.description.trim(),
  };
}
