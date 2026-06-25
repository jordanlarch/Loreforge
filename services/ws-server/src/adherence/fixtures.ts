/**
 * Tool-adherence fixtures (C2 / ENG-6).
 *
 * A small, hand-curated battery of GM situations with graders attached. Each
 * `mock` is the tool call a contract-adherent model should produce — it both
 * documents the expected answer and drives the deterministic CI self-check.
 * The `expect` blocks are deliberately tolerant (a band of acceptable abilities
 * / DCs, a set of legal targets) so a *reasonable* model answer passes; only a
 * genuinely off-contract call fails.
 *
 * Grow this set as new orchestrator surfaces land (spell/target selection, item
 * use, etc.). The closed-alpha gate is ≥98% adherence over the full battery.
 */
import type { WorldState } from "@app/engine";

import type { AdherenceFixture } from "./harness.js";

/** Minimal world state for narration fixtures — only the fields the
 * orchestrators read (scene name + on-scene entity names). */
function miniScene(name: string, entityNames: string[]): WorldState {
  return {
    currentSceneId: "s:1",
    scenes: { "s:1": { id: "s:1", name } },
    entities: Object.fromEntries(
      entityNames.map((n, i) => [
        `e:${i}`,
        { id: `e:${i}`, name: n, kind: "npc", sceneId: "s:1", alive: true },
      ]),
    ),
  } as unknown as WorldState;
}

