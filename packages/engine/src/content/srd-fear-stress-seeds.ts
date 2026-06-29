/**
 * SRD 5.2 Gameplay Toolbox fear/stress definitions — engine runtime registry
 * (DATA-1b / GRILL-LIVE-FEAR). DB Codex seeds should stay in sync.
 */
import {
  toolboxEntryId,
  type FearStressDefinition,
  type ToolboxDamage,
} from "./toolbox-definitions";

export type SrdFearStressSeed = {
  slug: string;
  sortIndex: number;
  definition: FearStressDefinition;
};

function fearStress(
  slug: string,
  sortIndex: number,
  definition: Omit<FearStressDefinition, "kind" | "id"> & { id?: string },
): SrdFearStressSeed {
  return {
    slug,
    sortIndex,
    definition: {
      ...definition,
      id: definition.id ?? toolboxEntryId(definition.name),
      kind: "fear_stress",
    },
  };
}

/** PDF fear / mental stress entries — hand-normalized to GRILL-FEAR Q3 shape. */
export const SRD_FEAR_STRESS_SEEDS: readonly SrdFearStressSeed[] = [
  fearStress("srd-2024_sarcophagus-apparition", 0, {
    name: "Sarcophagus Apparition",
    description: "Harmless yet terrifying apparition when a sarcophagus is opened.",
    save: { ability: "wis", dc: 10, onSuccess: "negates" },
    effects: ["Frightened on a failed save."],
    duration: "Repeat save at end of each turn; ends on success.",
  }),
  fearStress("srd-2024_worst-fears-illusion", 1, {
    name: "Worst Fears Illusion",
    description:
      "Magical trap creating an illusory manifestation of a character's worst fears.",
    save: { ability: "wis", dc: 15, onSuccess: "negates" },
    effects: [
      "Frightened on a failed save; visible only to the affected character.",
    ],
    duration: "Repeat save at end of each turn; ends on success.",
  }),
  fearStress("srd-2024_abyss-portal", 2, {
    name: "Abyss Portal",
    description: "Portal to the Abyss revealing a nightmarish realm.",
    save: { ability: "wis", dc: 20, onSuccess: "negates" },
    effects: ["Frightened on a failed save."],
    duration: "Repeat save at end of each turn; ends on success.",
  }),
  fearStress("srd-2024_hallucinogenic-substance", 3, {
    name: "Hallucinogenic Substance",
    description: "Ingested substance that distorts perception of reality.",
    save: { ability: "wis", dc: 10, onSuccess: "half" },
    effects: ["1d6 psychic damage on a failed save."],
    duration: "Half damage on a successful save at DM discretion.",
  }),
  fearStress("srd-2024_fiendish-idol", 4, {
    name: "Fiendish Idol",
    description: "Touching a fiendish idol that tears at the mind.",
    save: { ability: "wis", dc: 15, onSuccess: "half" },
    effects: ["3d6 psychic damage on a failed save."],
    duration: "Half damage on a successful save at DM discretion.",
  }),
  fearStress("srd-2024_far-realm-trap", 5, {
    name: "Far Realm Trap",
    description: "Magical trap that flings a character into the Far Realm briefly.",
    save: { ability: "wis", dc: 20, onSuccess: "half" },
    effects: ["9d6 psychic damage on a failed save."],
    duration: "Until the end of the character's next turn.",
  }),
  fearStress("srd-2024_short-term-mental-stress", 6, {
    name: "Short-Term Mental Stress",
    description: "Prolonged mental stress — short-term outcome.",
    effects: [
      "Frightened, Incapacitated, or Stunned for 1d10 minutes.",
      "May include alarming behavior or hallucinations.",
    ],
    duration:
      "Suppressed by Calm Emotions; removed by Lesser Restoration.",
  }),
  fearStress("srd-2024_long-term-mental-stress", 7, {
    name: "Long-Term Mental Stress",
    description: "Prolonged mental stress — long-term outcome.",
    effects: [
      "Disadvantage on some or all ability checks for 1d10 × 10 hours.",
      "Stemming from unwillingness or inability to exert a particular set of abilities.",
    ],
    duration:
      "Suppressed by Calm Emotions; removed by Lesser Restoration.",
  }),
  fearStress("srd-2024_indefinite-mental-stress", 8, {
    name: "Indefinite Mental Stress",
    description: "Prolonged mental stress — indefinite outcome.",
    effects: [
      "Long-term mental stress effect (Disadvantage on ability checks) until removed.",
    ],
    duration:
      "Lasts until removed by Greater Restoration; suppressed by Calm Emotions.",
  }),
];

export const FEAR_STRESS_REGISTRY: Readonly<
  Record<string, FearStressDefinition>
> = Object.fromEntries(SRD_FEAR_STRESS_SEEDS.map((s) => [s.slug, s.definition]));

export function getFearStressDefinition(
  slug: string,
): FearStressDefinition | undefined {
  return FEAR_STRESS_REGISTRY[slug];
}

const PROLONGED_FEAR_STRESS_SLUGS = new Set([
  "srd-2024_short-term-mental-stress",
  "srd-2024_long-term-mental-stress",
  "srd-2024_indefinite-mental-stress",
]);

/** Prolonged stress outcomes deferred from Live Play v1 (GRILL-LIVE-FEAR Q1). */
export function isProlongedFearStressSlug(slug: string): boolean {
  return PROLONGED_FEAR_STRESS_SLUGS.has(slug);
}

/** Fear entries apply frightened; stress entries deal psychic damage (Q3 registry rule). */
export function fearStressAppliesFrightened(def: FearStressDefinition): boolean {
  return def.effects?.some((e) => /frightened/i.test(e)) ?? false;
}

export function fearStressPsychicDamage(
  def: FearStressDefinition,
): ToolboxDamage | undefined {
  for (const effect of def.effects ?? []) {
    const match = effect.match(/(\d+d\d+)\s+psychic/i);
    if (match?.[1]) {
      return { dice: match[1], type: "psychic" };
    }
  }
  return undefined;
}

/** Turn-start repeat saves for ongoing fear (B2 — not SRD end-of-turn literal). */
export function fearStressNeedsRepeatTick(def: FearStressDefinition): boolean {
  if (!fearStressAppliesFrightened(def)) return false;
  const text = [def.duration, ...(def.effects ?? [])].join(" ").toLowerCase();
  return (
    text.includes("repeat save") ||
    text.includes("each turn") ||
    text.includes("end of each")
  );
}
