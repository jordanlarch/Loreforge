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
  AbilityCheckCommand,
  AttackCommand,
  CastSpellCommand,
  Command,
  EndTurnCommand,
  MoveEntityCommand,
  OpportunityAttackCommand,
  ReadyActionCommand,
  TriggerReadiedCommand,
} from "../commands/types";
import type {
  Ability,
  AbilityScores,
  ClassLevel,
  EntityRef,
  GridPosition,
  ReadiedAction,
  SpellcastingInit,
} from "../entities/types";
import type { RollMode } from "../rng/dice";
import type { WorldState } from "../projections/world-state";
import {
  ENCOUNTER_MAP_PRESETS,
  resolveEncounterMap,
  type EncounterMapDef,
} from "./battle-maps";
import { FIXTURE_CHARACTERS } from "./party";

/** Stable seed/campaign id; the RNG (initiative) is keyed off this. */
export const FIXTURE_BATTLE_CAMPAIGN_ID = "fixture:goblin-ambush";

export const FIXTURE_BATTLE_SCENE_ID = "scene:ambush";

export const FIXTURE_BATTLE_PARTY_SIDE = "party";
export const FIXTURE_BATTLE_FOES_SIDE = "foes";

/**
 * A party member to seed into the live encounter (#98). A trimmed projection of
 * a persisted character row (or a fixture character) — exactly the fields the
 * engine's `create_entity` needs to place a PC on the map. The `id` is the
 * stable entity ref (a character row uuid for persisted PCs), so the client can
 * map the live combatant back to its sheet for weapon/spell loadouts.
 */
export type PartyMember = {
  id: EntityRef;
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
  classes: ClassLevel[];
  /** Present for casters so the live cast loop is exercisable. */
  spellcasting?: SpellcastingInit;
  /** Melee reach from equipped weapons (OA provoke detection, ENG-10). */
  meleeReachFt?: number;
};

/** A short pillar wall down the middle with a gap, to make movement interesting. */
const WALLS: GridPosition[] = ENCOUNTER_MAP_PRESETS.ambush.blockedCells;

/** Left-column starting cells for the party; caps the seed at four PCs. */
const PARTY_POSITIONS: readonly GridPosition[] = [
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 2, y: 6 },
  { x: 2, y: 8 },
];

/**
 * Right-side starting cells for foes; caps an authored encounter's roster. The
 * first two preserve the legacy goblin-ambush layout so the default fixture is
 * unchanged; the rest extend the column for larger encounters.
 */
const FOE_POSITIONS: readonly GridPosition[] = [
  { x: 9, y: 3 },
  { x: 9, y: 6 },
  { x: 9, y: 1 },
  { x: 9, y: 8 },
  { x: 10, y: 4 },
  { x: 10, y: 7 },
  { x: 11, y: 2 },
  { x: 11, y: 5 },
];

/** Max party seeded onto the fixture map (one per {@link PARTY_POSITIONS} cell). */
export const MAX_BATTLE_PARTY = PARTY_POSITIONS.length;

/** Max foes seeded onto the map (one per {@link FOE_POSITIONS} cell). */
export const MAX_BATTLE_FOES = FOE_POSITIONS.length;

/**
 * A foe to place into an authored encounter (CAMP-8). A trimmed monster statline
 * — the engine `create_entity` fields — minus position, which
 * {@link buildPartyBattleCommands} assigns from {@link FOE_POSITIONS}. Expand a
 * {@link MonsterTemplate} × count into a flat list of these (unique ids) before
 * seeding.
 */
export type FoeSpec = {
  id: EntityRef;
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
  /** Monster Multiattack override; defaults to 1 attack per Attack action. */
  attacksPerAction?: number;
  rangedAttackRangeFt?: number;
  rangedAttackBonus?: number;
  rangedDamage?: { notation: string; type: string };
};

/** The two goblin foes the default ambush fields, as {@link FoeSpec}s. */
const DEFAULT_FOES: readonly FoeSpec[] = [
  {
    id: "npc:goblin-a",
    name: "Goblin Cutter",
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    maxHp: 7,
    baseAc: 15,
    speed: 30,
  },
  {
    id: "npc:goblin-b",
    name: "Goblin Sneak",
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    maxHp: 7,
    baseAc: 15,
    speed: 30,
  },
];

