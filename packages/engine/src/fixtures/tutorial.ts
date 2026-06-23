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

/** Where the Scene 5 shadows stand on the stair (parallel to the foe list). */
const SPIRE_STAIR_FOE_CELLS: readonly GridPosition[] = [
  { x: 8, y: 2 },
  { x: 9, y: 4 },
];

/**
 * The shadow creatures that ambush the party on the stair (Scene 5). A pair of
 * low-HP foes — a winnable first fight that demonstrates the combat loop with
 * the companion. Full Scene 5 polish (narration, AI tuning) is a later slice.
 */
const TUTORIAL_STAIR_FOES: readonly FoeSpec[] = [
  {
    id: "npc:tut-shadow-a",
    name: "Gloom Shade",
    abilityScores: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
    maxHp: 9,
    baseAc: 12,
    speed: 30,
  },
  {
    id: "npc:tut-shadow-b",
    name: "Gloom Shade",
    abilityScores: { str: 6, dex: 14, con: 13, int: 6, wis: 10, cha: 8 },
    maxHp: 9,
    baseAc: 12,
    speed: 30,
  },
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
      "Shadows pour down the stair. \"Stay close,\" Brennar breathes, lifting his " +
      "holy symbol. Roll for initiative — the engine takes it from here.",
    combat: { foes: TUTORIAL_STAIR_FOES, foePositions: SPIRE_STAIR_FOE_CELLS },
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

/** Scene 5 (the Stair) combat layout: party low, shadows high on the stair. */
const SPIRE_STAIR_START: GridPosition = { x: 2, y: 8 };
const SPIRE_STAIR_COMPANION_CELL: GridPosition = { x: 2, y: 6 };
const SPIRE_STAIR_WALLS: GridPosition[] = [
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 7 },
  { x: 6, y: 8 },
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
