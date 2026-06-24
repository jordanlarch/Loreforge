/**
 * Tutorial script fixture — the data-driven scene graph for the onboarding
 * micro-campaign "The Lantern's Last Flicker" (M6, TUT-1).
 *
 * Like {@link buildPartyBattleCommands}, scenes are expressed as ordered
 * {@link Command} lists replayed through the real engine, so the tutorial's
 * world state comes from the event → projection path (mechanical fidelity from
 * minute 1, per `docs/onboarding/tutorial-adventure.md` §1). The script is plain
 * data: the server-side `TutorialRoom` (`@app/ws-server`) seeds the first scene,
 * advances to the next on a scripted trigger, and reads the canned narration +
 * check definitions from here. Keeping it engine-side means the same scene ids,
 * narration, and check DCs are the single source of truth for the driver, the
 * fixtures, and tests.
 *
 * This is the tracer slice (#169): the Hollow's Edge arrival scene + a stub
 * second scene to prove end-to-end advancement. Scenes 2–7 land in later slices.
 */
import type { Command } from "../commands/types";
import type { Ability, GridPosition } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { monsterTemplate } from "../content/monsters";
import type { FoeSpec, PartyMember } from "./battle";
import { FIXTURE_BATTLE_FOES_SIDE, FIXTURE_BATTLE_PARTY_SIDE } from "./battle";

/**
 * The party shape the tutorial script needs to place a PC — exactly
 * {@link PartyMember} (id + statline + optional spellcasting). Aliased so the
 * driver and tests can import a tutorial-named type from one place.
 */
export type PartyMemberLike = PartyMember;

/** Stable scene ids for the tutorial (referenced by the driver + tests). */
export const TUTORIAL_SCENE_HOLLOWS_EDGE = "scene:tut-hollows-edge";
export const TUTORIAL_SCENE_HEARTH = "scene:tut-hearth";
export const TUTORIAL_SCENE_CROOKED_LANE = "scene:tut-crooked-lane";
export const TUTORIAL_SCENE_SPIRE_LOWER = "scene:tut-spire-lower";
export const TUTORIAL_SCENE_SPIRE_STAIR = "scene:tut-spire-stair";
export const TUTORIAL_SCENE_SPIRE_UPPER = "scene:tut-spire-upper";

/** A scripted loot item granted on a successful check (D4). Plain data so both
 * the engine fixture and the DB grant (ws-server) share one definition; the
 * grant maps it onto a character `equipment` row. */
export type TutorialLootItem = {
  name: string;
  quantity: number;
  description?: string;
};

/** A scripted ability check offered within a scene (the engine rolls it). */
export type TutorialCheck = {
  ability: Ability;
  /** Display-only SRD skill label (e.g. "Survival"). */
  skill?: string;
  dc: number;
  /** Whether the PC adds proficiency to the roll. */
  proficient?: boolean;
  /** Canned narration on success / failure (LLM-free, air-gapped safe). */
  successText: string;
  failureText: string;
  /** Button label the client shows to invoke the check. */
  prompt: string;
  /** When set, the companion can grant advantage on this check (the Help action). */
  helpPrompt?: string;
  /** Items claimed into the PC's inventory on success (scripted grant, D4). */
  loot?: readonly TutorialLootItem[];
};

/** The four scripted lantern-relight paths in the Scene 6 finale (TUT-1, #175). */
export type TutorialRelightPathId = "oil" | "flint" | "prayer" | "improv";

/**
 * One scripted way to relight the great lantern in Scene 6 (D4 item-use → effect,
 * D3 RP-check via the real engine). Every path converges on the same resolution
 * beat but produces distinct narration:
 *
 *   - `oil`    — uses the Oil of Brightness (best outcome); consumes the item.
 *   - `flint`  — Marlowe's flint + lamp oil (the standard outcome).
 *   - `prayer` — recites the Order's prayer: a real engine ability check; on a
 *                failure it falls back to the standard outcome's narration.
 *   - `improv` — anything unexpected (the air-gapped fallback for AI improv):
 *                converges narratively on the standard outcome.
 */
export type TutorialRelightPath = {
  id: TutorialRelightPathId;
  /** Button label the Scene 6 control card shows to take this path. */
  prompt: string;
  /** GM narration when this path lights the lantern. */
  text: string;
  /** Item consumed from the hero's real inventory on this path (D4). */
  consumesItem?: string;
  /**
   * A real engine ability check gating this path (the prayer's RP reach, D3).
   * On success the engine blesses the relight (`text`); on failure it converges
   * on `failureText` (the standard outcome). Air-gapped: a deterministic d20.
   */
  check?: {
    ability: Ability;
    /** Display-only SRD skill label (e.g. "Religion"). */
    skill?: string;
    dc: number;
    proficient?: boolean;
    /** Narration when the check fails (the standard fallback outcome). */
    failureText: string;
  };
};

/**
 * The Scene 6 finale resolution (TUT-1, #175): the relight paths plus the shared
 * post-relight beat that resolves the hook, notes reputation, awards XP / makes
 * the hero level-up-eligible, and demos memory pinning. The mechanical effects
 * are applied by the ws-server against real data (D4); this is the canned copy.
 */
export type TutorialResolution = {
  /** The mutually-exclusive relight paths offered to the player. */
  paths: readonly TutorialRelightPath[];
  /** Shared GM narration after any path lights the lantern. */
  resolution: string;
  /** Reputation flavor note (narration-only this slice; real rep is deferred). */
  reputationNote: string;
  /** The level-up notice + first-time tooltip copy (no wizard in the tutorial). */
  levelUp: {
    notice: string;
    tooltipTitle: string;
    tooltipBody: string;
  };
  /** The memory-pin demo beat: a GM message the player can pin to memory. */
  memory: {
    text: string;
    mentions?: readonly string[];
    /** A concise suggested pin the coachmark nudges the player toward. */
    pinSuggestion: string;
  };
};

/** One scene in the scripted tutorial flow. */
export type TutorialSceneScript = {
  id: string;
  /** Human label shown in the scene banner / top bar. */
  name: string;
  /**
   * Commands that build + enter this scene, parameterized by the loaded party
   * so the PC entity ids match the persisted character rows. Run once, in order,
   * when the scene is entered.
   */
  enter: (party: readonly PartyMemberLike[]) => Command[];
  /** Canned GM narration shown when this scene is entered (pre-written). */
  narration: string;
  /** World-entity names the entry narration references (@Entity chips, #96). */
  mentions?: readonly string[];
  /** Optional scripted check available while in this scene. */
  check?: TutorialCheck;
  /** Optional finale resolution (the Scene 6 multi-path relight, TUT-1, #175). */
  resolution?: TutorialResolution;
  /**
   * When set, this scene is a combat handoff: after its `enter` commands run,
   * the driver arms an encounter from the party-side characters present plus
   * these foes (the engine rolls initiative). Drives the async→Live combat
   * transition (D2) at the end of exploration.
   */
  combat?: {
    foes: readonly FoeSpec[];
    /** One cell per foe, parallel to `foes`. */
    foePositions: readonly GridPosition[];
  };
};