export const ADHERENCE_FIXTURES: readonly AdherenceFixture[] = [
  // ── Ability-check routing ───────────────────────────────────────────────
  {
    kind: "check",
    id: "check/pick-lock",
    playerLine: "I try to pick the lock on the iron chest.",
    expect: {
      abilities: ["dex"],
      dcMin: 10,
      dcMax: 22,
      skillIncludes: ["thieves", "sleight"],
    },
    mock: { ability: "dex", skill: "Thieves' Tools", dc: 15, proficient: true },
  },
  {
    kind: "check",
    id: "check/persuade-guard",
    playerLine: "I try to convince the gate guard to let us through.",
    expect: {
      abilities: ["cha"],
      dcMin: 10,
      dcMax: 22,
      skillIncludes: ["persuasion"],
    },
    mock: { ability: "cha", skill: "Persuasion", dc: 15, proficient: true },
  },
  {
    kind: "check",
    id: "check/climb-wall",
    playerLine: "I climb the crumbling castle wall.",
    expect: {
      abilities: ["str"],
      dcMin: 8,
      dcMax: 20,
      skillIncludes: ["athletics"],
    },
    mock: { ability: "str", skill: "Athletics", dc: 13, proficient: true },
  },
  {
    kind: "check",
    id: "check/recall-lore",
    playerLine: "Do I recognize this glowing arcane sigil?",
    expect: {
      abilities: ["int"],
      dcMin: 10,
      dcMax: 25,
      skillIncludes: ["arcana", "history", "religion"],
    },
    mock: { ability: "int", skill: "Arcana", dc: 15, proficient: true },
  },
  {
    kind: "check",
    id: "check/spot-ambush",
    playerLine: "I scan the treeline for signs of an ambush.",
    expect: {
      abilities: ["wis"],
      dcMin: 8,
      dcMax: 22,
      skillIncludes: ["perception"],
    },
    mock: { ability: "wis", skill: "Perception", dc: 15, proficient: false },
  },
  {
    kind: "check",
    id: "check/sneak-past",
    playerLine: "I sneak past the sleeping ogre toward the door.",
    expect: {
      abilities: ["dex"],
      dcMin: 10,
      dcMax: 22,
      skillIncludes: ["stealth"],
    },
    mock: { ability: "dex", skill: "Stealth", dc: 15, proficient: true },
  },
  {
    kind: "check",
    id: "check/sense-lie",
    playerLine: "I watch the merchant's face for any hint he's lying.",
    expect: {
      abilities: ["wis"],
      dcMin: 8,
      dcMax: 22,
      skillIncludes: ["insight"],
    },
    mock: { ability: "wis", skill: "Insight", dc: 13, proficient: false },
  },
  {
    kind: "check",
    id: "check/balance-ledge",
    playerLine: "I edge along the narrow cliff ledge.",
    expect: {
      abilities: ["dex"],
      dcMin: 8,
      dcMax: 20,
      skillIncludes: ["acrobatics"],
    },
    mock: { ability: "dex", skill: "Acrobatics", dc: 13, proficient: true },
  },
  {
    kind: "check",
    id: "check/intimidate",
    playerLine: "I snarl at the goblin, trying to scare it into fleeing.",
    expect: {
      abilities: ["cha"],
      dcMin: 8,
      dcMax: 22,
      skillIncludes: ["intimidation"],
    },
    mock: { ability: "cha", skill: "Intimidation", dc: 14, proficient: true },
  },
  {
    kind: "check",
    id: "check/swim-current",
    playerLine: "I swim against the river's strong current to reach the far bank.",
    expect: {
      abilities: ["str"],
      dcMin: 10,
      dcMax: 22,
      skillIncludes: ["athletics"],
    },
    mock: { ability: "str", skill: "Athletics", dc: 15, proficient: false },
  },

  {
    kind: "check",
    id: "check/forged-papers",
    playerLine: "I examine the merchant's travel papers for signs of forgery.",
    expect: {
      abilities: ["int", "wis"],
      dcMin: 12,
      dcMax: 25,
      skillIncludes: ["investigation", "insight"],
    },
    mock: { ability: "int", skill: "Investigation", dc: 17, proficient: true },
  },
  {
    kind: "check",
    id: "check/track-in-mud",
    playerLine: "I follow the muddy tracks leading away from the campsite.",
    expect: {
      abilities: ["wis"],
      dcMin: 10,
      dcMax: 22,
      skillIncludes: ["survival", "nature"],
    },
    mock: { ability: "wis", skill: "Survival", dc: 14, proficient: true },
  },

  // ── Monster target selection ────────────────────────────────────────────
  {
    kind: "target",
    id: "target/archer-picks-anyone",
    monsterName: "Goblin Archer",
    candidates: [
      { id: "pc:thorin", name: "Thorin (Fighter)", hp: 34 },
      { id: "pc:elara", name: "Elara (Wizard)", hp: 7 },
      { id: "pc:wren", name: "Wren (Rogue)", hp: 19 },
    ],
    // Any legal candidate is adherent; the deterministic planner picks the
    // tactically-best one when the model declines.
    expect: { allowed: ["pc:thorin", "pc:elara", "pc:wren"] },
    mock: { targetId: "pc:elara" },
  },
  {
    kind: "target",
    id: "target/single-candidate",
    monsterName: "Dire Wolf",
    candidates: [{ id: "pc:thorin", name: "Thorin (Fighter)", hp: 34 }],
    expect: { allowed: ["pc:thorin"] },
    mock: { targetId: "pc:thorin" },
  },

  {
    kind: "target",
    id: "target/wounded-caster",
    monsterName: "Hobgoblin Captain",
    candidates: [
      { id: "pc:fighter", name: "Thorin (Fighter)", hp: 28 },
      { id: "pc:wizard", name: "Elara (Wizard)", hp: 4 },
    ],
    expect: { allowed: ["pc:fighter", "pc:wizard"] },
    mock: { targetId: "pc:wizard" },
  },
  {
    kind: "target",
    id: "target/bruiser-vs-archer",
    monsterName: "Bugbear",
    candidates: [
      { id: "pc:archer", name: "Wren (Ranger)", hp: 22 },
      { id: "pc:cleric", name: "Mira (Cleric)", hp: 18 },
    ],
    expect: { allowed: ["pc:archer", "pc:cleric"] },
    mock: { targetId: "pc:archer" },
  },

  // ── Narration stays fiction-only ────────────────────────────────────────
  {
    kind: "narrate",
    id: "narrate/enter-tavern",
    playerLine: "I push open the tavern door and look around.",
    mode: "action",
    state: miniScene("The Prancing Pony", ["Barkeep", "Hooded Stranger"]),
    expect: { mentionsSubsetOf: ["Barkeep", "Hooded Stranger"] },
    mock: {
      narration:
        "You shoulder the warped door open and a wave of pipe smoke and low laughter rolls out to meet you; behind the counter the barkeep looks up, while a hooded figure in the corner goes very still.",
      mentions: ["Barkeep", "Hooded Stranger"],
    },
  },
  {
    kind: "narrate",
    id: "narrate/inspect-altar",
    playerLine: "I approach the cracked altar and study the carvings.",
    mode: "action",
    state: miniScene("Ruined Shrine", ["Cracked Altar"]),
    expect: { mentionsSubsetOf: ["Cracked Altar"] },
    mock: {
      narration:
        "You kneel before the cracked altar, tracing fingers over worn reliefs of robed figures bowing to something vast and many-eyed; the stone is cold, and the air tastes faintly of old incense and older fear.",
      mentions: ["Cracked Altar"],
    },
  },
  {
    kind: "narrate",
    id: "narrate/successful-check",
    playerLine: "Did my lockpick work?",
    mode: "check",
    state: miniScene("Treasure Vault", ["Iron Chest"]),
    outcome:
      "Mira's Dexterity (Thieves' Tools) check succeeds (rolled 18 vs DC 15).",
    expect: { mentionsSubsetOf: ["Iron Chest"] },
    mock: {
      narration:
        "The tumblers click home under your careful touch; the iron chest lid lifts with a soft groan, and stale air spills out into the torchlight.",
      mentions: ["Iron Chest"],
    },
  },
  {
    kind: "narrate",
    id: "narrate/ooc-question",
    playerLine: "((How dark is it in here?))",
    mode: "ooc",
    state: miniScene("Collapsed Tunnel", ["Rubble Pile"]),
    expect: { mentionsSubsetOf: ["Rubble Pile"] },
    mock: {
      narration:
        "Torchlight dies a few paces ahead where the ceiling has fallen in; beyond that, the tunnel is pitch black and tight with dust.",
      mentions: ["Rubble Pile"],
    },
  },
];
