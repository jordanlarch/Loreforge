/**
 * Fixture battle — a ready-to-render combat encounter.
 *
 * Like {@link buildFixtureCampaign}, the world state is produced by driving real
 * commands through the engine (scene + entities + encounter + initiative), so it
 * exercises the event → projection path rather than being hand-built. It backs
 * the sandbox battle map at `/campaigns/sandbox/play` (#16): two PCs versus two
 * goblins on a small mapped grid, initiative already rolled.
 *
 * The command list is exported so the play surface can re-simulate the encounter
 * with a player's drag-to-move commands appended (a deterministic, no-persistence
 * session source). Replaced by real per-campaign state + Yjs sync in #14.
 */
import { Engine } from "../engine";
import type {
  AttackCommand,
  Command,
  EndTurnCommand,
  MoveEntityCommand,
} from "../commands/types";
import type { EntityRef, GridPosition } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import { FIXTURE_CHARACTERS } from "./party";

/** Stable seed/campaign id; the RNG (initiative) is keyed off this. */
export const FIXTURE_BATTLE_CAMPAIGN_ID = "fixture:goblin-ambush";

export const FIXTURE_BATTLE_SCENE_ID = "scene:ambush";

const THORIN = FIXTURE_CHARACTERS[0]!;
const ELARA = FIXTURE_CHARACTERS[1]!;

export const FIXTURE_BATTLE_PARTY_SIDE = "party";
export const FIXTURE_BATTLE_FOES_SIDE = "foes";

/** A short pillar wall down the middle with a gap, to make movement interesting. */
const WALLS: GridPosition[] = [
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 7 },
  { x: 6, y: 8 },
];

/**
 * The ordered command list that builds the encounter. Exported so callers can
 * append `move_entity` commands and replay the whole batch deterministically.
 */
export const FIXTURE_BATTLE_COMMANDS: Command[] = [
  {
    type: "create_scene",
    scene: {
      id: FIXTURE_BATTLE_SCENE_ID,
      name: "Salt Way Ambush",
      description: "A muddy stretch of road, goblins lurking behind cairns.",
      map: { width: 12, height: 10, blockedCells: WALLS },
    },
  },
  { type: "change_scene", sceneId: FIXTURE_BATTLE_SCENE_ID },
  {
    type: "create_entity",
    entity: {
      id: THORIN.id,
      kind: "character",
      name: THORIN.name,
      abilityScores: THORIN.abilityScores,
      maxHp: THORIN.maxHp,
      baseAc: THORIN.baseAc,
      speed: THORIN.speed,
      classes: THORIN.classes,
      sceneId: FIXTURE_BATTLE_SCENE_ID,
      position: { x: 2, y: 4 },
    },
  },
  {
    type: "create_entity",
    entity: {
      id: ELARA.id,
      kind: "character",
      name: ELARA.name,
      abilityScores: ELARA.abilityScores,
      maxHp: ELARA.maxHp,
      baseAc: ELARA.baseAc,
      speed: ELARA.speed,
      classes: ELARA.classes,
      sceneId: FIXTURE_BATTLE_SCENE_ID,
      position: { x: 2, y: 6 },
    },
  },
  {
    type: "create_entity",
    entity: {
      id: "npc:goblin-a",
      kind: "monster",
      name: "Goblin Cutter",
      abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      maxHp: 7,
      baseAc: 15,
      speed: 30,
      sceneId: FIXTURE_BATTLE_SCENE_ID,
      position: { x: 9, y: 3 },
    },
  },
  {
    type: "create_entity",
    entity: {
      id: "npc:goblin-b",
      kind: "monster",
      name: "Goblin Sneak",
      abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      maxHp: 7,
      baseAc: 15,
      speed: 30,
      sceneId: FIXTURE_BATTLE_SCENE_ID,
      position: { x: 9, y: 6 },
    },
  },
  {
    type: "start_encounter",
    sceneId: FIXTURE_BATTLE_SCENE_ID,
    combatants: [THORIN.id, ELARA.id, "npc:goblin-a", "npc:goblin-b"],
    sides: {
      [THORIN.id]: FIXTURE_BATTLE_PARTY_SIDE,
      [ELARA.id]: FIXTURE_BATTLE_PARTY_SIDE,
      "npc:goblin-a": FIXTURE_BATTLE_FOES_SIDE,
      "npc:goblin-b": FIXTURE_BATTLE_FOES_SIDE,
    },
  },
  { type: "roll_initiative" },
];

/**
 * A player-issued action the live channel replays on top of the base encounter:
 * drag-to-move, end-the-turn, or a HUD quick-attack (#63). All go through the
 * real command path, so the engine remains the authority on legality.
 */
export type BattleAction = MoveEntityCommand | EndTurnCommand | AttackCommand;

/** Convenience constructor for a drag-to-move action. */
export function moveAction(entity: string, to: GridPosition): MoveEntityCommand {
  return { type: "move_entity", entity, to };
}

/** Convenience constructor for a HUD quick-attack action (#63). */
export function attackAction(
  attacker: EntityRef,
  target: EntityRef,
  attackBonus: number,
  damage: { notation: string; type: string },
): AttackCommand {
  return { type: "attack", attacker, target, attackBonus, damage };
}

/**
 * Build the fixture battle world state, optionally replaying player actions on
 * top of the base encounter. Each action runs through the real command path (so
 * legality — bounds, walls, occupancy, movement budget, turn order — is enforced
 * exactly as in live play). Rejected actions are counted and leave the world
 * unchanged for that step.
 */
export async function buildFixtureBattle(
  actions: readonly BattleAction[] = [],
): Promise<{ state: WorldState; rejected: number }> {
  const engine = new Engine({ now: () => 0 });
  for (const command of FIXTURE_BATTLE_COMMANDS) {
    await engine.execute(FIXTURE_BATTLE_CAMPAIGN_ID, command);
  }

  let rejected = 0;
  for (const action of actions) {
    const result = await engine.execute(FIXTURE_BATTLE_CAMPAIGN_ID, action);
    if (!result.accepted) rejected += 1;
  }

  return {
    state: await engine.getState(FIXTURE_BATTLE_CAMPAIGN_ID),
    rejected,
  };
}