/**
 * A scripted NPC dialogue beat in a social scene (canned, LLM-free). The Scene 2
 * "soft rail" funnels every conversational path through these into the plot-hook
 * offer (D3b): the air-gapped backbone is deterministic, the LLM (when present)
 * only classifies free-text into one of these `topic`s.
 */
export type TutorialDialogueBeat = {
  /** Stable topic key the client/driver requests (e.g. "barnaby", "lily"). */
  topic: string;
  /** The NPC speaking, for the chat author/copy. */
  speaker: string;
  /** Pre-written GM narration for this beat. */
  text: string;
  /** Entity names this beat references (@Entity chips). */
  mentions?: readonly string[];
  /** When true, reaching this beat makes the scene's plot hook offerable. */
  offersHook?: boolean;
};

/** Where Mira starts on the Hollow's Edge road map. */
const HOLLOWS_EDGE_START: GridPosition = { x: 6, y: 8 };

/**
 * Row on the Hollow's Edge map (north = lower y) that counts as reaching the
 * village outskirts — triggers Scene 2 when the PC drags there (Scene 1 exit).
 */
export const TUTORIAL_SCENE1_VILLAGE_ROW = 5;

/** Whether the lead PC has moved far enough toward the village to leave Scene 1. */
export function tutorialScene1VillageReached(
  sceneId: string | undefined,
  position: GridPosition | undefined,
): boolean {
  return (
    sceneId === TUTORIAL_SCENE_HOLLOWS_EDGE &&
    position !== undefined &&
    position.y <= TUTORIAL_SCENE1_VILLAGE_ROW
  );
}

/** A few birches/cairns flanking the road, for atmosphere (block move + LoS). */
const HOLLOWS_EDGE_WALLS: GridPosition[] = [
  { x: 2, y: 2 },
  { x: 9, y: 2 },
  { x: 3, y: 5 },
  { x: 8, y: 6 },
];

/** Place the lead party member (Mira) onto a scene at a given cell. */
function placeLead(
  party: readonly PartyMemberLike[],
  sceneId: string,
  position: GridPosition,
): Command[] {
  const lead = party[0];
  if (!lead) return [];
  return [
    {
      type: "create_entity",
      entity: {
        id: lead.id,
        kind: "character",
        name: lead.name,
        abilityScores: lead.abilityScores,
        maxHp: lead.maxHp,
        baseAc: lead.baseAc,
        speed: lead.speed,
        classes: lead.classes,
        sceneId,
        position,
        ...(lead.spellcasting ? { spellcasting: lead.spellcasting } : {}),
      },
    },
  ];
}

/** Carry the already-created lead PC into a new scene (exploration transition). */
function relocateLead(
  party: readonly PartyMemberLike[],
  sceneId: string,
  position: GridPosition,
): Command[] {
  const lead = party[0];
  if (!lead) return [];
  return [{ type: "relocate_entity", entity: lead.id, sceneId, position }];
}

/**
 * Carry the companion (Old Brennar) into a new scene if he has joined. The
 * command no-ops in the engine when he isn't present (hook not yet accepted),
 * so it is always safe to include.
 */
function relocateCompanion(sceneId: string, position: GridPosition): Command[] {
  return [
    { type: "relocate_entity", entity: TUTORIAL_COMPANION.id, sceneId, position },
  ];
}

/** Stable entity ids for tutorial NPC tokens placed on exploration maps. */
export const TUTORIAL_NPC_BARNABY_ID = "npc:tut-barnaby";
export const TUTORIAL_NPC_LILY_ID = "npc:tut-lily";
export const TUTORIAL_NPC_TORIC_ID = "npc:tut-toric";
export const TUTORIAL_NPC_MARLOWE_ID = "npc:tut-marlowe";

/** Decorative statline for stationary social-scene NPCs (not combatants). */
const TUTORIAL_NPC_STATLINE = {
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  maxHp: 1,
  baseAc: 10,
  speed: 0,
} as const;

/** Place fixed NPC tokens when a tutorial scene is entered (exploration mode). */
export function createTutorialNpcCommands(
  sceneId: string,
  npcs: ReadonlyArray<{ id: string; name: string; position: GridPosition }>,
): Command[] {
  return npcs.map(({ id, name, position }) => ({
    type: "create_entity" as const,
    entity: {
      id,
      kind: "npc" as const,
      name,
      ...TUTORIAL_NPC_STATLINE,
      sceneId,
      position,
    },
  }));
}

/** Where the lead PC, companion, and NPC tokens belong in each exploration scene. */
export type TutorialScenePlacement = {
  lead: GridPosition;
  companion?: GridPosition;
  npcs: ReadonlyArray<{ id: string; name: string; position: GridPosition }>;
};

/** Token layout for a tutorial scene (exploration maps only). */
export function tutorialScenePlacement(
  sceneId: string,
): TutorialScenePlacement | undefined {
  switch (sceneId) {
    case TUTORIAL_SCENE_HOLLOWS_EDGE:
      return { lead: HOLLOWS_EDGE_START, npcs: [] };
    case TUTORIAL_SCENE_HEARTH:
      return {
        lead: HEARTH_START,
        companion: HEARTH_COMPANION_CELL,
        npcs: [
          {
            id: TUTORIAL_NPC_BARNABY_ID,
            name: "Barnaby Bramblefoot",
            position: { x: 2, y: 2 },
          },
          {
            id: TUTORIAL_NPC_LILY_ID,
            name: "Lily Lampmaker",
            position: { x: 8, y: 6 },
          },
        ],
      };
    case TUTORIAL_SCENE_CROOKED_LANE:
      return {
        lead: LANE_START,
        companion: LANE_COMPANION_CELL,
        npcs: [
          {
            id: TUTORIAL_NPC_TORIC_ID,
            name: "Toric Pennywhistle",
            position: { x: 8, y: 4 },
          },
        ],
      };
    case TUTORIAL_SCENE_SPIRE_LOWER:
      return {
        lead: SPIRE_LOWER_START,
        companion: SPIRE_LOWER_COMPANION_CELL,
        npcs: [],
      };
    case TUTORIAL_SCENE_SPIRE_UPPER:
      return {
        lead: SPIRE_UPPER_START,
        companion: SPIRE_UPPER_COMPANION_CELL,
        npcs: [
          {
            id: TUTORIAL_NPC_MARLOWE_ID,
            name: "Marlowe the Lampkeeper",
            position: { x: 3, y: 4 },
          },
        ],
      };
    default:
      return undefined;
  }
}