/** The fixture party (Thorin + Elara), used by the sandbox + empty campaigns. */
export const FIXTURE_PARTY: PartyMember[] = [
  {
    id: FIXTURE_CHARACTERS[0]!.id,
    name: FIXTURE_CHARACTERS[0]!.name,
    abilityScores: FIXTURE_CHARACTERS[0]!.abilityScores,
    maxHp: FIXTURE_CHARACTERS[0]!.maxHp,
    baseAc: FIXTURE_CHARACTERS[0]!.baseAc,
    speed: FIXTURE_CHARACTERS[0]!.speed,
    classes: FIXTURE_CHARACTERS[0]!.classes,
  },
  {
    id: FIXTURE_CHARACTERS[1]!.id,
    name: FIXTURE_CHARACTERS[1]!.name,
    abilityScores: FIXTURE_CHARACTERS[1]!.abilityScores,
    maxHp: FIXTURE_CHARACTERS[1]!.maxHp,
    baseAc: FIXTURE_CHARACTERS[1]!.baseAc,
    speed: FIXTURE_CHARACTERS[1]!.speed,
    classes: FIXTURE_CHARACTERS[1]!.classes,
    // The Bard is a caster so the live cast loop (#58) is exercisable.
    spellcasting: { ability: "cha" },
  },
];

/**
 * Build the ordered command list for the goblin-ambush encounter seeded with a
 * given party (#98). Generalizes the old hard-coded fixture: the scene + map +
 * foes are constant; the party is whatever is passed (the persisted campaign
 * roster, or the fixture party). Up to {@link MAX_BATTLE_PARTY} members are
 * placed down the left column; extras are dropped (the map only has so many
 * start cells). Exported so callers can append actions and replay deterministically.
 */
export function buildPartyBattleCommands(
  party: readonly PartyMember[],
  opts?: {
    /** Authored foe roster; defaults to the two-goblin ambush. */
    foes?: readonly FoeSpec[];
    /** Scene title; defaults to the goblin-ambush name. */
    sceneName?: string;
    /** Battle map layout (CAMP-8); defaults to road ambush. */
    map?: EncounterMapDef;
  },
): Command[] {
  const members = party.slice(0, MAX_BATTLE_PARTY);
  const foes = (opts?.foes ?? DEFAULT_FOES).slice(0, MAX_BATTLE_FOES);
  const sceneName = opts?.sceneName ?? "Salt Way Ambush";
  const map = opts?.map ?? resolveEncounterMap("ambush");
  const sides: Record<EntityRef, string> = {};
  for (const m of members) sides[m.id] = FIXTURE_BATTLE_PARTY_SIDE;
  for (const f of foes) sides[f.id] = FIXTURE_BATTLE_FOES_SIDE;

  return [
    {
      type: "create_scene",
      scene: {
        id: FIXTURE_BATTLE_SCENE_ID,
        name: sceneName,
        description: map.description,
        map: {
          width: map.width,
          height: map.height,
          blockedCells: map.blockedCells,
        },
      },
    },
    { type: "change_scene", sceneId: FIXTURE_BATTLE_SCENE_ID },
    ...members.map((m, i): Command => ({
      type: "create_entity",
      entity: {
        id: m.id,
        kind: "character",
        name: m.name,
        abilityScores: m.abilityScores,
        maxHp: m.maxHp,
        baseAc: m.baseAc,
        speed: m.speed,
        classes: m.classes,
        sceneId: FIXTURE_BATTLE_SCENE_ID,
        position: PARTY_POSITIONS[i]!,
        ...(m.spellcasting ? { spellcasting: m.spellcasting } : {}),
        ...(m.meleeReachFt !== undefined ? { meleeReachFt: m.meleeReachFt } : {}),
      },
    })),
    ...foes.map((f, i): Command => ({
      type: "create_entity",
      entity: {
        id: f.id,
        kind: "monster",
        name: f.name,
        abilityScores: f.abilityScores,
        maxHp: f.maxHp,
        baseAc: f.baseAc,
        speed: f.speed,
        sceneId: FIXTURE_BATTLE_SCENE_ID,
        position: FOE_POSITIONS[i]!,
        ...(f.attacksPerAction !== undefined
          ? { attacksPerAction: f.attacksPerAction }
          : {}),
        ...(f.rangedAttackRangeFt !== undefined
          ? { rangedAttackRangeFt: f.rangedAttackRangeFt }
          : {}),
        ...(f.rangedAttackBonus !== undefined
          ? { rangedAttackBonus: f.rangedAttackBonus }
          : {}),
        ...(f.rangedDamage !== undefined ? { rangedDamage: f.rangedDamage } : {}),
      },
    })),
    {
      type: "start_encounter",
      sceneId: FIXTURE_BATTLE_SCENE_ID,
      combatants: [...members.map((m) => m.id), ...foes.map((f) => f.id)],
      sides,
    },
    { type: "roll_initiative" },
  ];
}

/**
 * Expand an authored foe roster (monster template slug × count) into a flat
 * {@link FoeSpec} list with unique ids + count-suffixed names, ready for
 * {@link buildPartyBattleCommands}. Unknown slugs are skipped; the total is
 * capped at {@link MAX_BATTLE_FOES}. Ids are index-derived so the seed is
 * deterministic (a reset reproduces the same encounter).
 */
