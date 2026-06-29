/**
 * SRD 5.2 Gameplay Toolbox curse definitions — engine runtime registry (DATA-1b / GRILL-LIVE-CURSE).
 * DB Codex seeds import these; keep in sync with `packages/db/src/ingest/srd-toolbox-curses.ts` prose rows.
 */
import { toolboxEntryId, type CurseDefinition } from "./toolbox-definitions";

export type SrdCurseSeed = {
  slug: string;
  sortIndex: number;
  definition: CurseDefinition;
};

function curse(
  slug: string,
  sortIndex: number,
  definition: Omit<CurseDefinition, "kind" | "id"> & { id?: string },
): SrdCurseSeed {
  return {
    slug,
    sortIndex,
    definition: {
      ...definition,
      id: definition.id ?? toolboxEntryId(definition.name),
      kind: "curse",
    },
  };
}

/** PDF sample curses — hand-normalized to GRILL-CURSE Q3 `CurseDefinition` shape. */
export const SRD_CURSE_SEEDS: readonly SrdCurseSeed[] = [
  curse("srd-2024_demonic-possession", 0, {
    name: "Demonic Possession",
    description: "Environmental curse from demonic objects or desecrated locations.",
    save: { ability: "cha", dc: 15, onSuccess: "negates" },
    effects: [
      "On a failed initial save, possessed by a bodiless demonic entity.",
      "Whenever the possessed creature rolls a 1 on a D20 Test, the entity takes control.",
      "At the end of each later turn while possessed: DC 15 Charisma save to regain control.",
    ],
    recovery:
      "After each Long Rest: DC 15 Charisma save ends the curse on success. Dispel Evil and Good or other magic that removes a curse also ends it.",
  }),
  curse("srd-2024_cackle-fever", 1, {
    name: "Cackle Fever",
    description: "Magical contagion from tainted potions and elixirs.",
    save: { ability: "con", dc: 10, onSuccess: "negates" },
    effects: [
      "Affects Humanoids only; gnomes are immune.",
      "1d4 days after infection: gain 1 Exhaustion until the contagion ends.",
      "While Exhausted: DC 13 Constitution save when taking non-Psychic damage or take 1d10 Psychic damage and become Incapacitated (repeat save each turn; auto-success after 1 minute).",
    ],
    contagion:
      "Humanoids (except gnomes) within a 10-foot Emanation at the start of their turn must save or become infected (immune from that carrier for 24 hours on success).",
    recovery:
      "End of each Long Rest: DC 13 Constitution save; ends after three successes (immune to Cackle Fever for 1 year).",
  }),
  curse("srd-2024_sewer-plague", 2, {
    name: "Sewer Plague",
    description: "Magical contagion from fouled potions, alchemical waste, and sewer filth.",
    save: { ability: "con", dc: 11, onSuccess: "negates" },
    effects: [
      "1d4 days after infection: gain 1 Exhaustion.",
      "While any Exhaustion: regain half HP from Hit Dice.",
      "While any Exhaustion: Long Rest restores no HP and reduces no Exhaustion.",
    ],
    contagion: "Wounded by a carrier or contact with contaminated filth or offal.",
    recovery:
      "Daily at dawn: DC 11 Constitution save — +1 Exhaustion on fail, −1 on success; ends at Exhaustion 0.",
  }),
  curse("srd-2024_sight-rot", 3, {
    name: "Sight Rot",
    description: "Magical contagion from water tainted by Sight Rot.",
    save: { ability: "con", dc: 15, onSuccess: "negates" },
    conditions: ["blinded"],
    effects: ["Blinded until the contagion ends."],
    contagion:
      "Humanoids with skin contact must save or become infected (immune from that carrier for 24 hours on success).",
    recovery:
      "Heal or Lesser Restoration ends immediately. Herbalism Kit ointment (1 hour per dose) suppresses 24 hours; three applications (72 hours total) ends the contagion.",
  }),
  curse("srd-spell_bestow-curse", 4, {
    name: "Bestow Curse (spell)",
    description:
      "Spell-created curse — rider effect chosen at cast (v1 tracks instance; mechanics narrative).",
    effects: [
      "One rider: ability disadvantage, attack disadvantage vs caster, forced Dodge, or +1d8 necrotic on hit.",
    ],
    recovery: "Remove Curse, Greater Restoration, or Wish ends the effect.",
  }),
];

export const CURSE_REGISTRY: Readonly<Record<string, CurseDefinition>> = Object.fromEntries(
  SRD_CURSE_SEEDS.map((s) => [s.slug, s.definition]),
);

export function getCurseDefinition(slug: string): CurseDefinition | undefined {
  return CURSE_REGISTRY[slug];
}
