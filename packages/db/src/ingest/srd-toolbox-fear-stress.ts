/**
 * SRD 5.2 Gameplay Toolbox → Fear and Mental Stress rules prose + sample seeds (DATA-1b).
 */
import type { FearStressDefinition } from "@app/engine";
import { toolboxEntryId } from "@app/engine";

export const FEAR_STRESS_RULES_SECTION_SLUG = "srd-2024_fear-stress-rules";

export const FEAR_STRESS_RULES_PROSE = `Due to the nature of their vocation, adventurers tend to be less susceptible to fear and mental stress than common folk. That said, certain creatures and game effects can terrify or fray the mind of even the most stalwart adventurer. If you plan to use any of these rules, discuss them with your players at the start of the campaign.

Fear Effects

Whenever the characters encounter something supernaturally frightful, use the Frightened condition as the baseline effect. Fear effects typically require a Wisdom saving throw, with a save DC based on how terrifying the situation is. A Frightened creature usually repeats the saving throw at the end of each of its turns, ending the effect on itself on a success.

Mental Stress Effects

When a character is subjected to an effect that causes intense mental stress, Psychic damage is the best way to emulate that effect. Mental stress can usually be resisted with a successful Wisdom save, but sometimes an Intelligence or Charisma save is more appropriate. On a successful save, a character might take half as much damage instead of no damage, at your discretion.

Prolonged Effects

Exposure to mental stress can cause short-term, long-term, or indefinite effects. Calm Emotions can suppress them; Lesser Restoration or Greater Restoration removes them as noted in each example.`;

type FearStressSeed = {
  slug: string;
  name: string;
  description: string;
  sortIndex: number;
  definition: FearStressDefinition;
};

function fearStress(
  seed: Omit<FearStressSeed, "definition"> & {
    definition: Omit<FearStressDefinition, "kind" | "id"> & { id?: string };
  },
): FearStressSeed {
  return {
    ...seed,
    definition: {
      ...seed.definition,
      id: seed.definition.id ?? toolboxEntryId(seed.name),
      kind: "fear_stress",
    },
  };
}

/** PDF sample fear / mental stress entries — hand-normalized to GRILL-FEAR Q3 shape. */
export const SRD_TOOLBOX_FEAR_STRESS_SEEDS: FearStressSeed[] = [
  fearStress({
    slug: "srd-2024_sarcophagus-apparition",
    name: "Sarcophagus Apparition",
    description: "Harmless yet terrifying apparition when a sarcophagus is opened.",
    sortIndex: 0,
    definition: {
      name: "Sarcophagus Apparition",
      description: "Harmless yet terrifying apparition when a sarcophagus is opened.",
      save: { ability: "wis", dc: 10, onSuccess: "negates" },
      effects: ["Frightened on a failed save."],
      duration: "Repeat save at end of each turn; ends on success.",
    },
  }),
  fearStress({
    slug: "srd-2024_worst-fears-illusion",
    name: "Worst Fears Illusion",
    description:
      "Magical trap creating an illusory manifestation of a character's worst fears.",
    sortIndex: 1,
    definition: {
      name: "Worst Fears Illusion",
      description:
        "Magical trap creating an illusory manifestation of a character's worst fears.",
      save: { ability: "wis", dc: 15, onSuccess: "negates" },
      effects: [
        "Frightened on a failed save; visible only to the affected character.",
      ],
      duration: "Repeat save at end of each turn; ends on success.",
    },
  }),
  fearStress({
    slug: "srd-2024_abyss-portal",
    name: "Abyss Portal",
    description: "Portal to the Abyss revealing a nightmarish realm.",
    sortIndex: 2,
    definition: {
      name: "Abyss Portal",
      description: "Portal to the Abyss revealing a nightmarish realm.",
      save: { ability: "wis", dc: 20, onSuccess: "negates" },
      effects: ["Frightened on a failed save."],
      duration: "Repeat save at end of each turn; ends on success.",
    },
  }),
  fearStress({
    slug: "srd-2024_hallucinogenic-substance",
    name: "Hallucinogenic Substance",
    description: "Ingested substance that distorts perception of reality.",
    sortIndex: 3,
    definition: {
      name: "Hallucinogenic Substance",
      description: "Ingested substance that distorts perception of reality.",
      save: { ability: "wis", dc: 10, onSuccess: "half" },
      effects: ["1d6 psychic damage on a failed save."],
      duration: "Half damage on a successful save at DM discretion.",
    },
  }),
  fearStress({
    slug: "srd-2024_fiendish-idol",
    name: "Fiendish Idol",
    description: "Touching a fiendish idol that tears at the mind.",
    sortIndex: 4,
    definition: {
      name: "Fiendish Idol",
      description: "Touching a fiendish idol that tears at the mind.",
      save: { ability: "wis", dc: 15, onSuccess: "half" },
      effects: ["3d6 psychic damage on a failed save."],
      duration: "Half damage on a successful save at DM discretion.",
    },
  }),
  fearStress({
    slug: "srd-2024_far-realm-trap",
    name: "Far Realm Trap",
    description: "Magical trap that flings a character into the Far Realm briefly.",
    sortIndex: 5,
    definition: {
      name: "Far Realm Trap",
      description: "Magical trap that flings a character into the Far Realm briefly.",
      save: { ability: "wis", dc: 20, onSuccess: "half" },
      effects: ["9d6 psychic damage on a failed save."],
      duration: "Until the end of the character's next turn.",
    },
  }),
  fearStress({
    slug: "srd-2024_short-term-mental-stress",
    name: "Short-Term Mental Stress",
    description: "Prolonged mental stress — short-term outcome.",
    sortIndex: 6,
    definition: {
      name: "Short-Term Mental Stress",
      description: "Prolonged mental stress — short-term outcome.",
      effects: [
        "Frightened, Incapacitated, or Stunned for 1d10 minutes.",
        "May include alarming behavior or hallucinations.",
      ],
      duration:
        "Suppressed by Calm Emotions; removed by Lesser Restoration.",
    },
  }),
  fearStress({
    slug: "srd-2024_long-term-mental-stress",
    name: "Long-Term Mental Stress",
    description: "Prolonged mental stress — long-term outcome.",
    sortIndex: 7,
    definition: {
      name: "Long-Term Mental Stress",
      description: "Prolonged mental stress — long-term outcome.",
      effects: [
        "Disadvantage on some or all ability checks for 1d10 × 10 hours.",
        "Stemming from unwillingness or inability to exert a particular set of abilities.",
      ],
      duration:
        "Suppressed by Calm Emotions; removed by Lesser Restoration.",
    },
  }),
  fearStress({
    slug: "srd-2024_indefinite-mental-stress",
    name: "Indefinite Mental Stress",
    description: "Prolonged mental stress — indefinite outcome.",
    sortIndex: 8,
    definition: {
      name: "Indefinite Mental Stress",
      description: "Prolonged mental stress — indefinite outcome.",
      effects: [
        "Long-term mental stress effect (Disadvantage on ability checks) until removed.",
      ],
      duration:
        "Lasts until removed by Greater Restoration; suppressed by Calm Emotions.",
    },
  }),
];