/**
 * Resolve the live lead PC entity id. Handles legacy seeds that used the
 * fixture id (`pc:mira`) before the persisted character row existed.
 */
export function resolveTutorialLeadEntityId(
  party: readonly PartyMemberLike[],
  entities: Readonly<Record<string, { id: string; kind: string; name: string }>>,
): string | undefined {
  const lead = party[0];
  if (!lead) return undefined;
  if (entities[lead.id]) return lead.id;
  const legacy = TUTORIAL_FALLBACK_PARTY[0]!.id;
  if (entities[legacy]) return legacy;
  return Object.values(entities).find(
    (e) =>
      e.kind === "character" &&
      e.id !== TUTORIAL_COMPANION.id &&
      e.name === lead.name,
  )?.id;
}

function partyMemberForLead(
  party: readonly PartyMemberLike[],
  leadEntityId: string,
): PartyMemberLike | undefined {
  return (
    party.find((m) => m.id === leadEntityId) ??
    (leadEntityId === TUTORIAL_FALLBACK_PARTY[0]!.id
      ? TUTORIAL_FALLBACK_PARTY[0]
      : party[0])
  );
}

function entityNeedsPlacement(
  entity:
    | { sceneId?: string; position?: GridPosition }
    | undefined,
  sceneId: string,
): boolean {
  return !entity || entity.sceneId !== sceneId || entity.position === undefined;
}

/**
 * Idempotent repair for exploration scenes: place the lead PC, carry the
 * companion, and create any missing NPC tokens for the current scene. Safe to
 * run after seed, advance, or reconnect when an older log skipped enter-commands.
 */
export function buildTutorialSceneRepairCommands(
  sceneId: string,
  party: readonly PartyMemberLike[],
  state: Pick<WorldState, "entities" | "encounter">,
): Command[] {
  if (state.encounter) return [];
  const placement = tutorialScenePlacement(sceneId);
  if (!placement) return [];

  const cmds: Command[] = [];
  const leadEntityId = resolveTutorialLeadEntityId(party, state.entities);

  if (leadEntityId) {
    const lead = state.entities[leadEntityId];
    if (entityNeedsPlacement(lead, sceneId)) {
      if (lead) {
        cmds.push({
          type: "relocate_entity",
          entity: leadEntityId,
          sceneId,
          position: placement.lead,
        });
      } else {
        const member = partyMemberForLead(party, leadEntityId);
        if (member) {
          cmds.push({
            type: "create_entity",
            entity: {
              id: leadEntityId,
              kind: "character",
              name: member.name,
              abilityScores: member.abilityScores,
              maxHp: member.maxHp,
              baseAc: member.baseAc,
              speed: member.speed,
              classes: member.classes,
              sceneId,
              position: placement.lead,
              ...(member.spellcasting
                ? { spellcasting: member.spellcasting }
                : {}),
            },
          });
        }
      }
    }
  } else if (party[0]) {
    cmds.push(...placeLead(party, sceneId, placement.lead));
  }

  if (placement.companion && state.entities[TUTORIAL_COMPANION.id]) {
    const companion = state.entities[TUTORIAL_COMPANION.id];
    if (entityNeedsPlacement(companion, sceneId)) {
      cmds.push({
        type: "relocate_entity",
        entity: TUTORIAL_COMPANION.id,
        sceneId,
        position: placement.companion,
      });
    }
  }

  for (const npc of placement.npcs) {
    const existing = state.entities[npc.id];
    if (!existing) {
      cmds.push(...createTutorialNpcCommands(sceneId, [npc]));
    } else if (entityNeedsPlacement(existing, sceneId)) {
      cmds.push({
        type: "relocate_entity",
        entity: npc.id,
        sceneId,
        position: npc.position,
      });
    }
  }

  return cmds;
}

/** The stable entity id of the tutorial's combat foe (the Hungering Shade). */
export const TUTORIAL_SHADE_ID = "npc:tut-shade";

/**
 * Where the Hungering Shade ambushes from — adjacent to Mira's stair cell, so it
 * bites on Round 1 and (when the driver scripts its disengage) provokes a real
 * Opportunity Attack from her.
 */
const SPIRE_STAIR_FOE_CELLS: readonly GridPosition[] = [{ x: 3, y: 8 }];

/**
 * The Scene 5 encounter foe: a single Hungering Shade, built from the shared
 * `MONSTER_TEMPLATE` (AC) so the bestiary stays the single source of truth. A
 * winnable first fight — enough HP for 3–5 rounds, never a real threat to a
 * Brennar-healed Mira.
 */
const TUTORIAL_STAIR_FOES: readonly FoeSpec[] = [
  (() => {
    const t = monsterTemplate("hungering-shade")!;
    return {
      id: TUTORIAL_SHADE_ID,
      name: t.name,
      abilityScores: t.abilityScores,
      maxHp: t.maxHp,
      baseAc: t.baseAc,
      speed: t.speed,
    };
  })(),
];

/**
 * The Scene 4 chest loot, claimed into Mira's inventory on a successful pick
 * (D4 scripted grant). Shared plain data: the engine fixture defines it; the
 * ws-server maps it onto `equipment` rows.
 */
export const TUTORIAL_CHEST_LOOT: readonly TutorialLootItem[] = [
  {
    name: "Scroll of Cure Wounds",
    quantity: 1,
    description: "A single-use spell scroll — casts Cure Wounds (1st level).",
  },
  {
    name: "Gold Pieces",
    quantity: 12,
    description: "A handful of coins from the spire chest.",
  },
];

/** Combat side ids the tutorial combat handoff uses (re-exported for the room). */
export const TUTORIAL_PARTY_SIDE = FIXTURE_BATTLE_PARTY_SIDE;
export const TUTORIAL_FOES_SIDE = FIXTURE_BATTLE_FOES_SIDE;

/**
 * The name of the scripted "best-outcome" relight item (D4). Single source of
 * truth shared by the Scene 3 grant (web `tutorial-shop`) and the Scene 6
 * consume path (ws-server), so the item round-trips under one name.
 */