export function expandEncounterFoes(
  roster: readonly { template: string; count: number; name?: string }[],
  resolve: (slug: string) => {
    name: string;
    abilityScores: AbilityScores;
    maxHp: number;
    baseAc: number;
    speed: number;
    attacksPerAction?: number;
    rangedAttack?: {
      rangeFt: number;
      attackBonus?: number;
      damage: { notation: string; type: string };
    };
  } | undefined,
): FoeSpec[] {
  const foes: FoeSpec[] = [];
  for (const entry of roster) {
    const template = resolve(entry.template);
    if (!template) continue;
    const count = Math.max(1, Math.floor(entry.count));
    for (let n = 0; n < count; n += 1) {
      if (foes.length >= MAX_BATTLE_FOES) return foes;
      const base = entry.name?.trim() || template.name;
      foes.push({
        id: `npc:foe-${foes.length}`,
        name: count > 1 ? `${base} ${n + 1}` : base,
        abilityScores: template.abilityScores,
        maxHp: template.maxHp,
        baseAc: template.baseAc,
        speed: template.speed,
        ...(template.attacksPerAction !== undefined
          ? { attacksPerAction: template.attacksPerAction }
          : {}),
        ...(template.rangedAttack
          ? {
              rangedAttackRangeFt: template.rangedAttack.rangeFt,
              ...(template.rangedAttack.attackBonus !== undefined
                ? { rangedAttackBonus: template.rangedAttack.attackBonus }
                : {}),
              rangedDamage: template.rangedAttack.damage,
            }
          : {}),
      });
    }
  }
  return foes;
}

/**
 * The ordered command list that builds the *fixture* encounter (Thorin + Elara
 * vs two goblins). Exported so callers can append `move_entity` commands and
 * replay the whole batch deterministically. Persisted campaigns seed from their
 * real roster instead via {@link buildPartyBattleCommands}.
 */
export const FIXTURE_BATTLE_COMMANDS: Command[] =
  buildPartyBattleCommands(FIXTURE_PARTY);

/**
 * A player-issued action the live channel replays on top of the base encounter:
 * drag-to-move, end-the-turn, a HUD quick-attack (#63), a spell cast, or an
 * opportunity attack (#58). All go through the real command path, so the engine
 * remains the authority on legality.
 */
export type BattleAction =
  | MoveEntityCommand
  | EndTurnCommand
  | AttackCommand
  | CastSpellCommand
  | OpportunityAttackCommand
  | AbilityCheckCommand
  | ReadyActionCommand
  | TriggerReadiedCommand;

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
  rangeFt?: number,
): AttackCommand {
  return {
    type: "attack",
    attacker,
    target,
    attackBonus,
    damage,
    ...(rangeFt !== undefined ? { rangeFt } : {}),
  };
}

/** Convenience constructor for a single-target spell cast (#58). */
export function castAction(
  caster: EntityRef,
  spellId: string,
  slotLevel: number,
  targets: EntityRef[],
): CastSpellCommand {
  return { type: "cast_spell", caster, spellId, slotLevel, targets };
}

/** Convenience constructor for an engine-resolved ability/skill check (#97).
 * `mode` drives advantage/disadvantage (e.g. the Help action grants advantage). */
export function checkAction(
  entity: EntityRef,
  ability: Ability,
  opts?: { skill?: string; dc?: number; proficient?: boolean; mode?: RollMode },
): AbilityCheckCommand {
  return {
    type: "ability_check",
    entity,
    ability,
    ...(opts?.skill ? { skill: opts.skill } : {}),
    ...(opts?.dc !== undefined ? { dc: opts.dc } : {}),
    ...(opts?.proficient ? { proficient: opts.proficient } : {}),
    ...(opts?.mode ? { mode: opts.mode } : {}),
  };
}

/** Convenience constructor for readying an action against a trigger (#104). */
export function readyAction(
  entity: EntityRef,
  trigger: string,
  action: ReadiedAction,
): ReadyActionCommand {
  return { type: "ready_action", entity, trigger, action };
}

/** Convenience constructor for firing a readied action when its trigger hits (#104). */
export function triggerReadiedAction(entity: EntityRef): TriggerReadiedCommand {
  return { type: "trigger_readied", entity };
}

/** Convenience constructor for an opportunity-attack reaction (#58). */
export function opportunityAttackAction(
  reactor: EntityRef,
  target: EntityRef,
  attackBonus: number,
  damage: { notation: string; type: string },
  rangeFt?: number,
): OpportunityAttackCommand {
  return {
    type: "opportunity_attack",
    reactor,
    target,
    attackBonus,
    damage,
    ...(rangeFt !== undefined ? { rangeFt } : {}),
  };
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
