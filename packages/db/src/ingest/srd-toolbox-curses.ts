/**
 * SRD 5.2 Gameplay Toolbox → Curses and Magical Contagions rules prose + sample seeds (DATA-1b).
 */
import type { CurseDefinition } from "@app/engine";
import { toolboxEntryId } from "@app/engine";

export const CURSES_RULES_SECTION_SLUG = "srd-2024_curses-rules";

export const CURSES_RULES_PROSE = `A curse is a magical burden that lasts for a specified time or until it is ended by some means. A magical contagion is an adverse effect of magical origin that is contagious by definition.

Curses typically take one of these forms: Bestow Curse (spell-created, ended by Remove Curse), cursed creatures (such as werewolves), cursed magic items, narrative curses tied to taboo violations, or environmental curses from evil locations.

Magical Contagions

Alchemists, potion brewers, and areas of wild magic are credited with creating the first magical contagions. An outbreak of such a contagion can form the basis of an adventure as characters search for a cure and try to stop the contagion's spread.

Rest and Recuperation. If a creature infected with a magical contagion spends 3 days recuperating—engaging in no activities that would interrupt a Long Rest—the creature makes a DC 15 Constitution saving throw at the end of the recuperation period. On a successful save, the creature has Advantage on saving throws to fight off the magical contagion for the next 24 hours.`;

type CurseSeed = {
  slug: string;
  name: string;
  description: string;
  sortIndex: number;
  definition: CurseDefinition;
};

function curse(
  seed: Omit<CurseSeed, "definition"> & {
    definition: Omit<CurseDefinition, "kind" | "id"> & { id?: string };
  },
): CurseSeed {
  return {
    ...seed,
    definition: {
      ...seed.definition,
      id: seed.definition.id ?? toolboxEntryId(seed.name),
      kind: "curse",
    },
  };
}

/** PDF sample curses and magical contagions — hand-normalized to GRILL-CURSE Q3 `CurseDefinition` shape. */
export const SRD_TOOLBOX_CURSE_SEEDS: CurseSeed[] = [
  curse({
    slug: "srd-2024_demonic-possession",
    name: "Demonic Possession",
    description: "Environmental curse from demonic objects or desecrated locations.",
    sortIndex: 0,
    definition: {
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
    },
  }),
  curse({
    slug: "srd-2024_cackle-fever",
    name: "Cackle Fever",
    description: "Magical contagion from tainted potions and elixirs.",
    sortIndex: 1,
    definition: {
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
    },
  }),
  curse({
    slug: "srd-2024_sewer-plague",
    name: "Sewer Plague",
    description: "Magical contagion from fouled potions, alchemical waste, and sewer filth.",
    sortIndex: 2,
    definition: {
      name: "Sewer Plague",
      description: "Magical contagion from fouled potions, alchemical waste, and sewer filth.",
      save: { ability: "con", dc: 11, onSuccess: "negates" },
      effects: [
        "1d4 days after infection: gain 1 Exhaustion.",
        "While any Exhaustion: regain half HP from Hit Dice.",
        "While any Exhaustion: Long Rest restores no HP and reduces no Exhaustion.",
      ],
      contagion:
        "Wounded by a carrier or contact with contaminated filth or offal.",
      recovery:
        "Daily at dawn: DC 11 Constitution save — +1 Exhaustion on fail, −1 on success; ends at Exhaustion 0.",
    },
  }),
  curse({
    slug: "srd-2024_sight-rot",
    name: "Sight Rot",
    description: "Magical contagion from water tainted by Sight Rot.",
    sortIndex: 3,
    definition: {
      name: "Sight Rot",
      description: "Magical contagion from water tainted by Sight Rot.",
      save: { ability: "con", dc: 15, onSuccess: "negates" },
      effects: ["Blinded until the contagion ends."],
      contagion:
        "Humanoids with skin contact must save or become infected (immune from that carrier for 24 hours on success).",
      recovery:
        "Heal or Lesser Restoration ends immediately. Herbalism Kit ointment (1 hour per dose) suppresses 24 hours; three applications (72 hours total) ends the contagion.",
    },
  }),
];