export const TUTORIAL_OIL_NAME = "Oil of Brightness";

/**
 * The Scene 6 finale resolution (TUT-1, #175): four relight paths converging on
 * one resolution beat, the reputation note, the level-up notice + tooltip, and
 * the memory-pin demo. Defined before `TUTORIAL_SCRIPT` (referenced eagerly in
 * the Scene 6 entry, so it must precede it to avoid the temporal-dead-zone).
 */
export const TUTORIAL_RESOLUTION: TutorialResolution = {
  paths: [
    {
      id: "oil",
      prompt: "Use the Oil of Brightness on the lantern",
      consumesItem: TUTORIAL_OIL_NAME,
      text:
        "You pour Toric's Oil of Brightness over the cold wick and strike a " +
        "spark. The lantern catches in a brilliant white-gold blaze — far " +
        "brighter than any lamp has a right to be. Through the high window the " +
        "Hungering Forest visibly recoils, branches drawing back from the " +
        "village like a tide going out.",
    },
    {
      id: "flint",
      prompt: "Light it with Marlowe's flint and lamp oil",
      text:
        "You take up Marlowe's flint-and-cedar, feed the wick with the last of " +
        "his lamp oil, and strike. The lantern catches in a steady, warm gold. " +
        "It is enough: the dark at the village edge stops creeping closer and " +
        "holds, just out of reach.",
    },
    {
      id: "prayer",
      prompt: "Recite the Order's prayer (Religion)",
      text:
        "\"Cedar to the flame, flame to the dark, dark to the deep,\" you say, " +
        "and the old words seem to find their place. The wick takes light on " +
        "the final word and burns with a clean, blessed steadiness — Brennar " +
        "looks up sharply, then bows his head. The Order's lantern remembers " +
        "its purpose.",
      check: {
        ability: "int",
        skill: "Religion",
        dc: 10,
        proficient: false,
        failureText:
          "The prayer falters on your tongue — the words are not yours to carry. " +
          "No matter: you feed the wick with Marlowe's lamp oil and strike his " +
          "flint, and the lantern catches in a steady, warm gold. It is enough.",
      },
    },
    {
      id: "improv",
      prompt: "Try something else",
      text:
        "You improvise — coaxing the flame your own way — and against the odds " +
        "the wick catches and holds in a steady, warm gold. Brennar raises an " +
        "eyebrow, then nods. However it is done, the lantern is lit, and the " +
        "dark at the village edge stops creeping closer.",
    },
  ],
  resolution:
    "Light pours from the lantern in a slow, even tide, and far below the " +
    "forest pulls back from the village edge — not far, but enough. Brennar " +
    "exhales for the first time in hours. \"Marlowe would have wanted you to " +
    "keep his flint,\" he says. \"He'd have wanted someone besides us to " +
    "remember him.\" The hook is resolved; Last Light Hollow is in your debt; " +
    "and the night's work has earned you enough to grow stronger.",
  reputationNote:
    "Reputation with Last Light Hollow: Honored — the village will not forget " +
    "the night the lantern was relit.",
  levelUp: {
    notice:
      "You've earned enough experience to reach Level 4. The Level-Up Wizard " +
      "is waiting on your character sheet whenever you're ready.",
    tooltipTitle: "Mira leveled up.",
    tooltipBody:
      "In a normal campaign you'd open the Level-Up Wizard to pick new " +
      "features. We'll skip that for the tutorial — but it lives on your " +
      "character sheet anytime you're ready to advance.",
  },
  memory: {
    text:
      "Lily is waiting at the spire's base when you descend. She knows — she " +
      "knew before you came down. She presses her father's iron key into your " +
      "hand and refuses to take it back.",
    mentions: ["Lily Lampmaker"],
    pinSuggestion: "Lily gave me her father's key.",
  },
};

/** A relight path by id within the Scene 6 resolution, or undefined. */
export function tutorialRelightPath(
  id: string,
): TutorialRelightPath | undefined {
  return TUTORIAL_RESOLUTION.paths.find((p) => p.id === id);
}

/* ------------------------------------------------------------------------- *
 *  Scene 7 — wrap & handoff: graduation + achievements (TUT-1, #176)
 * ------------------------------------------------------------------------- */

/**
 * Stable ids for the two tutorial achievements (TUT-1, D8 — the only two kept;
 * the full achievement system is out of v1 scope). Persisted per user as a
 * `tutorial_achievements` row and surfaced in the graduation modal.
 */
export const TUTORIAL_ACHIEVEMENT_FIRST_STEPS = "first-steps";
export const TUTORIAL_ACHIEVEMENT_FIRST_LIGHT = "first-light";

/** A tutorial achievement badge — display copy shared by the unlock + the modal. */
export type TutorialAchievement = {
  /** Stable id persisted per user (the `achievement_id` row value). */
  id: string;
  /** Badge title shown in the graduation modal. */
  title: string;
  /** One-line "what you did" description. */
  description: string;
  /** When this badge unlocks (the trigger, for copy). */
  unlockedWhen: string;
  /** Decorative glyph. */
  icon: string;
};

/**
 * The two tutorial achievements (TUT-1, §10): **First Steps** unlocks when the
 * player accepts the central plot hook in Scene 2; **First Light** unlocks on
 * tutorial completion (Scene 7). Both appear in the graduation modal.
 */
export const TUTORIAL_ACHIEVEMENTS: readonly TutorialAchievement[] = [
  {
    id: TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
    title: "First Steps",
    description:
      "You took up the lantern's cause and set out into the Hollow.",
    unlockedWhen: "Accepted your first plot hook (Scene 2)",
    icon: "🥾",
  },
  {
    id: TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
    title: "First Light",
    description:
      "You relit the great lantern and finished The Lantern's Last Flicker.",
    unlockedWhen: "Completed the tutorial",
    icon: "🪔",
  },
];

