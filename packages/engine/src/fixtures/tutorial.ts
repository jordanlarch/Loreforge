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
import type { PartyMember } from "./battle";

/**
 * The party shape the tutorial script needs to place a PC — exactly
 * {@link PartyMember} (id + statline + optional spellcasting). Aliased so the
 * driver and tests can import a tutorial-named type from one place.
 */
export type PartyMemberLike = PartyMember;

/** Stable scene ids for the tutorial (referenced by the driver + tests). */
export const TUTORIAL_SCENE_HOLLOWS_EDGE = "scene:tut-hollows-edge";
export const TUTORIAL_SCENE_HEARTH_STUB = "scene:tut-hearth";

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
  /** Optional scripted check available while in this scene. */
  check?: TutorialCheck;
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
    id: TUTORIAL_SCENE_HEARTH_STUB,
    name: "The Hearth and Hemlock",
    enter: () => [
      {
        type: "create_scene",
        scene: {
          id: TUTORIAL_SCENE_HEARTH_STUB,
          name: "The Hearth and Hemlock",
          description:
            "Warm hearth-smoke and the slow drum of rain on a slate roof. (Tutorial scene 2 — fuller content lands in a later slice.)",
          map: { width: 10, height: 8, blockedCells: [] },
        },
      },
      { type: "change_scene", sceneId: TUTORIAL_SCENE_HEARTH_STUB },
    ],
    narration:
      "Warm air rolls out as you push open the heavy tavern door — hearth-smoke, " +
      "mulled wine, the drum of rain on the roof. The room quiets as you enter. " +
      "(Your tutorial continues here in a later chapter.)",
  },
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