/** A tutorial achievement by id, or undefined if it isn't one of the two. */
export function tutorialAchievement(
  id: string,
): TutorialAchievement | undefined {
  return TUTORIAL_ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * The Scene 7 wrap (TUT-1, #176). Not an engine scene (no map / no encounter) —
 * it is the closing GM beat posted to chat plus the *static* graduation recap
 * (D8: no social-share generator in v1). Single source of truth shared by the
 * ws-server (the closing narration) and the web graduation modal (the recap).
 */
export type TutorialWrap = {
  /** The closing GM narration (the walk home at dawn). */
  narration: string;
  /** The engine-style "session complete" summary line posted under it. */
  sessionComplete: string;
  /** Graduation modal heading. */
  title: string;
  /** Graduation modal sub-heading (the "complete" stamp copy). */
  subtitle: string;
  /** The "in this session you used:" feature checklist (the static recap). */
  used: readonly string[];
  /** Closing paragraph in the modal (where the played content now lives). */
  closing: string;
};

/** The Scene 7 wrap copy (TUT-1, #176; `tutorial-adventure.md` §3 Scene 7). */
export const TUTORIAL_WRAP: TutorialWrap = {
  narration:
    "The forest is dark, but it is only dark. Brennar walks beside you, his " +
    "staff tapping the wet road, and he won't say goodbye — he's only walking " +
    "slower than he should. In the east, you can almost see morning. The " +
    "Lantern's Last Flicker is over; the lantern burns again behind you.",
  sessionComplete:
    "Session 1 complete — the lantern burns again, the hook is resolved, and " +
    "Mira has grown stronger.",
  title: "The Lantern's Last Flicker",
  subtitle: "Complete",
  used: [
    "Live AI-GM narration",
    "Skill checks with real dice",
    "Inline chips for people, places & items",
    "Always-on map with tokens",
    "A companion who plays themselves",
    "A shop and a granted item",
    "Inventory and item use",
    "Tier-4 combat with reactions",
    "The plot-hook lifecycle",
    "Leveling up",
    "Pinning facts to memory",
    "Multiple outcome paths",
  ],
  closing:
    "Everything you just played is now in your Campaigns list and Realms " +
    "library — you can re-explore it anytime. Where would you like to go next?",
};

/**
 * The ordered tutorial scene graph. Index order *is* the progression order:
 * the driver advances from the scene matching the current `currentSceneId` to
 * the next entry. Adding scenes 2–7 is appending entries here.
 */
export const TUTORIAL_SCRIPT: readonly TutorialSceneScript[] = [
  {
    id: TUTORIAL_SCENE_HOLLOWS_EDGE,
    name: "The Hollow's Edge",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_HOLLOWS_EDGE,
          name: "The Hollow's Edge",
          description:
            "A rain-wet road through silver birches at the edge of Last Light Hollow; the spire's great lantern is dark.",
          map: { width: 12, height: 10, blockedCells: HOLLOWS_EDGE_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_HOLLOWS_EDGE },
      ...placeLead(party, TUTORIAL_SCENE_HOLLOWS_EDGE, HOLLOWS_EDGE_START),
    ],
    narration:
      "The road bends one last time through silver birches and you see it — " +
      "Last Light Hollow, half a dozen roofs huddled around a tall stone spire. " +
      "The spire's great lantern is dark. Rain finds its way through your cloak, " +
      "and behind you the forest sounds different than it did an hour ago. " +
      "You carry a sealed message for someone here, and the daylight is going fast. " +
      "What do you do?",
    check: {
      ability: "wis",
      skill: "Survival",
      dc: 12,
      proficient: true,
      prompt: "Look for tracks (Survival, DC 12)",
      successText:
        "You kneel by the verge: a wolf's paw print, fresh in the mud, far too " +
        "large for any wolf. Something has been pacing the treeline. The chill " +
        "down your spine is a warning, and a gift.",
      failureText:
        "Rain has chewed the road to a smear of mud and runoff; whatever passed " +
        "this way has left you nothing certain. Still — the forest is too quiet.",
    },
  },
  {
    id: TUTORIAL_SCENE_HEARTH,
    name: "The Hearth and Hemlock",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_HEARTH,
          name: "The Hearth and Hemlock",
          description:
            "The village tavern: a low-beamed common room, a banked hearth, and rain drumming on the slate roof. Barnaby works the bar; Lily sits alone in the corner.",
          map: { width: 10, height: 8, blockedCells: HEARTH_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_HEARTH },
      // The PC already exists (created in Scene 1) — carry her into the tavern.
      ...relocateLead(party, TUTORIAL_SCENE_HEARTH, HEARTH_START),
      ...createTutorialNpcCommands(TUTORIAL_SCENE_HEARTH, [
        {
          id: TUTORIAL_NPC_BARNABY_ID,
          name: "Barnaby Bramblefoot",
          position: { x: 2, y: 2 },
        },
        {
          id: TUTORIAL_NPC_LILY_ID,
          name: "Lily Lampmaker",
          position: { x: 8, y: 6 },
        },
      ]),
    ],
    narration:
      "Warm air rolls out as you push open the heavy door — hearth-smoke, mulled " +
      "wine, the slow drum of rain on the slate roof. Behind the bar, Barnaby " +
      "Bramblefoot looks up from polishing a pewter mug. At a corner table sits a " +
      "young woman — Lily Lampmaker — alone, and by the look of her she has been " +
      "crying. A sealed letter lies untouched at her elbow. " +
      "Tap a highlighted name to see what you know about them.",
    mentions: ["Barnaby Bramblefoot", "Lily Lampmaker"],
  },
  {
    id: TUTORIAL_SCENE_CROOKED_LANE,
    name: "The Crooked Lane",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_CROOKED_LANE,
          name: "The Crooked Lane",
          description:
            "A single dirt road through the village toward the dark spire. A small shopfront — Tinker's Mercy — has its door wedged open against the rain.",
          map: { width: 10, height: 8, blockedCells: LANE_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_CROOKED_LANE },
      // Carry the party (PC + companion, if he joined) up the lane.
      ...relocateLead(party, TUTORIAL_SCENE_CROOKED_LANE, LANE_START),
      ...relocateCompanion(TUTORIAL_SCENE_CROOKED_LANE, LANE_COMPANION_CELL),
      ...createTutorialNpcCommands(TUTORIAL_SCENE_CROOKED_LANE, [
        {
          id: TUTORIAL_NPC_TORIC_ID,
          name: "Toric Pennywhistle",
          position: { x: 8, y: 4 },
        },
      ]),
    ],
    narration:
      "You start up the lane toward the spire. Halfway along you pass a small " +
      "shopfront — a hand-painted sign reads Tinker's Mercy, and the door is " +
      "wedged open with a brick despite the rain. Inside, a stooped old gnome is " +
      "closing up. He sees you, hesitates, then jerks his head: come in, come in. " +
      "Do you stop?",
    mentions: ["Tinker's Mercy"],
  },
  {
    id: TUTORIAL_SCENE_SPIRE_LOWER,
    name: "The Lantern Spire · Lower Hall",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_SPIRE_LOWER,
          name: "The Lantern Spire · Lower Hall",
          description:
            "Inside the sealed spire: one round chamber of cold stone, the dark great lantern in a glass cage, and bloody fingertip drags leading to the foot of the spiral stair. A small iron chest sits in the corner.",
          map: { width: 10, height: 8, blockedCells: SPIRE_LOWER_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_SPIRE_LOWER },
      ...relocateLead(party, TUTORIAL_SCENE_SPIRE_LOWER, SPIRE_LOWER_START),
      ...relocateCompanion(TUTORIAL_SCENE_SPIRE_LOWER, SPIRE_LOWER_COMPANION_CELL),
    ],
    narration:
      "The lock turns with Lily's key and the door groans inward. The great " +
      "lantern is silent in its glass cage — black wick, no flame. Bloody " +
      "fingertip drags lead from the door to the foot of the spiral stair. " +
      "Brennar lowers his staff and says nothing. A small iron chest sits in the " +
      "corner, its lock old and stubborn. What do you do?",
    mentions: ["The Lantern Spire", "Marlowe the Lampkeeper"],
    check: {
      ability: "dex",
      skill: "Thieves' Tools",
      dc: 13,
      proficient: false,
      prompt: "Pick the lock (Thieves' Tools, DC 13)",
      helpPrompt: "Accept Brennar's Help (Advantage)",
      successText:
        "The old tumblers give with a soft click. Inside: a small pile of coins " +
        "and a sealed scroll, its wax stamped with a healer's mark. You pocket " +
        "both.",
      failureText:
        "The pick skitters and the lock holds. Whatever's inside stays locked — " +
        "no matter; the stair is the way on.",
      loot: TUTORIAL_CHEST_LOOT,
    },
  },
  {
    id: TUTORIAL_SCENE_SPIRE_STAIR,
    name: "The Lantern Spire · The Stair",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_SPIRE_STAIR,
          name: "The Lantern Spire · The Stair",
          description:
            "The spiral stair winds up into the dark. Something has been waiting in it — shapes of living shadow peel away from the wall and drop toward you.",
          map: { width: 12, height: 10, blockedCells: SPIRE_STAIR_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_SPIRE_STAIR },
      ...relocateLead(party, TUTORIAL_SCENE_SPIRE_STAIR, SPIRE_STAIR_START),
      ...relocateCompanion(TUTORIAL_SCENE_SPIRE_STAIR, SPIRE_STAIR_COMPANION_CELL),
      ...TUTORIAL_STAIR_FOES.map((f, i): Command => ({
        type: "create_entity",
        entity: {
          id: f.id,
          kind: "monster",
          name: f.name,
          abilityScores: f.abilityScores,
          maxHp: f.maxHp,
          baseAc: f.baseAc,
          speed: f.speed,
          sceneId: TUTORIAL_SCENE_SPIRE_STAIR,
          position: SPIRE_STAIR_FOE_CELLS[i]!,
        },
      })),
    ],
    narration:
      "Something peels away from the dark of the stair — a shape of living " +
      "shadow, cold pouring off it. \"Stay close,\" Brennar breathes, lifting his " +
      "holy symbol. Roll for initiative — the engine takes it from here.",
    combat: { foes: TUTORIAL_STAIR_FOES, foePositions: SPIRE_STAIR_FOE_CELLS },
  },
  {
    id: TUTORIAL_SCENE_SPIRE_UPPER,
    name: "The Lantern Spire · Upper Chamber",
    enter: (party) => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_SPIRE_UPPER,
          name: "The Lantern Spire · Upper Chamber",
          description:
            "The top of the spire: a cold round room, the great lantern dark on its pedestal, and Marlowe the Lampkeeper still beside it. The shade is gone; the silence is enormous.",
          map: { width: 10, height: 8, blockedCells: SPIRE_UPPER_WALLS },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_SPIRE_UPPER },
      ...relocateLead(party, TUTORIAL_SCENE_SPIRE_UPPER, SPIRE_UPPER_START),
      ...relocateCompanion(TUTORIAL_SCENE_SPIRE_UPPER, SPIRE_UPPER_COMPANION_CELL),
      ...createTutorialNpcCommands(TUTORIAL_SCENE_SPIRE_UPPER, [
        {
          id: TUTORIAL_NPC_MARLOWE_ID,
          name: "Marlowe the Lampkeeper",
          position: { x: 3, y: 4 },
        },
      ]),
    ],
    narration:
      "The cold leaves the room in a single, silent rush. At the top of the spire " +
      "the great lantern stands dark on its pedestal, and Marlowe the Lampkeeper " +
      "lies beside it, still. Brennar kneels and closes the old man's eyes. " +
      "\"Light it however you can,\" he says quietly. \"The Order's prayer was " +
      "'cedar to the flame, flame to the dark, dark to the deep.' But I think any " +
      "light will do.\" You have Marlowe's flint-and-cedar, the last of his lamp " +
      "oil — and, if you took it, Toric's Oil of Brightness. How do you light it?",
    mentions: ["Marlowe the Lampkeeper", "The Lantern Spire"],
    resolution: TUTORIAL_RESOLUTION,
  },
];

/** Where Mira stands when she enters the tavern. */
const HEARTH_START: GridPosition = { x: 5, y: 6 };

/** The bar + a few tables, blocking movement (atmosphere only in this slice). */
const HEARTH_WALLS: GridPosition[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 7, y: 5 },
  { x: 8, y: 2 },
];

/** Where Old Brennar appears when he joins the party (beside Mira). */
const HEARTH_COMPANION_CELL: GridPosition = { x: 6, y: 6 };

/** Scene 3 (Crooked Lane) layout: the road, the PC, and the companion. */
const LANE_START: GridPosition = { x: 4, y: 6 };
const LANE_COMPANION_CELL: GridPosition = { x: 5, y: 6 };
const LANE_WALLS: GridPosition[] = [
  { x: 1, y: 2 },
  { x: 8, y: 2 },
  { x: 2, y: 5 },
  { x: 7, y: 4 },
];

/** Scene 4 (Spire Lower Hall) layout: the round chamber, the lantern, the chest. */
const SPIRE_LOWER_START: GridPosition = { x: 4, y: 6 };
const SPIRE_LOWER_COMPANION_CELL: GridPosition = { x: 5, y: 6 };
const SPIRE_LOWER_WALLS: GridPosition[] = [
  { x: 4, y: 3 }, // the glass lantern cage, centre
  { x: 5, y: 3 },
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 0, y: 7 },
  { x: 9, y: 7 },
];

/** Scene 5 (the Stair) combat layout: party low, the shade ambushing from it. */
const SPIRE_STAIR_START: GridPosition = { x: 2, y: 8 };
const SPIRE_STAIR_COMPANION_CELL: GridPosition = { x: 2, y: 6 };
const SPIRE_STAIR_WALLS: GridPosition[] = [
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 7 },
  { x: 6, y: 8 },
];

/** Scene 6 (Upper Chamber) layout: the pedestal/lantern, the PC, the companion. */
const SPIRE_UPPER_START: GridPosition = { x: 4, y: 6 };
const SPIRE_UPPER_COMPANION_CELL: GridPosition = { x: 5, y: 6 };
const SPIRE_UPPER_WALLS: GridPosition[] = [
  { x: 4, y: 3 }, // the lantern pedestal, centre
  { x: 5, y: 3 },
];

/** The first scene's id — what a freshly-seeded tutorial starts on. */
export const TUTORIAL_FIRST_SCENE_ID = TUTORIAL_SCRIPT[0]!.id;

/** The scene that follows `id` in the script, or undefined at the end. */
export function nextTutorialScene(
  id: string | undefined,
): TutorialSceneScript | undefined {
  const idx = TUTORIAL_SCRIPT.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  return TUTORIAL_SCRIPT[idx + 1];
}

/** The script entry for a scene id, or undefined if it isn't a tutorial scene. */
export function tutorialScene(
  id: string | undefined,
): TutorialSceneScript | undefined {
  return TUTORIAL_SCRIPT.find((s) => s.id === id);
}

/**
 * Build the seed command list for a fresh tutorial (the first scene), placing
 * the loaded party. Mirrors {@link buildPartyBattleCommands} as the room's
 * `seedCommands()` source so the reset baseline is recomputable.
 */
export function buildTutorialSeedCommands(
  party: readonly PartyMemberLike[],
): Command[] {
  return TUTORIAL_SCRIPT[0]!.enter(party);
}

/**
 * A deterministic fallback PC used to seed the tutorial when no persisted roster
 * is available (tests, or a race before the character row is created). Mira
 * Thornwood — Level 3 Half-Elf Ranger — per `tutorial-adventure.md` §2.1.
 */
export const TUTORIAL_FALLBACK_PARTY: readonly PartyMemberLike[] = [
  {
    id: "pc:mira",
    name: "Mira Thornwood",
    abilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 },
    maxHp: 27,
    baseAc: 14,
    speed: 30,
    classes: [{ class: "Ranger", level: 3, subclass: "Hunter" }],
    spellcasting: { ability: "wis", casterLevel: 3 },
  },
];

/** The lead PC's display name, for copy that references Mira directly. */
export const TUTORIAL_PC_NAME = TUTORIAL_FALLBACK_PARTY[0]!.name;

/* ------------------------------------------------------------------------- *
 *  Scene 2 — social play: dialogue beats, plot hook, companion (#171)
 * ------------------------------------------------------------------------- */

/**
 * The central plot hook offered in Scene 2. Seeded as a real campaign
 * `plot_hooks` row (suggested) at tutorial start and flipped to active on accept
 * (D4) — these are its display fields, shared by the seed + the offer card.
 */
export const TUTORIAL_HOOK = {
  title: "The Lantern's Last Flicker",
  summary:
    "Find Marlowe the Lampkeeper inside the sealed Lantern Spire and re-ignite " +
    "the great lantern before the Hungering Forest reaches the village.",
} as const;

/**
 * Scene 2's canned NPC dialogue beats, keyed by topic. The "soft rail": every
 * conversational path resolves to one of these and ultimately to Lily, whose
 * beat offers the hook. Pre-written so the scene plays with no LLM configured.
 */
export const TUTORIAL_SCENE2_BEATS: readonly TutorialDialogueBeat[] = [
  {
    topic: "barnaby",
    speaker: "Barnaby Bramblefoot",
    text:
      "Barnaby sets down the mug. \"Cold night for the road, friend. You'll be " +
      "wanting the lantern question, like everyone.\" He lowers his voice. \"It " +
      "went dark three nights back. Keeper never came down. And that one—\" he " +
      "nods at the corner \"—that's Lily. Her father went up after him. Go easy. " +
      "She's the only one still willing to talk about it.\"",
    mentions: ["Lily Lampmaker"],
  },
  {
    topic: "lily",
    speaker: "Lily Lampmaker",
    text:
      "Lily's eyes are red. \"You're not from here. Good — folk here have given " +
      "up. Three nights ago my father went up the Lantern Spire to relight it. " +
      "He hasn't come back. The mayor says the door's sealed by the Order's " +
      "wards. He's lying — the wards only seal out.\" She slides a small iron " +
      "key across the table. \"If anyone with a hand on the bow could find him… " +
      "we'd all be in your debt.\"",
    mentions: ["Marlowe the Lampkeeper", "The Lantern Spire"],
    offersHook: true,
  },
];

/** Topics the soft rail can resolve free text / drawer actions to. */
export type Scene2Topic = "barnaby" | "lily";

/**
 * Map a free-text player line to the Scene 2 dialogue topic it should trigger
 * (the air-gapped fallback for the LLM intent classifier, D3b). Barnaby keywords
 * route to Barnaby; *everything else* — including trying to leave — funnels to
 * Lily, the quest-giver, so the hook is always reachable (the soft rail).
 */
export function classifyScene2Topic(text: string): Scene2Topic {
  const t = text.toLowerCase();
  if (/\b(barnaby|bar|barman|innkeep|keeper of the inn|drink|ale|stew|food|room)\b/.test(t)) {
    return "barnaby";
  }
  return "lily";
}

/** The dialogue beat for a topic, or undefined if it isn't a Scene 2 topic. */
export function tutorialBeat(topic: string): TutorialDialogueBeat | undefined {
  return TUTORIAL_SCENE2_BEATS.find((b) => b.topic === topic);
}

/**
 * Old Brennar — Level 2 Human Cleric (Life), the companion NPC who joins in
 * Scene 2 (`tutorial-adventure.md` §2.2). Modelled as a party-side *character*
 * entity so he rides along in the party rail and (later) takes his own turns.
 */
export const TUTORIAL_COMPANION: PartyMemberLike = {
  id: "npc:brennar",
  name: "Old Brennar",
  abilityScores: { str: 11, dex: 10, con: 12, int: 10, wis: 15, cha: 13 },
  maxHp: 17,
  baseAc: 13,
  speed: 30,
  classes: [{ class: "Cleric", level: 2, subclass: "Life" }],
  spellcasting: { ability: "wis", casterLevel: 2 },
};

/**
 * Commands that bring Old Brennar into a scene as a party-side character entity
 * (the engine half of "companion joins"; the DB membership row is owned by the
 * tutorial tRPC router, D4). Idempotent at the room level — the driver only runs
 * it when he isn't already present.
 */
export function buildCompanionCommands(
  sceneId: string,
  position: GridPosition = HEARTH_COMPANION_CELL,
): Command[] {
  const c = TUTORIAL_COMPANION;
  return [
    {
      type: "create_entity",
      entity: {
        id: c.id,
        kind: "character",
        name: c.name,
        abilityScores: c.abilityScores,
        maxHp: c.maxHp,
        baseAc: c.baseAc,
        speed: c.speed,
        classes: c.classes,
        sceneId,
        position,
        ...(c.spellcasting ? { spellcasting: c.spellcasting } : {}),
      },
    },
  ];
}

/* ------------------------------------------------------------------------- *
 *  Scene hints + fail-forward rails (TUT-1, #178, D3/D6)
 * ------------------------------------------------------------------------- */

/** Per-scene idle hint copy (scripted, LLM-free). */
export type TutorialSceneHint = {
  /** Suggested actions shown in the "Stuck?" chip. */
  suggestions: readonly string[];
  /** GM narration posted after 3 dismissed hints (gentle auto-progress). */
  autoProgressNarration: string;
};

/** Idle-hint data keyed by scene id (`docs/onboarding/tutorial-adventure.md` §7). */
export const TUTORIAL_SCENE_HINTS: Readonly<
  Record<string, TutorialSceneHint>
> = {
  [TUTORIAL_SCENE_HOLLOWS_EDGE]: {
    suggestions: ["Click Continue to follow the road into the village."],
    autoProgressNarration:
      "The warm glow of tavern windows draws you down the path toward Last Light Hollow.",
  },
  [TUTORIAL_SCENE_HEARTH]: {
    suggestions: [
      "Talk to Barnaby at the bar, or speak with Lily in the corner.",
      "Accept the hook once Lily offers it.",
    ],
    autoProgressNarration:
      "As you turn to go, Lily calls after you, voice cracking — \"Wait. Please.\"",
  },
  [TUTORIAL_SCENE_CROOKED_LANE]: {
    suggestions: [
      "Visit Toric's shop for a gift, or open your inventory drawer.",
      "Click Continue when you're ready to head for the spire.",
    ],
    autoProgressNarration:
      "Old Brennar hefts his pack. \"The spire won't wait forever, Mira.\"",
  },
  [TUTORIAL_SCENE_SPIRE_LOWER]: {
    suggestions: [
      "Search the chest — Brennar can Help on the lock for advantage.",
      "Click Continue once you've claimed the loot.",
    ],
    autoProgressNarration:
      "Brennar's lantern sweeps the stairwell. \"Up — before the dark notices us.\"",
  },
  [TUTORIAL_SCENE_SPIRE_STAIR]: {
    suggestions: [
      "Attack the Hungering Shade when it's your turn.",
      "Watch for the Opportunity Attack prompt when it flees.",
    ],
    autoProgressNarration:
      "The Shade hisses — but Brennar steadies your bow. \"Now, Mira. Finish it.\"",
  },
  [TUTORIAL_SCENE_SPIRE_UPPER]: {
    suggestions: [
      "Choose a way to relight the lantern: Oil, flint, prayer, or improv.",
    ],
    autoProgressNarration:
      "The cold pedestal waits. Brennar murmurs, \"However you do it — do it now.\"",
  },
};

/** Lookup scripted idle hints for a scene, or undefined when none apply. */
export function tutorialHintForScene(
  sceneId: string | undefined,
): TutorialSceneHint | undefined {
  if (!sceneId) return undefined;
  return TUTORIAL_SCENE_HINTS[sceneId];
}

/** GM copy when the player attacks a friendly NPC (fail-forward, §8). */
export const TUTORIAL_ATTACK_ALLY_DEFLECT =
  "I'm not your enemy, friend. Put it down — save it for what's waiting in the dark.";

/** GM copy when the player tries to leave mid-tutorial (soft rail, §8). */
export const TUTORIAL_LEAVE_VILLAGE_RAIL =
  "A weathered voice calls after you from the inn steps. \"You're on the lantern road now, " +
  "ranger — the village needs someone who won't turn back at the first shadow.\"";

/** Whether free-text looks like the player is trying to bail on the tutorial. */
export function classifyTutorialLeaveIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(leave|turn back|head back|go back|ride out|go home|return home)\b/.test(
    t,
  );
}

/**
 * Classify free-text in Scene 6 into a relight path id (fail-forward, #178).
 * Returns null when the line does not look like lighting the lantern.
 */
export function classifyTutorialRelightIntent(text: string): TutorialRelightPathId | null {
  const t = text.toLowerCase();
  const lighting =
    /\b(light|lit|lantern|wick|flame|ignite|kindle|spark|burn)\b/.test(t);
  if (!lighting) return null;
  if (/\b(oil|brightness|toric)\b/.test(t)) return "oil";
  if (/\b(prayer|cedar to the flame|religion|order'?s)\b/.test(t)) return "prayer";
  if (/\b(flint|lamp oil|marlowe|cedar)\b/.test(t)) return "flint";
  return "improv";
}

/**
 * True when `target` is a friendly the player must not harm (companion / NPC).
 * Monsters (the Shade) are never friendly fire.
 */
export function isTutorialFriendlyFireTarget(
  target: { id: string; kind: string },
  attackerId: string,
): boolean {
  if (target.id === attackerId) return false;
  if (target.kind === "monster") return false;
  if (target.id === TUTORIAL_COMPANION.id) return true;
  // Any other character entity in the tutorial is an NPC ally.
  return target.kind === "character";
}

/** Canned GM fallback when the LLM is unavailable or fails (air-gapped-safe). */
export function tutorialChatFallback(
  sceneId: string | undefined,
  text: string,
): string {
  if (sceneId === TUTORIAL_SCENE_HEARTH) {
    const topic = classifyScene2Topic(text);
    const beat = TUTORIAL_SCENE2_BEATS.find((b) => b.topic === topic);
    if (beat) return beat.text;
  }
  if (sceneId === TUTORIAL_SCENE_HOLLOWS_EDGE && classifyTutorialLeaveIntent(text)) {
    return TUTORIAL_LEAVE_VILLAGE_RAIL;
  }
  return (
    "The lantern's glow holds steady. When you're ready, use the scene controls " +
    "or Continue to move the story forward."
  );
}
