/**
 * Command handlers — validate then resolve a command into draft events.
 *
 * Each handler is a pure function of `(command, ctx)`. Validation failures
 * return a structured {@link CommandResult}; success returns the events to
 * append plus a compact summary (the summary is what gets fed back to the LLM
 * for narration — it never sees raw events). See `architecture.md` §4.4.
 */
import { abilityModifier, totalLevel } from "../entities/abilities";
import { sortInitiative, type InitiativeRollInput } from "../combat/initiative";
import { criticalNotation, resolveHit } from "../combat/attack";
import {
  distanceFeet,
  hasLineOfSight,
  withinBurst,
  withinCone,
  withinCube,
  withinLine,
} from "../combat/grid";
import { normalizeSceneTraps } from "../content/scene-traps";
import { isSpellPrepared } from "../content/spell-id";
import { getSpell } from "../content/spell-registry";
import {
  cantripDamageDice,
  spellAttackBonus,
  spellcastingModifier,
  spellSaveDC,
} from "../content/spellcasting";
import type { SpellDefinition, SpellRange } from "../content/spells";
import { parseDice } from "../rng/dice";
import {
  attackedMode,
  charmedSources,
  combineMode,
  critsWhenAdjacent,
  effectiveSpeed,
  isCondition,
  isIncapacitated,
  isProne,
  ownAttackMode,
  saveResolution,
  type RollAdjust,
} from "../combat/conditions";
import { concentrationDC, resolveDeathSave } from "../combat/death";
import {
  attackRollBonusDice,
  attackRollPenaltyDice,
  attacksAgainstHaveAdvantage,
  attacksAgainstHaveDisadvantage,
  effectFromSpec,
  effectiveAc,
  effectiveSpeedForEntity,
  huntersMarkOn,
  spellDurationRounds,
} from "../combat/effects";
import { areHostile, opportunityAttackReach, provokesOpportunityAttack, REACH_FEET, readyTriggerRangeFeet } from "../combat/reactions";
import type {
  Ability,
  EntityRef,
  EntityState,
  GridPosition,
} from "../entities/types";
import type { RollMode } from "../rng/dice";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  handleDetectTrap,
  handleDisableTrap,
  handleTriggerTrap,
  trapTriggerEventsAfterMove,
} from "./trap-handlers";
import {
  handleApplyPoison,
  handleCoatWeapon,
  handleResolvePoisonTick,
  poisonDeliveryEventsAfterHit,
  poisonTickEventsAfterTurnStart,
} from "./poison-handlers";
import {
  curseTickEventsAfterTurnStart,
  handleApplyCurse,
  handleRemoveCurse,
  handleResolveCurseTick,
  buildApplyCurseEvents,
  buildClearAllCursesEvents,
} from "./curse-handlers";
import {
  buildLeaveSceneEnvironmentalEffectEvents,
  environmentalEffectTickEventsAfterTurnStart,
  handleApplyEnvironmentalEffect,
  handleRemoveEnvironmentalEffect,
  handleResolveEnvironmentalEffectTick,
  handleSetSceneEnvironmentalEffects,
} from "./environmental-effect-handlers";
import {
  reject,
  type AbilityCheckCommand,
  type AddCombatantCommand,
  type ApplyConditionCommand,
  type ApplyDamageCommand,
  type ApplyHealingCommand,
  type AttackCommand,
  type CastSpellCommand,
  type DispelMagicCommand,
  type ChangeSceneCommand,
  type Command,
  type CommandResult,
  type CommandSummary,
  type CreateEntityCommand,
  type CreateSceneCommand,
  type DamageSource,
  type DeathSaveCommand,
  type DetectTrapCommand,
  type DisableTrapCommand,
  type TriggerTrapCommand,
  type EndConcentrationCommand,
  type EndEncounterCommand,
  type EndTurnCommand,
  type LongRestCommand,
  type MoveEntityCommand,
  type RelocateEntityCommand,
  type OpportunityAttackCommand,
  type ReadyActionCommand,
  type RemoveConditionCommand,
  type RollDiceCommand,
  type RollInitiativeCommand,
  type SavingThrowCommand,
  type ShortRestCommand,
  type StartConcentrationCommand,
  type StartEncounterCommand,
  type TriggerReadiedCommand,
} from "./types";

function meta(ctx: ExecutionContext, actor?: string): Omit<EventMeta, "sequence"> {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor,
  };
}

/** Resolve a damage/healing source into a concrete amount (rolling if needed). */
function resolveAmount(
  source: DamageSource,
  scope: string,
  ctx: ExecutionContext,
): { amount: number; rollEvent?: ReturnType<typeof rollDiceEvent> } {
  if ("amount" in source) {
    return { amount: Math.max(0, Math.floor(source.amount)) };
  }
  const outcome = ctx.roll(source.notation, scope);
  return {
    amount: Math.max(0, outcome.total),
    rollEvent: rollDiceEvent(ctx, outcome),
  };
}

function rollDiceEvent(
  ctx: ExecutionContext,
  outcome: { notation: string; rolls: number[]; total: number; scope: string; drawIndex: number },
) {
  return {
    type: "DiceRolled" as const,
    ...meta(ctx),
    payload: {
      notation: outcome.notation,
      rolls: outcome.rolls,
      total: outcome.total,
      scope: outcome.scope,
      drawIndex: outcome.drawIndex,
    },
  };
}

function handleCreateScene(
  cmd: CreateSceneCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.scenes[cmd.scene.id]) {
    return reject("DUPLICATE_SCENE", `Scene ${cmd.scene.id} already exists.`);
  }
  const scene = normalizeSceneTraps(cmd.scene);
  return {
    accepted: true,
    events: [{ type: "SceneCreated", ...meta(ctx, "system"), payload: { scene } }],
    summary: { sceneId: scene.id },
  };
}

function handleChangeScene(
  cmd: ChangeSceneCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (!ctx.world.scenes[cmd.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.sceneId} does not exist.`);
  }
  const events: DraftEvent[] = [];
  const departing = ctx.world.currentSceneId;
  if (departing && departing !== cmd.sceneId) {
    events.push(...buildLeaveSceneEnvironmentalEffectEvents(ctx, departing));
  }
  events.push({
    type: "SceneChanged",
    ...meta(ctx, "system"),
    payload: { sceneId: cmd.sceneId },
  });
  return {
    accepted: true,
    events,
    summary: { sceneId: cmd.sceneId },
  };
}

function handleCreateEntity(
  cmd: CreateEntityCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.entities[cmd.entity.id]) {
    return reject("DUPLICATE_ENTITY", `Entity ${cmd.entity.id} already exists.`);
  }
  if (cmd.entity.sceneId && !ctx.world.scenes[cmd.entity.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.entity.sceneId} does not exist.`);
  }
  return {
    accepted: true,
    events: [{ type: "EntityCreated", ...meta(ctx, "system"), payload: { entity: cmd.entity } }],
    summary: { entityId: cmd.entity.id, kind: cmd.entity.kind },
  };
}

function handleRollDice(
  cmd: RollDiceCommand,
  ctx: ExecutionContext,
): CommandResult {
  const scope = cmd.scope ?? "default";
  const outcome = ctx.roll(cmd.notation, scope, cmd.mode);
  return {
    accepted: true,
    events: [rollDiceEvent(ctx, outcome)],
    summary: {
      notation: cmd.notation,
      rolls: outcome.rolls,
      total: outcome.total,
      mode: cmd.mode ?? "normal",
    },
  };
}

/**
 * If `target` is concentrating and survives `damage`, roll the CON save to
 * maintain it (DC = max(10, damage/2)); on failure, break concentration.
 * Returns the events to append (empty when no check is due). Dropping to 0 HP
 * breaks concentration in the projection, so no save is rolled in that case.
 */
function concentrationCheckEvents(
  ctx: ExecutionContext,
  target: EntityState,
  damage: number,
  hpAfter: number,
): DraftEvent[] {
  if (!target.concentration || damage <= 0 || hpAfter <= 0) return [];
  const dc = concentrationDC(damage);
  const { autoFail, mode } = saveResolution("con", target.conditions);
  if (autoFail) {
    return [
      {
        type: "SaveRolled",
        ...meta(ctx, target.id),
        payload: {
          entity: target.id,
          ability: "con",
          dc,
          mode: "normal",
          success: false,
          autoFail: true,
        },
      },
      {
        type: "ConcentrationBroken",
        ...meta(ctx, target.id),
        payload: { entity: target.id, reason: "damage" },
      },
    ];
  }
  const roll = ctx.roll("1d20", `concentration:${target.id}`, mode);
  const total = roll.total + abilityModifier(target.abilityScores.con);
  const success = total >= dc;
  const events: DraftEvent[] = [
    rollDiceEvent(ctx, roll),
    {
      type: "SaveRolled",
      ...meta(ctx, target.id),
      payload: {
        entity: target.id,
        ability: "con",
        dc,
        mode: mode as RollMode,
        natural: roll.total,
        total,
        success,
        autoFail: false,
      },
    },
  ];
  if (!success) {
    events.push({
      type: "ConcentrationBroken",
      ...meta(ctx, target.id),
      payload: { entity: target.id, reason: "damage" },
    });
  }
  return events;
}

function handleApplyDamage(
  cmd: ApplyDamageCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  const scope = cmd.scope ?? `damage:${cmd.target}`;
  const { amount, rollEvent } = resolveAmount(cmd.source, scope, ctx);

  const fromTemp = Math.min(target.hp.temp, amount);
  const toCurrent = amount - fromTemp;
  const hpAfter = Math.max(0, target.hp.current - toCurrent);

  const events: DraftEvent[] = [
    ...(rollEvent ? [rollEvent] : []),
    {
      type: "DamageDealt" as const,
      ...meta(ctx),
      payload: {
        target: cmd.target,
        amount,
        damageType: cmd.damageType,
        hpBefore: target.hp.current,
        hpAfter,
      },
    },
    ...concentrationCheckEvents(ctx, target, amount, hpAfter),
  ];

  return {
    accepted: true,
    events,
    summary: {
      target: cmd.target,
      amount,
      damageType: cmd.damageType,
      hpAfter,
      downed: hpAfter <= 0,
    },
  };
}

function handleApplyHealing(
  cmd: ApplyHealingCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (target.dead) {
    return reject("TARGET_DEAD", `${target.name} is dead and cannot be healed.`);
  }
  const scope = cmd.scope ?? `heal:${cmd.target}`;
  const { amount, rollEvent } = resolveAmount(cmd.source, scope, ctx);
  const hpAfter = Math.min(target.hp.max, target.hp.current + amount);

  const events = [
    ...(rollEvent ? [rollEvent] : []),
    {
      type: "HealingApplied" as const,
      ...meta(ctx),
      payload: {
        target: cmd.target,
        amount,
        hpBefore: target.hp.current,
        hpAfter,
      },
    },
  ];

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, amount, hpAfter },
  };
}

function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

/** A living entity (other than `exclude`) standing on `cell` in `sceneId`. */
function occupantAt(
  world: ExecutionContext["world"],
  sceneId: string | undefined,
  cell: GridPosition,
  exclude: ReadonlySet<string>,
): EntityState | undefined {
  return Object.values(world.entities).find(
    (e) =>
      !exclude.has(e.id) &&
      e.alive &&
      e.sceneId === sceneId &&
      e.position !== undefined &&
      sameCell(e.position, cell),
  );
}

function handleMoveEntity(
  cmd: MoveEntityCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot move while dead.`);
  }

  if (effectiveSpeedForEntity(entity) === 0) {
    return reject("IMMOBILIZED", `${entity.name} cannot move (speed 0).`);
  }

  const to = cmd.to;
  const scene = entity.sceneId ? ctx.world.scenes[entity.sceneId] : undefined;
  const map = scene?.map;
  if (map) {
    if (to.x < 0 || to.y < 0 || to.x >= map.width || to.y >= map.height) {
      return reject("OUT_OF_BOUNDS", `(${to.x},${to.y}) is outside the map.`);
    }
    if (map.blockedCells.some((c) => sameCell(c, to))) {
      return reject("CELL_BLOCKED", `(${to.x},${to.y}) is blocked by a wall.`);
    }
  }

  if (occupantAt(ctx.world, entity.sceneId, to, new Set([entity.id]))) {
    return reject("CELL_OCCUPIED", `(${to.x},${to.y}) is occupied.`);
  }

  // Debit movement only while it is this combatant's turn (action economy
  // present). Outside combat, movement is unbudgeted.
  if (entity.actionEconomy && entity.position) {
    const cost = distanceFeet(entity.position, to);
    const remaining =
      entity.actionEconomy.movement.total - entity.actionEconomy.movement.used;
    if (cost > remaining) {
      return reject(
        "INSUFFICIENT_MOVEMENT",
        `Move costs ${cost}ft but only ${remaining}ft remain.`,
        { cost, remaining },
      );
    }
  }

  const events: DraftEvent[] = [
    {
      type: "EntityMoved",
      ...meta(ctx, cmd.entity),
      payload: { entity: cmd.entity, from: entity.position, to },
    },
  ];

  // In combat, leaving a threatener's reach opens an opportunity-attack window.
  const encounter = ctx.world.encounter;
  if (encounter && entity.position) {
    const from = entity.position;
    const moverSide = encounter.sides[entity.id];
    const eligible = encounter.combatants.filter((ref) => {
      if (ref === entity.id) return false;
      const reactor = ctx.world.entities[ref];
      return (
        reactor !== undefined &&
        reactor.alive &&
        reactor.reaction === "available" &&
        reactor.position !== undefined &&
        reactor.sceneId === entity.sceneId &&
        // Only hostiles take opportunity attacks; neutral/allied do not provoke.
        areHostile(moverSide, encounter.sides[ref]) &&
        provokesOpportunityAttack(
          reactor.position,
          from,
          to,
          opportunityAttackReach(reactor),
        )
      );
    });
    if (eligible.length > 0) {
      events.push({
        type: "ReactionWindowOpened",
        ...meta(ctx, "system"),
        payload: {
          trigger: "leave_reach",
          mover: cmd.entity,
          eligible,
          moverAtProvocation: from,
        },
      });
    }
  }

  events.push(
    ...trapTriggerEventsAfterMove(ctx, cmd.entity, entity.sceneId, to),
  );

  return { accepted: true, events, summary: { entity: cmd.entity, to } };
}

/**
 * Move an existing entity into another scene (exploration scene transition).
 * Unlike `move_entity` this isn't budget/occupancy-checked — it carries the
 * party between maps. Rejects if the entity or destination scene is missing.
 */
function handleRelocateEntity(
  cmd: RelocateEntityCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!ctx.world.scenes[cmd.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.sceneId} does not exist.`);
  }
  return {
    accepted: true,
    events: [
      {
        type: "EntityRelocated",
        ...meta(ctx, cmd.entity),
        payload: {
          entity: cmd.entity,
          sceneId: cmd.sceneId,
          position: cmd.position,
        },
      },
    ],
    summary: { entity: cmd.entity, sceneId: cmd.sceneId },
  };
}

function handleStartEncounter(
  cmd: StartEncounterCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.encounter) {
    return reject("ENCOUNTER_EXISTS", "An encounter is already in progress.");
  }
  const sceneId = cmd.sceneId ?? ctx.world.currentSceneId;
  if (!sceneId) {
    return reject("SCENE_NOT_FOUND", "No scene specified and no current scene.");
  }
  if (!ctx.world.scenes[sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${sceneId} does not exist.`);
  }
  if (cmd.combatants.length === 0) {
    return reject("EMPTY_ENCOUNTER", "An encounter needs at least one combatant.");
  }
  if (new Set(cmd.combatants).size !== cmd.combatants.length) {
    return reject("INVALID_PAYLOAD", "Combatant list contains duplicates.");
  }
  const members = new Set(cmd.combatants);
  for (const ref of cmd.combatants) {
    if (!ctx.world.entities[ref]) {
      return reject("TARGET_NOT_FOUND", `Combatant ${ref} does not exist.`, {
        entity: ref,
      });
    }
  }
  const sides = cmd.sides ?? {};
  for (const ref of Object.keys(sides)) {
    if (!members.has(ref)) {
      return reject(
        "INVALID_PAYLOAD",
        `Side assigned to non-combatant ${ref}.`,
        { entity: ref },
      );
    }
  }
  return {
    accepted: true,
    events: [
      {
        type: "EncounterStarted",
        ...meta(ctx, "system"),
        payload: { sceneId, combatants: [...cmd.combatants], sides: { ...sides } },
      },
    ],
    summary: { sceneId, combatants: cmd.combatants.length },
  };
}

function handleRollInitiative(
  cmd: RollInitiativeCommand,
  ctx: ExecutionContext,
): CommandResult {
  const encounter = ctx.world.encounter;
  if (!encounter) {
    return reject("NO_ENCOUNTER", "No encounter is in progress.");
  }
  if (encounter.initiativeRolled) {
    return reject(
      "INITIATIVE_ALREADY_ROLLED",
      "Initiative has already been rolled for this encounter.",
    );
  }

  const events: DraftEvent[] = [];
  const inputs: InitiativeRollInput[] = [];
  for (const ref of encounter.combatants) {
    const entity = ctx.world.entities[ref];
    if (!entity) {
      return reject("ACTOR_NOT_FOUND", `Combatant ${ref} no longer exists.`, {
        entity: ref,
      });
    }
    const dexScore = entity.abilityScores.dex;
    const bonus = cmd.bonuses?.[ref] ?? 0;
    const roll = ctx.roll("1d20", `initiative:${ref}`);
    events.push(rollDiceEvent(ctx, roll));
    const tiebreak = ctx.roll("1d20", `initiative-tiebreak:${ref}`);
    events.push(rollDiceEvent(ctx, tiebreak));
    inputs.push({
      entity: ref,
      initiative: roll.total + abilityModifier(dexScore) + bonus,
      dexScore,
      tiebreak: tiebreak.total,
    });
  }

  const order = sortInitiative(inputs);
  const first = order[0];
  if (!first) {
    return reject("EMPTY_ENCOUNTER", "Encounter has no combatants.");
  }
  events.push({
    type: "InitiativeRolled",
    ...meta(ctx, "system"),
    payload: { order },
  });
  events.push({
    type: "TurnStarted",
    ...meta(ctx, first.entity),
    payload: { entity: first.entity, index: 0 },
  });
  events.push(...poisonTickEventsAfterTurnStart(ctx, first.entity));
  events.push(...curseTickEventsAfterTurnStart(ctx, first.entity));
  events.push(...environmentalEffectTickEventsAfterTurnStart(ctx, first.entity));

  return {
    accepted: true,
    events,
    summary: { order, active: first.entity, round: 1 },
  };
}

function handleAddCombatant(
  cmd: AddCombatantCommand,
  ctx: ExecutionContext,
): CommandResult {
  const encounter = ctx.world.encounter;
  if (!encounter) {
    return reject("NO_ENCOUNTER", "No encounter is in progress.");
  }
  if (!encounter.initiativeRolled) {
    return reject(
      "INITIATIVE_NOT_ROLLED",
      "Initiative must be rolled before adding combatants.",
    );
  }
  if (encounter.combatants.includes(cmd.entityId)) {
    return reject(
      "COMBATANT_ALREADY_PRESENT",
      `${cmd.entityId} is already in this encounter.`,
      { entity: cmd.entityId },
    );
  }
  const entity = ctx.world.entities[cmd.entityId];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entityId} does not exist.`, {
      entity: cmd.entityId,
    });
  }
  if (!entity.alive) {
    return reject("TARGET_DEAD", `${entity.name} cannot join combat.`, {
      entity: cmd.entityId,
    });
  }
  if (entity.sceneId !== encounter.sceneId) {
    return reject(
      "INVALID_PAYLOAD",
      `${entity.name} must be in the encounter scene.`,
      { entity: cmd.entityId },
    );
  }

  const events: DraftEvent[] = [];
  const inputs: InitiativeRollInput[] = [];
  for (const entry of encounter.order) {
    const combatant = ctx.world.entities[entry.entity];
    if (!combatant) continue;
    inputs.push({
      entity: entry.entity,
      initiative: entry.initiative,
      dexScore: combatant.abilityScores.dex,
      tiebreak: 0,
    });
  }
  const dexScore = entity.abilityScores.dex;
  const roll = ctx.roll("1d20", `initiative:${cmd.entityId}`);
  events.push(rollDiceEvent(ctx, roll));
  const tiebreak = ctx.roll("1d20", `initiative-tiebreak:${cmd.entityId}`);
  events.push(rollDiceEvent(ctx, tiebreak));
  inputs.push({
    entity: cmd.entityId,
    initiative: roll.total + abilityModifier(dexScore),
    dexScore,
    tiebreak: tiebreak.total,
  });

  const order = sortInitiative(inputs);
  const oldActive = encounter.order[encounter.activeIndex]?.entity;
  let activeIndex = oldActive
    ? order.findIndex((e) => e.entity === oldActive)
    : encounter.activeIndex;
  if (activeIndex < 0) activeIndex = encounter.activeIndex;

  events.push({
    type: "CombatantAdded",
    ...meta(ctx, "system"),
    payload: { entityId: cmd.entityId, side: cmd.side, order, activeIndex },
  });

  return {
    accepted: true,
    events,
    summary: {
      entityId: cmd.entityId,
      side: cmd.side,
      order,
      activeIndex,
    },
  };
}

function handleEndEncounter(
  _cmd: EndEncounterCommand,
  ctx: ExecutionContext,
): CommandResult {
  const encounter = ctx.world.encounter;
  if (!encounter) {
    return reject("NO_ENCOUNTER", "No encounter is in progress.");
  }
  return {
    accepted: true,
    events: [
      {
        type: "EncounterEnded",
        ...meta(ctx, "system"),
        payload: {
          sceneId: encounter.sceneId,
          combatants: [...encounter.combatants],
        },
      },
    ],
    summary: { combatants: encounter.combatants.length },
  };
}

function handleEndTurn(
  _cmd: EndTurnCommand,
  ctx: ExecutionContext,
): CommandResult {
  const encounter = ctx.world.encounter;
  if (!encounter) {
    return reject("NO_ENCOUNTER", "No encounter is in progress.");
  }
  if (!encounter.initiativeRolled) {
    return reject(
      "INITIATIVE_NOT_ROLLED",
      "Cannot end a turn before initiative is rolled.",
    );
  }

  const { order, activeIndex, round } = encounter;
  const current = order[activeIndex];
  const nextIndex = (activeIndex + 1) % order.length;
  const nextEntry = order[nextIndex];
  if (!current || !nextEntry) {
    return reject("INITIATIVE_NOT_ROLLED", "Encounter turn order is empty.");
  }
  const wraps = nextIndex === 0;
  const nextRound = wraps ? round + 1 : round;
  const nextEntity = nextEntry.entity;

  const events: DraftEvent[] = [
    {
      type: "TurnEnded",
      ...meta(ctx, current.entity),
      payload: { entity: current.entity },
    },
  ];
  if (wraps) {
    events.push({
      type: "RoundAdvanced",
      ...meta(ctx, "system"),
      payload: { round: nextRound },
    });
    events.push({
      type: "EffectsDurationTicked",
      ...meta(ctx, "system"),
      payload: {},
    });
  }
  events.push({
    type: "TurnStarted",
    ...meta(ctx, nextEntity),
    payload: { entity: nextEntity, index: nextIndex },
  });
  events.push(...poisonTickEventsAfterTurnStart(ctx, nextEntity));
  events.push(...curseTickEventsAfterTurnStart(ctx, nextEntity));
  events.push(...environmentalEffectTickEventsAfterTurnStart(ctx, nextEntity));

  return {
    accepted: true,
    events,
    summary: {
      ended: current.entity,
      active: nextEntity,
      round: nextRound,
      roundAdvanced: wraps,
    },
  };
}

function handleAttack(
  cmd: AttackCommand,
  ctx: ExecutionContext,
  /** Internal: reaction-driven attacks (opportunity / readied) cost the
   * reaction, not the Attack action, so they bypass the action-economy gate. */
  opts?: { viaReaction?: boolean; targetPosition?: GridPosition },
): CommandResult {
  const attacker = ctx.world.entities[cmd.attacker];
  if (!attacker) {
    return reject("ACTOR_NOT_FOUND", `Attacker ${cmd.attacker} does not exist.`);
  }
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (!attacker.alive) {
    return reject("TARGET_DEAD", `${attacker.name} cannot attack while down.`);
  }
  if (isIncapacitated(attacker.conditions)) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${attacker.name} is incapacitated and cannot take actions.`,
    );
  }
  if (charmedSources(attacker.conditions).has(cmd.target)) {
    return reject(
      "INVALID_TARGET",
      `${attacker.name} is charmed by ${target.name} and cannot attack them.`,
    );
  }

  // Action economy: a weapon attack is the Attack action. The first attack of
  // the turn spends the single action; further attacks ride the Attack action's
  // budget (Extra Attack / Multiattack). Only enforced on the owner's turn
  // (economy present); outside combat attacks are unbudgeted.
  const econ = opts?.viaReaction ? undefined : attacker.actionEconomy;
  let spendsAction = false;
  if (econ) {
    const startingAttack = econ.action === "available";
    const continuingAttack =
      !startingAttack &&
      econ.attacks.used > 0 &&
      econ.attacks.used < econ.attacks.total;
    if (!startingAttack && !continuingAttack) {
      return reject(
        "ACTION_UNAVAILABLE",
        `${attacker.name} has already used its action this turn.`,
      );
    }
    spendsAction = startingAttack;
  }

  const targetPosition = opts?.targetPosition ?? target.position;

  // Line of sight and range are enforced only when both combatants are placed in
  // the same mapped scene; mapless / unplaced combat (narrative, tests) is unaffected.
  if (
    attacker.position &&
    targetPosition &&
    attacker.sceneId &&
    attacker.sceneId === target.sceneId
  ) {
    const maxRange = cmd.rangeFt ?? REACH_FEET;
    if (distanceFeet(attacker.position, targetPosition) > maxRange) {
      return reject(
        "OUT_OF_RANGE",
        `${target.name} is beyond attack range (${maxRange} ft).`,
      );
    }
    const map = ctx.world.scenes[attacker.sceneId]?.map;
    if (map) {
      const exclude = new Set([attacker.id, target.id]);
      const blocked = (cell: GridPosition): boolean =>
        map.blockedCells.some((c) => sameCell(c, cell)) ||
        occupantAt(ctx.world, attacker.sceneId, cell, exclude) !== undefined;
      if (!hasLineOfSight(attacker.position, targetPosition, blocked)) {
        return reject(
          "NO_LINE_OF_SIGHT",
          `${attacker.name} has no line of sight to ${target.name}.`,
        );
      }
    }
  }

  // Adjacency (<= 5 ft) decides prone advantage/disadvantage, the adjacent-crit
  // rule, and is only known when both combatants are positioned.
  const adjacent =
    attacker.position && targetPosition
      ? distanceFeet(attacker.position, targetPosition) <= 5
      : undefined;
  const targetProne = target.conditions.some((c) => c.condition === "prone");
  const proneMode: RollAdjust =
    targetProne && adjacent !== undefined
      ? adjacent
        ? "advantage"
        : "disadvantage"
      : "normal";

  // Net advantage/disadvantage: requested mode + attacker's own modes + modes
  // from attacking this target's conditions + prone positioning.
  const mode = combineMode(
    (cmd.mode ?? "normal") as RollAdjust,
    ownAttackMode(attacker.conditions),
    attackedMode(target.conditions),
    attacksAgainstHaveAdvantage(target) ? "advantage" : "normal",
    attacksAgainstHaveDisadvantage(target) ? "disadvantage" : "normal",
    proneMode,
  );

  const d20 = ctx.roll("1d20", `attack:${cmd.attacker}->${cmd.target}`, mode);
  const events: DraftEvent[] = [rollDiceEvent(ctx, d20)];
  // "1d20" carries no modifier, so the total is the natural face (or the chosen
  // face under advantage/disadvantage).
  const natural = d20.total;
  let blessBonus = 0;
  for (const dice of attackRollBonusDice(attacker)) {
    const roll = ctx.roll(dice, `attack-bless:${cmd.attacker}->${cmd.target}`);
    events.push(rollDiceEvent(ctx, roll));
    blessBonus += roll.total;
  }
  let banePenalty = 0;
  for (const dice of attackRollPenaltyDice(attacker)) {
    const roll = ctx.roll(dice, `attack-bane:${cmd.attacker}->${cmd.target}`);
    events.push(rollDiceEvent(ctx, roll));
    banePenalty += roll.total;
  }
  const total = natural + cmd.attackBonus + blessBonus - banePenalty;
  const targetAc = effectiveAc(target);
  const forceCrit =
    adjacent === true && critsWhenAdjacent(target.conditions);
  const { hit, critical } = resolveHit(natural, total, targetAc, {
    forceCrit,
  });

  let damage: number | undefined;
  let hpAfter = target.hp.current;
  if (hit) {
    const notation = critical
      ? criticalNotation(cmd.damage.notation)
      : cmd.damage.notation;
    const dmg = ctx.roll(notation, `damage:${cmd.target}`);
    events.push(rollDiceEvent(ctx, dmg));
    damage = Math.max(0, dmg.total);
    const mark = huntersMarkOn(target, cmd.attacker);
    if (mark && mark.modifier.type === "hunters_mark") {
      const extra = ctx.roll(
        mark.modifier.dice,
        `hunters-mark:${cmd.attacker}->${cmd.target}`,
      );
      events.push(rollDiceEvent(ctx, extra));
      damage += Math.max(0, extra.total);
    }
    const fromTemp = Math.min(target.hp.temp, damage);
    hpAfter = Math.max(0, target.hp.current - (damage - fromTemp));
  }

  events.push({
    type: "AttackResolved",
    ...meta(ctx, cmd.attacker),
    payload: {
      attacker: cmd.attacker,
      target: cmd.target,
      attackRoll: { natural, total, mode },
      targetAc,
      hit,
      critical,
      damageType: cmd.damage.type,
      ...(damage !== undefined ? { damage } : {}),
    },
  });

  if (hit && damage !== undefined) {
    events.push({
      type: "DamageDealt",
      ...meta(ctx),
      payload: {
        target: cmd.target,
        amount: damage,
        damageType: cmd.damage.type,
        hpBefore: target.hp.current,
        hpAfter,
      },
    });
    events.push(...concentrationCheckEvents(ctx, target, damage, hpAfter));
    events.push(
      ...poisonDeliveryEventsAfterHit(ctx, cmd.attacker, cmd.target, cmd.damage.type),
    );
  }

  // Debit the turn economy (own turn only): spend the action on the first attack
  // and tick the Attack action's attack budget.
  let attacksLeft: number | undefined;
  if (econ) {
    events.push({
      type: "ActionSpent",
      ...meta(ctx, cmd.attacker),
      payload: { entity: cmd.attacker, action: spendsAction, attack: true },
    });
    attacksLeft = Math.max(0, econ.attacks.total - (econ.attacks.used + 1));
  }

  return {
    accepted: true,
    events,
    summary: {
      attacker: cmd.attacker,
      target: cmd.target,
      natural,
      attackTotal: total,
      targetAc,
      hit,
      critical,
      damageType: cmd.damage.type,
      damage: damage ?? 0,
      hpAfter,
      downed: hit && hpAfter <= 0,
      ...(attacksLeft !== undefined ? { attacksLeft } : {}),
    },
  };
}

function handleApplyCondition(
  cmd: ApplyConditionCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (!isCondition(cmd.condition)) {
    return reject("UNKNOWN_CONDITION", `Unknown condition: ${cmd.condition}.`);
  }
  const level =
    cmd.condition === "exhaustion"
      ? Math.max(1, Math.min(6, Math.floor(cmd.level ?? 1)))
      : undefined;
  return {
    accepted: true,
    events: [
      {
        type: "ConditionApplied",
        ...meta(ctx, "system"),
        payload: {
          target: cmd.target,
          condition: cmd.condition,
          ...(cmd.source ? { source: cmd.source } : {}),
          ...(level !== undefined ? { level } : {}),
        },
      },
    ],
    summary: { target: cmd.target, condition: cmd.condition, level },
  };
}

function handleRemoveCondition(
  cmd: RemoveConditionCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  return {
    accepted: true,
    events: [
      {
        type: "ConditionRemoved",
        ...meta(ctx, "system"),
        payload: { target: cmd.target, condition: cmd.condition },
      },
    ],
    summary: { target: cmd.target, condition: cmd.condition },
  };
}

function handleSavingThrow(
  cmd: SavingThrowCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }

  const { autoFail, mode: condMode } = saveResolution(
    cmd.ability,
    entity.conditions,
  );

  if (autoFail) {
    return {
      accepted: true,
      events: [
        {
          type: "SaveRolled",
          ...meta(ctx, cmd.entity),
          payload: {
            entity: cmd.entity,
            ability: cmd.ability,
            dc: cmd.dc,
            mode: "normal",
            success: false,
            autoFail: true,
          },
        },
      ],
      summary: { entity: cmd.entity, ability: cmd.ability, success: false, autoFail: true },
    };
  }

  const mode = combineMode((cmd.mode ?? "normal") as RollAdjust, condMode);
  const roll = ctx.roll("1d20", `save:${cmd.entity}:${cmd.ability}`, mode);
  const natural = roll.total;
  const total = natural + abilityModifier(entity.abilityScores[cmd.ability]);
  const success = total >= cmd.dc;

  return {
    accepted: true,
    events: [
      rollDiceEvent(ctx, roll),
      {
        type: "SaveRolled",
        ...meta(ctx, cmd.entity),
        payload: {
          entity: cmd.entity,
          ability: cmd.ability,
          dc: cmd.dc,
          mode: mode as RollMode,
          natural,
          total,
          success,
          autoFail: false,
        },
      },
    ],
    summary: { entity: cmd.entity, ability: cmd.ability, total, dc: cmd.dc, success, autoFail: false },
  };
}

function handleAbilityCheck(
  cmd: AbilityCheckCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }

  const mode = (cmd.mode ?? "normal") as RollMode;
  const roll = ctx.roll("1d20", `check:${cmd.entity}:${cmd.ability}`, mode);
  const natural = roll.total;
  const profBonus = cmd.proficient ? entity.proficiencyBonus : 0;
  const total =
    natural + abilityModifier(entity.abilityScores[cmd.ability]) + profBonus;
  const success = cmd.dc === undefined ? undefined : total >= cmd.dc;

  return {
    accepted: true,
    events: [
      rollDiceEvent(ctx, roll),
      {
        type: "CheckRolled",
        ...meta(ctx, cmd.entity),
        payload: {
          entity: cmd.entity,
          ability: cmd.ability,
          ...(cmd.skill ? { skill: cmd.skill } : {}),
          ...(cmd.dc !== undefined ? { dc: cmd.dc } : {}),
          mode,
          natural,
          total,
          proficient: cmd.proficient ?? false,
          ...(success !== undefined ? { success } : {}),
        },
      },
    ],
    summary: {
      entity: cmd.entity,
      ability: cmd.ability,
      ...(cmd.skill ? { skill: cmd.skill } : {}),
      total,
      ...(cmd.dc !== undefined ? { dc: cmd.dc } : {}),
      ...(success !== undefined ? { success } : {}),
      proficient: cmd.proficient ?? false,
    },
  };
}

function handleDeathSave(
  cmd: DeathSaveCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (entity.dead) {
    return reject("ALREADY_DEAD", `${entity.name} is already dead.`);
  }
  if (entity.hp.current > 0) {
    return reject("NOT_DYING", `${entity.name} is not dying (HP > 0).`);
  }
  if (entity.stable) {
    return reject("NOT_DYING", `${entity.name} is stable and need not roll.`);
  }

  const roll = ctx.roll("1d20", `death-save:${cmd.entity}`, cmd.mode);
  const current = entity.deathSaves ?? { successes: 0, failures: 0 };
  const res = resolveDeathSave(roll.total, current);

  return {
    accepted: true,
    events: [
      rollDiceEvent(ctx, roll),
      {
        type: "DeathSaveRolled",
        ...meta(ctx, cmd.entity),
        payload: {
          entity: cmd.entity,
          natural: roll.total,
          mode: cmd.mode ?? "normal",
          successes: res.successes,
          failures: res.failures,
          stable: res.stable,
          dead: res.dead,
          revived: res.revived,
        },
      },
    ],
    summary: {
      entity: cmd.entity,
      natural: roll.total,
      successes: res.successes,
      failures: res.failures,
      stable: res.stable,
      dead: res.dead,
      revived: res.revived,
    },
  };
}

function handleShortRest(
  cmd: ShortRestCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (entity.dead) {
    return reject("TARGET_DEAD", `${entity.name} is dead.`);
  }

  const events: DraftEvent[] = [];
  const dice = Math.max(0, Math.floor(cmd.hitDice ?? 0));
  if (dice > 0 && cmd.dieSize && cmd.dieSize > 0) {
    const conMod = abilityModifier(entity.abilityScores.con);
    const roll = ctx.roll(`${dice}d${cmd.dieSize}`, `short-rest:${cmd.entity}`);
    const healed = Math.max(0, roll.total + conMod * dice);
    const hpAfter = Math.min(entity.hp.max, entity.hp.current + healed);
    events.push(rollDiceEvent(ctx, roll));
    events.push({
      type: "HealingApplied",
      ...meta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        amount: healed,
        hpBefore: entity.hp.current,
        hpAfter,
      },
    });
  }
  events.push({
    type: "Rested",
    ...meta(ctx, cmd.entity),
    payload: { entity: cmd.entity, kind: "short" },
  });

  return { accepted: true, events, summary: { entity: cmd.entity, kind: "short" } };
}

function handleLongRest(
  cmd: LongRestCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (entity.dead) {
    return reject("TARGET_DEAD", `${entity.name} is dead.`);
  }

  const events: DraftEvent[] = [];
  // Full HP recovery (also clears dying state in the projection).
  if (entity.hp.current < entity.hp.max) {
    events.push({
      type: "HealingApplied",
      ...meta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        amount: entity.hp.max - entity.hp.current,
        hpBefore: entity.hp.current,
        hpAfter: entity.hp.max,
      },
    });
  }
  // Exhaustion drops by one level per SRD long rest.
  const exhaustion = entity.conditions.find((c) => c.condition === "exhaustion");
  if (exhaustion) {
    const level = exhaustion.level ?? 1;
    if (level <= 1) {
      events.push({
        type: "ConditionRemoved",
        ...meta(ctx, cmd.entity),
        payload: { target: cmd.entity, condition: "exhaustion" },
      });
    } else {
      events.push({
        type: "ConditionApplied",
        ...meta(ctx, cmd.entity),
        payload: { target: cmd.entity, condition: "exhaustion", level: level - 1 },
      });
    }
  }
  // A long rest restores all expended spell slots.
  if (entity.spellcasting) {
    events.push({
      type: "SpellSlotsRestored",
      ...meta(ctx, cmd.entity),
      payload: { entity: cmd.entity },
    });
  }
  events.push({
    type: "Rested",
    ...meta(ctx, cmd.entity),
    payload: { entity: cmd.entity, kind: "long" },
  });

  return { accepted: true, events, summary: { entity: cmd.entity, kind: "long" } };
}

function handleStartConcentration(
  cmd: StartConcentrationCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const events: DraftEvent[] = [];
  // Starting a new concentration spell breaks any existing one.
  if (entity.concentration) {
    events.push({
      type: "ConcentrationBroken",
      ...meta(ctx, cmd.entity),
      payload: { entity: cmd.entity, reason: "recast" },
    });
  }
  events.push({
    type: "ConcentrationStarted",
    ...meta(ctx, cmd.entity),
    payload: { entity: cmd.entity, spell: cmd.spell },
  });
  return {
    accepted: true,
    events,
    summary: { entity: cmd.entity, spell: cmd.spell },
  };
}

function handleEndConcentration(
  cmd: EndConcentrationCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.concentration) {
    return {
      accepted: true,
      events: [],
      summary: { entity: cmd.entity, wasConcentrating: false },
    };
  }
  return {
    accepted: true,
    events: [
      {
        type: "ConcentrationBroken",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity, reason: "ended" },
      },
    ],
    summary: { entity: cmd.entity, wasConcentrating: true },
  };
}

function handleDispelMagic(
  cmd: DispelMagicCommand,
  ctx: ExecutionContext,
): CommandResult {
  const caster = ctx.world.entities[cmd.caster];
  if (!caster) {
    return reject("ACTOR_NOT_FOUND", `Caster ${cmd.caster} does not exist.`);
  }
  if (!caster.spellcasting) {
    return reject("NOT_A_SPELLCASTER", `${caster.name} cannot cast spells.`);
  }
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  const slotLevel = Math.floor(cmd.slotLevel);
  if (slotLevel < 3) {
    return reject(
      "INVALID_PAYLOAD",
      "Dispel Magic requires a level-3 slot or higher.",
    );
  }
  const slot = caster.spellcasting.slots[slotLevel];
  if (!slot || slot.current <= 0) {
    return reject(
      "NO_SPELL_SLOT",
      `${caster.name} has no level-${slotLevel} spell slot available.`,
      { slotLevel },
    );
  }

  const events: DraftEvent[] = [
    {
      type: "SpellSlotExpended",
      ...meta(ctx, cmd.caster),
      payload: { entity: cmd.caster, slotLevel },
    },
  ];

  const effects = target.effects ?? [];
  if (effects.length > 0) {
    events.push({
      type: "EffectRemoved",
      ...meta(ctx, cmd.caster),
      payload: { target: cmd.target, effectId: effects[0]!.id },
    });
    return {
      accepted: true,
      events,
      summary: { target: cmd.target, dispelled: "effect" },
    };
  }

  const linked = target.conditions.find((c) => c.concentrationSpell);
  if (linked) {
    events.push({
      type: "ConditionRemoved",
      ...meta(ctx, cmd.caster),
      payload: { target: cmd.target, condition: linked.condition },
    });
    return {
      accepted: true,
      events,
      summary: { target: cmd.target, dispelled: "condition" },
    };
  }

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, dispelled: "none" },
  };
}

function spellConditionPayload(
  spell: SpellDefinition,
  casterId: EntityRef,
  targetId: EntityRef,
  condition: NonNullable<SpellDefinition["failedSaveCondition"]>,
) {
  return {
    target: targetId,
    condition,
    source: casterId,
    ...(spell.concentration
      ? { concentrationSpell: spell.name, concentrationHolder: casterId }
      : {}),
  };
}

function effectOptsFromSpell(
  spell: SpellDefinition,
  ctx: ExecutionContext,
  casterId: EntityRef,
  targetId: EntityRef,
  spec: import("../content/spells").SpellAppliedEffect,
) {
  const timed =
    !spec.concentration && !spec.expiresStartOfNextTurn
      ? spellDurationRounds(spell)
      : undefined;
  return {
    id: `${ctx.commandId}:${spell.id}:${targetId}`,
    source: casterId,
    concentrationHolder: spec.concentration ? casterId : undefined,
    concentrationSpell: spec.concentration ? spell.name : undefined,
    markedBy: spec.modifier.type === "hunters_mark" ? casterId : undefined,
    expiresStartOfTurn: spec.expiresStartOfNextTurn ? targetId : undefined,
    remainingRounds: timed,
  };
}

function handleOpportunityAttack(
  cmd: OpportunityAttackCommand,
  ctx: ExecutionContext,
): CommandResult {
  const reactor = ctx.world.entities[cmd.reactor];
  if (!reactor) {
    return reject("ACTOR_NOT_FOUND", `Reactor ${cmd.reactor} does not exist.`);
  }
  if (reactor.reaction !== "available") {
    return reject(
      "NO_REACTION",
      `${reactor.name} has no reaction available this round.`,
    );
  }
  const window = ctx.world.encounter?.reactionWindow;
  const provoked =
    window !== undefined &&
    window.mover === cmd.target &&
    window.eligible.includes(cmd.reactor);
  if (!provoked) {
    return reject(
      "NOT_PROVOKED",
      `${cmd.target} did not provoke an opportunity attack from ${reactor.name}.`,
    );
  }

  const target = ctx.world.entities[cmd.target];
  const targetPosition =
    window.moverAtProvocation ?? target?.position;

  const result = handleAttack(
    {
      type: "attack",
      attacker: cmd.reactor,
      target: cmd.target,
      attackBonus: cmd.attackBonus,
      damage: cmd.damage,
      rangeFt: cmd.rangeFt ?? REACH_FEET,
      ...(cmd.mode ? { mode: cmd.mode } : {}),
    },
    ctx,
    {
      viaReaction: true,
      ...(targetPosition ? { targetPosition } : {}),
    },
  );
  if (!result.accepted) return result;

  return {
    accepted: true,
    events: [
      ...result.events,
      {
        type: "ReactionTaken",
        ...meta(ctx, cmd.reactor),
        payload: { reactor: cmd.reactor, trigger: "opportunity_attack" },
      },
    ],
    summary: { ...result.summary, reaction: "opportunity_attack" },
  };
}

function handleReadyAction(
  cmd: ReadyActionCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const encounter = ctx.world.encounter;
  const active = encounter?.order[encounter.activeIndex]?.entity;
  if (!encounter || active !== cmd.entity) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} can only ready an action on its own turn.`,
    );
  }
  if (isIncapacitated(entity.conditions)) {
    return reject("ACTION_UNAVAILABLE", `${entity.name} is incapacitated.`);
  }
  if (entity.actionEconomy?.action !== "available") {
    return reject(
      "ACTION_UNAVAILABLE",
      `${entity.name} has already used its action this turn.`,
    );
  }

  return {
    accepted: true,
    events: [
      {
        type: "ActionReadied",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity, trigger: cmd.trigger, action: cmd.action },
      },
    ],
    summary: { entity: cmd.entity, trigger: cmd.trigger },
  };
}

function handleTriggerReadied(
  cmd: TriggerReadiedCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  if (!entity.readied) {
    return reject("NO_READIED_ACTION", `${entity.name} has no readied action.`);
  }
  if (entity.reaction !== "available") {
    return reject(
      "NO_REACTION",
      `${entity.name} has no reaction available this round.`,
    );
  }

  const action = entity.readied.action;
  const result = handleAttack(
    {
      type: "attack",
      attacker: cmd.entity,
      target: action.target,
      attackBonus: action.attackBonus,
      damage: action.damage,
      rangeFt: action.rangeFt ?? readyTriggerRangeFeet(entity.readied.trigger),
    },
    ctx,
    { viaReaction: true },
  );
  if (!result.accepted) return result;

  return {
    accepted: true,
    events: [
      ...result.events,
      {
        type: "ReadiedActionTriggered",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity },
      },
      {
        type: "ReactionTaken",
        ...meta(ctx, cmd.entity),
        payload: { reactor: cmd.entity, trigger: "readied" },
      },
    ],
    summary: { ...result.summary, reaction: "readied" },
  };
}

/**
 * The maximum reach of a spell's range in feet, or undefined when distance is
 * not capped for foundation purposes (sight / unlimited / miles). `self` is 0.
 */
function spellRangeFeet(range: SpellRange): number | undefined {
  switch (range.type) {
    case "self":
      return 0;
    case "touch":
      return 5;
    case "feet":
      return range.amount;
    default:
      return undefined;
  }
}

/**
 * A running HP ledger for a single cast, so multiple hits in one command
 * (e.g. several Magic Missile darts on one creature) report accurate
 * before/after HP instead of all reading the pre-cast value. Seeded lazily
 * from the world projection.
 */
type HpLedger = Map<EntityRef, { current: number; temp: number }>;

function ledgerEntry(
  world: ExecutionContext["world"],
  id: EntityRef,
  ledger: HpLedger,
): { current: number; temp: number } {
  let entry = ledger.get(id);
  if (!entry) {
    const e = world.entities[id]!;
    entry = { current: e.hp.current, temp: e.hp.temp };
    ledger.set(id, entry);
  }
  return entry;
}

/** Rebuild a dice notation from a count/sides/modifier triple. */
function diceNotation(count: number, sides: number, modifier: number): string {
  const mod =
    modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${count}d${sides}${mod}`;
}

/** Roll one damage component (cantrip scaling + upcast on index 0 only). */
function rollDamageComponent(
  ctx: ExecutionContext,
  component: { dice: string; type: string },
  spell: SpellDefinition,
  casterLevel: number,
  extraLevels: number,
  crit: boolean,
  scopeBase: string,
  componentIndex: number,
): { amount: number; events: DraftEvent[] } {
  const events: DraftEvent[] = [];
  const parsed = parseDice(component.dice);
  const baseCount =
    spell.level === 0
      ? parsed.count * cantripDamageDice(casterLevel)
      : parsed.count;
  const scaledNotation = diceNotation(baseCount, parsed.sides, parsed.modifier);
  const baseNotation = crit ? criticalNotation(scaledNotation) : scaledNotation;
  const scope =
    componentIndex === 0
      ? `${scopeBase}:base`
      : `${scopeBase}:${component.type}`;
  const baseRoll = ctx.roll(baseNotation, scope);
  events.push(rollDiceEvent(ctx, baseRoll));
  let amount = Math.max(0, baseRoll.total);

  if (
    componentIndex === 0 &&
    spell.upcastScaling?.appliesTo === "damage" &&
    extraLevels > 0
  ) {
    const per = parseDice(spell.upcastScaling.perSlotDice);
    const count = per.count * extraLevels * (crit ? 2 : 1);
    const upRoll = ctx.roll(`${count}d${per.sides}`, `${scopeBase}:upcast`);
    events.push(rollDiceEvent(ctx, upRoll));
    amount += Math.max(0, upRoll.total);
  }
  return { amount, events };
}

/** Roll every damage component on a spell (multi-type hits like Ice Storm). */
function rollSpellDamage(
  ctx: ExecutionContext,
  spell: SpellDefinition,
  casterLevel: number,
  extraLevels: number,
  crit: boolean,
  scopeBase: string,
): { amount: number; events: DraftEvent[]; rolls: { amount: number; type: string }[] } {
  const components = spell.damage ?? [];
  const events: DraftEvent[] = [];
  const rolls: { amount: number; type: string }[] = [];
  let total = 0;
  for (let i = 0; i < components.length; i += 1) {
    const rolled = rollDamageComponent(
      ctx,
      components[i]!,
      spell,
      casterLevel,
      extraLevels,
      crit,
      scopeBase,
      i,
    );
    events.push(...rolled.events);
    rolls.push({ amount: rolled.amount, type: components[i]!.type });
    total += rolled.amount;
  }
  return { amount: total, events, rolls };
}

/** Roll a spell's healing: base dice (+ the caster's spellcasting modifier when
 * the component opts in) plus upcast dice for slot levels above base. */
function rollSpellHealing(
  ctx: ExecutionContext,
  spell: SpellDefinition,
  caster: EntityState,
  extraLevels: number,
  scopeBase: string,
): { amount: number; events: DraftEvent[] } {
  const healing = spell.healing!;
  const events: DraftEvent[] = [];
  const baseRoll = ctx.roll(healing.dice, `${scopeBase}:base`);
  events.push(rollDiceEvent(ctx, baseRoll));
  let amount = baseRoll.total;
  if (healing.addSpellMod) {
    amount += spellcastingModifier(caster) ?? 0;
  }
  if (spell.upcastScaling?.appliesTo === "healing" && extraLevels > 0) {
    const per = parseDice(spell.upcastScaling.perSlotDice);
    const count = per.count * extraLevels;
    const upRoll = ctx.roll(`${count}d${per.sides}`, `${scopeBase}:upcast`);
    events.push(rollDiceEvent(ctx, upRoll));
    amount += Math.max(0, upRoll.total);
  }
  return { amount: Math.max(0, amount), events };
}

/** Apply already-rolled damage to a target through the ledger, emitting the
 * DamageDealt event plus any concentration check. */
function applyLedgerDamage(
  ctx: ExecutionContext,
  target: EntityState,
  amount: number,
  damageType: string,
  ledger: HpLedger,
): DraftEvent[] {
  const entry = ledgerEntry(ctx.world, target.id, ledger);
  const hpBefore = entry.current;
  const fromTemp = Math.min(entry.temp, amount);
  entry.temp -= fromTemp;
  const hpAfter = Math.max(0, entry.current - (amount - fromTemp));
  entry.current = hpAfter;
  return [
    {
      type: "DamageDealt",
      ...meta(ctx),
      payload: { target: target.id, amount, damageType, hpBefore, hpAfter },
    },
    ...concentrationCheckEvents(ctx, target, amount, hpAfter),
  ];
}

/** Apply each rolled damage component after save scaling (Ice Storm, etc.). */
function applySpellRollsToTarget(
  ctx: ExecutionContext,
  target: EntityState,
  rolls: { amount: number; type: string }[],
  ledger: HpLedger,
  saveSuccess: boolean,
  onSuccess: import("../content/spells").SaveOutcome | undefined,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  for (const roll of rolls) {
    let amount = roll.amount;
    if (saveSuccess) {
      amount =
        onSuccess === "half_damage" ? Math.floor(amount / 2) : 0;
    }
    if (amount > 0) {
      events.push(...applyLedgerDamage(ctx, target, amount, roll.type, ledger));
    }
  }
  return events;
}

/**
 * Roll one creature's saving throw against a fixed DC, honouring condition
 * auto-fails (STR/DEX while paralyzed etc.) and advantage/disadvantage. Mirrors
 * `handleSavingThrow` but returns the outcome so the cast pipeline can scale
 * damage (save-for-half) per affected creature.
 */
function rollSpellSave(
  ctx: ExecutionContext,
  target: EntityState,
  ability: Ability,
  dc: number,
): { success: boolean; events: DraftEvent[] } {
  const { autoFail, mode } = saveResolution(ability, target.conditions);
  if (autoFail) {
    return {
      success: false,
      events: [
        {
          type: "SaveRolled",
          ...meta(ctx, target.id),
          payload: {
            entity: target.id,
            ability,
            dc,
            mode: "normal",
            success: false,
            autoFail: true,
          },
        },
      ],
    };
  }
  const roll = ctx.roll("1d20", `save:${target.id}:${ability}`, mode);
  const natural = roll.total;
  const total = natural + abilityModifier(target.abilityScores[ability]);
  const success = total >= dc;
  return {
    success,
    events: [
      rollDiceEvent(ctx, roll),
      {
        type: "SaveRolled",
        ...meta(ctx, target.id),
        payload: {
          entity: target.id,
          ability,
          dc,
          mode: mode as RollMode,
          natural,
          total,
          success,
          autoFail: false,
        },
      },
    ],
  };
}

function handleCastSpell(
  cmd: CastSpellCommand,
  ctx: ExecutionContext,
): CommandResult {
  const caster = ctx.world.entities[cmd.caster];
  if (!caster) {
    return reject("ACTOR_NOT_FOUND", `Caster ${cmd.caster} does not exist.`);
  }
  if (!caster.alive) {
    return reject("TARGET_DEAD", `${caster.name} cannot cast while down.`);
  }
  if (isIncapacitated(caster.conditions)) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${caster.name} is incapacitated and cannot cast.`,
    );
  }
  const spell = getSpell(cmd.spellId);
  if (!spell) {
    return reject("SPELL_NOT_FOUND", `Unknown spell "${cmd.spellId}".`);
  }
  if (!caster.spellcasting) {
    return reject("NOT_A_SPELLCASTER", `${caster.name} cannot cast spells.`);
  }
  if (!isSpellPrepared(caster.spellcasting.preparedSpellIds, spell.id)) {
    return reject(
      "SPELL_NOT_PREPARED",
      `${caster.name} does not have ${spell.name} prepared or known.`,
      { spellId: spell.id },
    );
  }
  const casterLevel = totalLevel(caster.classes);

  // Bonus-action spells (Healing Word) cost the bonus action while in combat;
  // out of combat (no action economy) casting is unbudgeted, like movement.
  const usesBonusAction = spell.castingTime.unit === "bonus";
  if (
    usesBonusAction &&
    caster.actionEconomy &&
    caster.actionEconomy.bonusAction !== "available"
  ) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${caster.name} has already used its bonus action this turn.`,
    );
  }

  // Action-cost spells spend the single action. Gate it on the owner's turn so
  // you can't both attack and cast (or cast twice) in one turn; out of combat
  // (no economy) casting is unbudgeted. Reaction/longer cast times are exempt.
  const usesReaction = spell.castingTime.unit === "reaction";
  if (
    usesReaction &&
    caster.reaction !== undefined &&
    caster.reaction !== "available"
  ) {
    return reject(
      "NO_REACTION",
      `${caster.name} has no reaction available this round.`,
    );
  }
  const usesAction = spell.castingTime.unit === "action";
  if (
    usesAction &&
    caster.actionEconomy &&
    caster.actionEconomy.action !== "available"
  ) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${caster.name} has already used its action this turn.`,
    );
  }

  // Slot accounting. Cantrips (level 0) consume no slot; leveled spells must be
  // cast with a slot at or above their level, and that slot must be available.
  const isCantrip = spell.level === 0;
  const slotLevel = isCantrip ? 0 : Math.floor(cmd.slotLevel);
  if (!isCantrip) {
    if (slotLevel < spell.level) {
      return reject(
        "INVALID_PAYLOAD",
        `${spell.name} must be cast with a level-${spell.level} slot or higher.`,
      );
    }
    if (slotLevel < 1 || slotLevel > 9) {
      return reject("INVALID_PAYLOAD", `Slot level ${slotLevel} is invalid.`);
    }
    const slot = caster.spellcasting.slots[slotLevel];
    if (!slot || slot.current <= 0) {
      return reject(
        "NO_SPELL_SLOT",
        `${caster.name} has no level-${slotLevel} spell slot available.`,
        { slotLevel },
      );
    }
  }
  const extraLevels = slotLevel - spell.level;

  // Resolve the affected-target list. Projectile spells (Magic Missile) take one
  // target entry per dart; single/multi spells take one entry per target.
  const targets = cmd.targets ?? [];

  if (spell.id === "misty-step") {
    if (!cmd.origin) {
      return reject(
        "INVALID_PAYLOAD",
        "Misty Step requires a destination cell.",
      );
    }
    if (!caster.position || !caster.sceneId) {
      return reject(
        "INVALID_PAYLOAD",
        `${caster.name} must be placed on the map to teleport.`,
      );
    }
    if (distanceFeet(caster.position, cmd.origin) > 30) {
      return reject(
        "OUT_OF_RANGE",
        "Misty Step can only teleport up to 30 feet.",
      );
    }
    const occupied = Object.values(ctx.world.entities).some(
      (e) =>
        e.id !== caster.id &&
        e.alive &&
        e.sceneId === caster.sceneId &&
        e.position &&
        sameCell(e.position, cmd.origin!),
    );
    if (occupied) {
      return reject("INVALID_TARGET", "That square is occupied.");
    }
    const events: DraftEvent[] = [
      {
        type: "SpellCast",
        ...meta(ctx, cmd.caster),
        payload: {
          caster: cmd.caster,
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targets: [cmd.caster],
          bonusAction: true,
        },
      },
      {
        type: "SpellSlotExpended",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, slotLevel },
      },
      {
        type: "EntityRelocated",
        ...meta(ctx, cmd.caster),
        payload: {
          entity: cmd.caster,
          sceneId: caster.sceneId,
          position: cmd.origin,
        },
      },
    ];
    return {
      accepted: true,
      events,
      summary: { caster: cmd.caster, spellId: spell.id, teleported: true },
    };
  }

  let dartCount: number | undefined;
  if (spell.targeting === "area") {
    // Area spells resolve from `origin` + the area shape below; `targets` is
    // ignored. Validation/gathering happens in the dedicated area block.
  } else if (spell.targeting === "self") {
    if (targets.length > 0 && targets.some((t) => t !== caster.id)) {
      return reject("INVALID_TARGET", `${spell.name} only targets the caster.`);
    }
  } else if (spell.projectiles) {
    dartCount =
      spell.projectiles.base + spell.projectiles.perSlotLevel * extraLevels;
    if (targets.length !== dartCount) {
      return reject(
        "INVALID_PAYLOAD",
        `${spell.name} fires ${dartCount} darts; provide one target per dart.`,
        { darts: dartCount, provided: targets.length },
      );
    }
  } else if (spell.targeting === "single") {
    if (targets.length !== 1) {
      return reject("INVALID_PAYLOAD", `${spell.name} targets a single creature.`);
    }
  } else if (spell.targeting === "multi") {
    if (targets.length < 1) {
      return reject("INVALID_PAYLOAD", `${spell.name} needs at least one target.`);
    }
    if (targets.length > 3) {
      return reject(
        "INVALID_PAYLOAD",
        `${spell.name} targets at most three creatures.`,
        { provided: targets.length },
      );
    }
  } else if (targets.length < 1) {
    return reject("INVALID_PAYLOAD", `${spell.name} needs at least one target.`);
  }

  // Validate every distinct target up front (existence, alive, range, LOS) so a
  // rejected cast produces no events and no state change.
  const maxRange = spellRangeFeet(spell.range);
  for (const targetId of new Set(targets)) {
    const target = ctx.world.entities[targetId];
    if (!target) {
      return reject("TARGET_NOT_FOUND", `Target ${targetId} does not exist.`, {
        entity: targetId,
      });
    }
    // Healing may target a downed (0 HP, not yet dead) ally to revive them;
    // every other spell needs a living target.
    if (!target.alive && !(spell.healing && !target.dead)) {
      return reject("INVALID_TARGET", `${target.name} is not a valid target.`, {
        entity: targetId,
      });
    }
    // Range + line of sight apply only when both are placed in the same mapped
    // scene; mapless/unplaced casting (narrative, tests) is unconstrained.
    if (
      caster.position &&
      target.position &&
      caster.sceneId &&
      caster.sceneId === target.sceneId
    ) {
      if (
        maxRange !== undefined &&
        distanceFeet(caster.position, target.position) > maxRange
      ) {
        return reject(
          "OUT_OF_RANGE",
          `${target.name} is beyond ${spell.name}'s range.`,
          { entity: targetId },
        );
      }
      const map = ctx.world.scenes[caster.sceneId]?.map;
      if (map && targetId !== caster.id) {
        const exclude = new Set([caster.id, targetId]);
        const blocked = (cell: GridPosition): boolean =>
          map.blockedCells.some((c) => sameCell(c, cell)) ||
          occupantAt(ctx.world, caster.sceneId, cell, exclude) !== undefined;
        if (!hasLineOfSight(caster.position, target.position, blocked)) {
          return reject(
            "NO_LINE_OF_SIGHT",
            `${caster.name} has no line of sight to ${target.name}.`,
            { entity: targetId },
          );
        }
      }
    }
  }

  if (spell.id === "dispel-magic") {
    const targetId = targets[0];
    if (!targetId) {
      return reject(
        "INVALID_PAYLOAD",
        "Dispel Magic requires a target creature.",
      );
    }
    return handleDispelMagic(
      {
        type: "dispel_magic",
        caster: cmd.caster,
        target: targetId,
        slotLevel: slotLevel || 3,
      },
      ctx,
    );
  }

  if (spell.id === "srd-2024_remove-curse") {
    const targetId = targets[0];
    if (!targetId) {
      return reject("INVALID_PAYLOAD", "Remove Curse requires a target creature.");
    }
    const target = ctx.world.entities[targetId];
    if (!target) {
      return reject("TARGET_NOT_FOUND", `Target ${targetId} does not exist.`);
    }
    const removed = target.activeCurses?.length ?? 0;
    const events: DraftEvent[] = [
      {
        type: "SpellCast",
        ...meta(ctx, cmd.caster),
        payload: {
          caster: cmd.caster,
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targets: [targetId],
        },
      },
      {
        type: "SpellSlotExpended",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, slotLevel },
      },
    ];
    if (usesAction && caster.actionEconomy) {
      events.push({
        type: "ActionSpent",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, action: true },
      });
    }
    events.push(...buildClearAllCursesEvents(ctx, targetId, "cured"));
    return {
      accepted: true,
      events,
      summary: { caster: cmd.caster, target: targetId, cursesRemoved: removed },
    };
  }

  if (spell.id === "srd-2024_bestow-curse") {
    const targetId = targets[0];
    if (!targetId) {
      return reject("INVALID_PAYLOAD", "Bestow Curse requires a target creature.");
    }
    const target = ctx.world.entities[targetId];
    if (!target) {
      return reject("TARGET_NOT_FOUND", `Target ${targetId} does not exist.`);
    }
    const dc = spellSaveDC(caster)!;
    const save = rollSpellSave(ctx, target, "wis", dc);
    const events: DraftEvent[] = [
      {
        type: "SpellCast",
        ...meta(ctx, cmd.caster),
        payload: {
          caster: cmd.caster,
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targets: [targetId],
        },
      },
      {
        type: "SpellSlotExpended",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, slotLevel },
      },
      ...save.events,
    ];
    if (usesAction && caster.actionEconomy) {
      events.push({
        type: "ActionSpent",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, action: true },
      });
    }
    if (!save.success) {
      if (!target.activeCurses?.some((c) => c.curseSlug === "srd-spell_bestow-curse")) {
        events.push(
          ...buildApplyCurseEvents(ctx, targetId, "srd-spell_bestow-curse", {
            skipSave: true,
          }),
        );
      }
    }
    return {
      accepted: true,
      events,
      summary: {
        caster: cmd.caster,
        target: targetId,
        saveSuccess: save.success,
        cursed: !save.success,
      },
    };
  }

  if (spell.id === "counterspell") {
    const targetId = targets[0];
    if (!targetId) {
      return reject(
        "INVALID_PAYLOAD",
        "Counterspell requires the opposing caster as its target.",
      );
    }
    const events: DraftEvent[] = [
      {
        type: "SpellCast",
        ...meta(ctx, cmd.caster),
        payload: {
          caster: cmd.caster,
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targets: [targetId],
        },
      },
      {
        type: "SpellSlotExpended",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, slotLevel },
      },
    ];
    if (caster.reaction !== undefined) {
      events.push({
        type: "ReactionTaken",
        ...meta(ctx, cmd.caster),
        payload: { reactor: cmd.caster, trigger: "spell" },
      });
    }
    return {
      accepted: true,
      events,
      summary: { caster: cmd.caster, countered: targetId },
    };
  }

  if (spell.id === "polymorph") {
    const targetId = targets[0];
    if (!targetId) {
      return reject("INVALID_PAYLOAD", "Polymorph requires a target creature.");
    }
    const target = ctx.world.entities[targetId];
    if (!target) {
      return reject("TARGET_NOT_FOUND", `Target ${targetId} does not exist.`);
    }
    const events: DraftEvent[] = [
      {
        type: "SpellCast",
        ...meta(ctx, cmd.caster),
        payload: {
          caster: cmd.caster,
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targets: [targetId],
        },
      },
      {
        type: "SpellSlotExpended",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, slotLevel },
      },
      {
        type: "ConditionApplied",
        ...meta(ctx, cmd.caster),
        payload: spellConditionPayload(
          spell,
          cmd.caster,
          targetId,
          "restrained",
        ),
      },
    ];
    if (spell.concentration) {
      if (caster.concentration) {
        events.push({
          type: "ConcentrationBroken",
          ...meta(ctx, cmd.caster),
          payload: { entity: cmd.caster, reason: "recast" },
        });
      }
      events.push({
        type: "ConcentrationStarted",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, spell: spell.name },
      });
    }
    return {
      accepted: true,
      events,
      summary: { caster: cmd.caster, target: targetId, polymorphed: true },
    };
  }

  // Area spells (Fireball, Burning Hands) resolve from `origin` + the area
  // shape into the set of caught creatures; `targets` is unused. Validating
  // here keeps a rejected area cast side-effect-free.
  let areaAffected: EntityState[] | undefined;
  if (spell.targeting === "area") {
    const area = spell.range.area;
    if (!area) {
      return reject("INVALID_PAYLOAD", `${spell.name} has no area shape.`);
    }
    if (!cmd.origin) {
      return reject("INVALID_PAYLOAD", `${spell.name} needs an origin point.`);
    }
    const origin = cmd.origin;
    const isCone = area.shape === "cone";
    const isLine = area.shape === "line";
    const usesPointOrigin = !isCone && !isLine;
    if ((isCone || isLine) && !caster.position) {
      return reject(
        "INVALID_PAYLOAD",
        `${spell.name} needs the caster's position.`,
      );
    }
    const map = caster.sceneId
      ? ctx.world.scenes[caster.sceneId]?.map
      : undefined;
    const wallBlocked = (cell: GridPosition): boolean =>
      map ? map.blockedCells.some((c) => sameCell(c, cell)) : false;

    // A point-target sphere (range in feet) must be in range and visible — you
    // can't lob a Fireball past a wall or beyond its reach.
    if (usesPointOrigin && caster.position && spell.range.type === "feet") {
      const max = spell.range.amount;
      if (max !== undefined && distanceFeet(caster.position, origin) > max) {
        return reject(
          "OUT_OF_RANGE",
          `${spell.name}'s origin is beyond its range.`,
        );
      }
      if (map && !hasLineOfSight(caster.position, origin, wallBlocked)) {
        return reject(
          "NO_LINE_OF_SIGHT",
          `${caster.name} cannot see the target point.`,
        );
      }
    }

    // A sphere bursts from its center; a cone emanates from the caster. A wall
    // between that source and a creature shields it from the blast.
    const source = isCone || isLine ? caster.position! : origin;
    areaAffected = Object.values(ctx.world.entities)
      .filter((e) => {
        if (e.sceneId !== caster.sceneId || !e.alive || !e.position) {
          return false;
        }
        const inShape =
          isCone
            ? withinCone(caster.position!, origin, e.position, area.size)
            : isLine
              ? withinLine(caster.position!, origin, e.position, area.size)
              : area.shape === "cube"
                ? withinCube(origin, e.position, area.size)
                : withinBurst(origin, e.position, area.size);
        if (!inShape) return false;
        return !map || hasLineOfSight(source, e.position, wallBlocked);
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  // --- Accepted: build events. ---
  const events: DraftEvent[] = [
    {
      type: "SpellCast",
      ...meta(ctx, cmd.caster),
      payload: {
        caster: cmd.caster,
        spellId: spell.id,
        spellName: spell.name,
        slotLevel,
        targets: areaAffected
          ? areaAffected.map((e) => e.id)
          : [...targets],
        ...(usesBonusAction ? { bonusAction: true } : {}),
      },
    },
  ];
  if (!isCantrip) {
    events.push({
      type: "SpellSlotExpended",
      ...meta(ctx, cmd.caster),
      payload: { entity: cmd.caster, slotLevel },
    });
  }
  // Spend the action for an action-cost cast (own turn only). Bonus-action casts
  // already debit the bonus action via the SpellCast payload flag below.
  if (usesAction && caster.actionEconomy) {
    events.push({
      type: "ActionSpent",
      ...meta(ctx, cmd.caster),
      payload: { entity: cmd.caster, action: true },
    });
  }
  if (usesReaction && caster.reaction !== undefined) {
    events.push({
      type: "ReactionTaken",
      ...meta(ctx, cmd.caster),
      payload: { reactor: cmd.caster, trigger: "spell" },
    });
  }
  if (spell.concentration) {
    if (caster.concentration) {
      events.push({
        type: "ConcentrationBroken",
        ...meta(ctx, cmd.caster),
        payload: { entity: cmd.caster, reason: "recast" },
      });
    }
    events.push({
      type: "ConcentrationStarted",
      ...meta(ctx, cmd.caster),
      payload: { entity: cmd.caster, spell: spell.name },
    });
  }

  const ledger: HpLedger = new Map();
  const summary: CommandSummary = {
    caster: cmd.caster,
    spellId: spell.id,
    spellName: spell.name,
    slotLevel,
  };

  if (spell.damage && spell.attackAgainst) {
    // Single-target spell attack (Guiding Bolt).
    const target = ctx.world.entities[targets[0]!]!;
    const bonus = spellAttackBonus(caster)!;
    let proneMode: RollAdjust = "normal";
    if (
      spell.attackAgainst.type === "melee" &&
      caster.position &&
      target.position
    ) {
      const adjacent =
        distanceFeet(caster.position, target.position) <= 5;
      if (isProne(target.conditions)) {
        proneMode = adjacent ? "advantage" : "disadvantage";
      }
    }
    const mode = combineMode(
      (cmd.mode ?? "normal") as RollAdjust,
      ownAttackMode(caster.conditions),
      attackedMode(target.conditions),
      attacksAgainstHaveAdvantage(target) ? "advantage" : "normal",
      attacksAgainstHaveDisadvantage(target) ? "disadvantage" : "normal",
      proneMode,
    );
    const d20 = ctx.roll(
      "1d20",
      `spell-attack:${caster.id}->${target.id}`,
      mode as RollMode,
    );
    const natural = d20.total;
    let blessBonus = 0;
    for (const dice of attackRollBonusDice(caster)) {
      const roll = ctx.roll(
        dice,
        `spell-attack-bless:${caster.id}->${target.id}`,
      );
      events.push(rollDiceEvent(ctx, roll));
      blessBonus += roll.total;
    }
    let banePenalty = 0;
    for (const dice of attackRollPenaltyDice(caster)) {
      const roll = ctx.roll(
        dice,
        `spell-attack-bane:${caster.id}->${target.id}`,
      );
      events.push(rollDiceEvent(ctx, roll));
      banePenalty += roll.total;
    }
    const total = natural + bonus + blessBonus - banePenalty;
    const adjacentCrit =
      spell.attackAgainst.type === "melee" &&
      caster.position &&
      target.position &&
      distanceFeet(caster.position, target.position) <= 5 &&
      critsWhenAdjacent(target.conditions);
    const { hit, critical } = resolveHit(natural, total, effectiveAc(target), {
      forceCrit: adjacentCrit,
    });
    events.push(rollDiceEvent(ctx, d20));

    let damage: number | undefined;
    let damageRolls: { amount: number; type: string }[] = [];
    if (hit) {
      const rolled = rollSpellDamage(
        ctx,
        spell,
        casterLevel,
        extraLevels,
        critical,
        `spell-damage:${target.id}`,
      );
      events.push(...rolled.events);
      damage = rolled.amount;
      damageRolls = rolled.rolls;
    }
    events.push({
      type: "AttackResolved",
      ...meta(ctx, caster.id),
      payload: {
        attacker: caster.id,
        target: target.id,
        attackRoll: { natural, total, mode: mode as RollMode },
        targetAc: effectiveAc(target),
        hit,
        critical,
        damageType: spell.damage[0]!.type,
        ...(damage !== undefined ? { damage } : {}),
      },
    });
    if (hit && damageRolls.length > 0) {
      for (const comp of damageRolls) {
        events.push(
          ...applyLedgerDamage(ctx, target, comp.amount, comp.type, ledger),
        );
      }
    }
    Object.assign(summary, {
      target: target.id,
      hit,
      critical,
      damage: damage ?? 0,
    });
  } else if (spell.damage && spell.saveAgainst) {
    // Save-for-half / save-for-none (Fireball, Burning Hands, Sacred Flame).
    // Single-target spells use `targets`; area spells use the resolved set.
    // One shared damage roll covers the whole area; each creature halves (or
    // negates) it on its own save vs the caster's spell save DC.
    const affected =
      spell.targeting === "area"
        ? (areaAffected ?? [])
        : targets.map((id) => ctx.world.entities[id]!);
    const dc = spellSaveDC(caster)!;
    const ability = spell.saveAgainst.ability;
    const onSuccess = spell.saveAgainst.onSuccess;
    const damageType = spell.damage[0]!.type;
    const rolled = rollSpellDamage(
      ctx,
      spell,
      casterLevel,
      extraLevels,
      false,
      `spell-damage:${caster.id}`,
    );
    events.push(...rolled.events);
    let totalDamage = 0;
    let failures = 0;
    for (const target of affected) {
      const save = rollSpellSave(ctx, target, ability, dc);
      events.push(...save.events);
      if (!save.success) {
        failures += 1;
        if (spell.failedSaveCondition) {
          events.push({
            type: "ConditionApplied",
            ...meta(ctx, caster.id),
            payload: spellConditionPayload(
              spell,
              caster.id,
              target.id,
              spell.failedSaveCondition,
            ),
          });
        }
      }
      events.push(
        ...applySpellRollsToTarget(
          ctx,
          target,
          rolled.rolls,
          ledger,
          save.success,
          onSuccess,
        ),
      );
      totalDamage += rolled.rolls.reduce((sum, comp) => {
        let amount = comp.amount;
        if (save.success) {
          amount =
            onSuccess === "half_damage" ? Math.floor(comp.amount / 2) : 0;
        }
        return sum + amount;
      }, 0);
    }
    Object.assign(summary, {
      targets: affected.length,
      failures,
      rolledDamage: rolled.amount,
      damage: totalDamage,
      save: ability,
      dc,
    });
  } else if (spell.damage && spell.projectiles) {
    // Auto-hit darts (Magic Missile): one damage roll per dart→target.
    const damageType = spell.damage[0]!.type;
    let totalDamage = 0;
    targets.forEach((targetId, index) => {
      const target = ctx.world.entities[targetId]!;
      const roll = ctx.roll(
        spell.damage![0]!.dice,
        `spell-projectile:${caster.id}:${index}`,
      );
      events.push(rollDiceEvent(ctx, roll));
      const amount = Math.max(0, roll.total);
      totalDamage += amount;
      events.push(...applyLedgerDamage(ctx, target, amount, damageType, ledger));
    });
    Object.assign(summary, { darts: dartCount, damage: totalDamage });
  } else if (spell.damage) {
    // Auto-hit single/multi-target damage (no attack, no save).
    const damageType = spell.damage[0]!.type;
    let totalDamage = 0;
    for (const targetId of targets) {
      const target = ctx.world.entities[targetId]!;
      const rolled = rollSpellDamage(
        ctx,
        spell,
        casterLevel,
        extraLevels,
        false,
        `spell-damage:${caster.id}:${targetId}`,
      );
      events.push(...rolled.events);
      for (const comp of rolled.rolls) {
        totalDamage += comp.amount;
        events.push(
          ...applyLedgerDamage(ctx, target, comp.amount, comp.type, ledger),
        );
      }
    }
    Object.assign(summary, { targets: targets.length, damage: totalDamage });
  } else if (spell.healing) {
    // Healing (Cure Wounds, Healing Word): restore HP up to max, no overheal.
    // Targets are validated above (a downed-but-not-dead ally is allowed).
    let totalHealing = 0;
    for (const targetId of targets) {
      const target = ctx.world.entities[targetId]!;
      const rolled = rollSpellHealing(
        ctx,
        spell,
        caster,
        extraLevels,
        `spell-heal:${caster.id}:${targetId}`,
      );
      events.push(...rolled.events);
      const hpAfter = Math.min(target.hp.max, target.hp.current + rolled.amount);
      events.push({
        type: "HealingApplied",
        ...meta(ctx, caster.id),
        payload: {
          target: target.id,
          amount: rolled.amount,
          hpBefore: target.hp.current,
          hpAfter,
        },
      });
      totalHealing += rolled.amount;
    }
    Object.assign(summary, { targets: targets.length, healing: totalHealing });
  } else if (spell.saveAgainst && !spell.damage) {
    const affected =
      spell.targeting === "area"
        ? (areaAffected ?? [])
        : targets.map((id) => ctx.world.entities[id]!);
    const dc = spellSaveDC(caster)!;
    const ability = spell.saveAgainst.ability;
    let failures = 0;
    for (const target of affected) {
      const save = rollSpellSave(ctx, target, ability, dc);
      events.push(...save.events);
      if (!save.success) {
        failures += 1;
        if (spell.failedSaveCondition) {
          events.push({
            type: "ConditionApplied",
            ...meta(ctx, caster.id),
            payload: spellConditionPayload(
              spell,
              caster.id,
              target.id,
              spell.failedSaveCondition,
            ),
          });
        }
        if (spell.appliedEffects?.length) {
          for (const spec of spell.appliedEffects) {
            const recipients =
              spec.scope === "caster" ? [caster.id] : [target.id];
            for (const targetId of recipients) {
              const effect = effectFromSpec(
                spec,
                effectOptsFromSpell(spell, ctx, caster.id, targetId, spec),
              );
              events.push({
                type: "EffectApplied",
                ...meta(ctx, caster.id),
                payload: { target: targetId, effect },
              });
            }
          }
        }
      }
    }
    Object.assign(summary, {
      targets: affected.length,
      failures,
      save: ability,
      dc,
      effectsApplied: spell.appliedEffects?.length ?? 0,
    });
  }

  if (
    spell.appliedEffects?.length &&
    !(spell.saveAgainst && !spell.damage)
  ) {
    const effectTargets =
      spell.targeting === "self" ? [caster.id] : [...targets];
    for (const spec of spell.appliedEffects) {
      const recipients =
        spec.scope === "caster" ? [caster.id] : effectTargets;
      for (const targetId of recipients) {
        const effect = effectFromSpec(
          spec,
          effectOptsFromSpell(spell, ctx, caster.id, targetId, spec),
        );
        events.push({
          type: "EffectApplied",
          ...meta(ctx, caster.id),
          payload: { target: targetId, effect },
        });
      }
    }
    Object.assign(summary, { effectsApplied: spell.appliedEffects.length });
  }

  if (spell.appliedCondition) {
    const conditionTargets =
      spell.targeting === "self" ? [caster.id] : [...targets];
    for (const targetId of conditionTargets) {
      events.push({
        type: "ConditionApplied",
        ...meta(ctx, caster.id),
        payload: spellConditionPayload(
          spell,
          caster.id,
          targetId,
          spell.appliedCondition,
        ),
      });
    }
    Object.assign(summary, { conditionApplied: spell.appliedCondition });
  }

  return { accepted: true, events, summary };
}

/** Dispatch a command to its handler. */
export function handleCommand(
  command: Command,
  ctx: ExecutionContext,
): CommandResult {
  switch (command.type) {
    case "create_scene":
      return handleCreateScene(command, ctx);
    case "change_scene":
      return handleChangeScene(command, ctx);
    case "create_entity":
      return handleCreateEntity(command, ctx);
    case "roll_dice":
      return handleRollDice(command, ctx);
    case "apply_damage":
      return handleApplyDamage(command, ctx);
    case "apply_healing":
      return handleApplyHealing(command, ctx);
    case "move_entity":
      return handleMoveEntity(command, ctx);
    case "relocate_entity":
      return handleRelocateEntity(command, ctx);
    case "start_encounter":
      return handleStartEncounter(command, ctx);
    case "roll_initiative":
      return handleRollInitiative(command, ctx);
    case "add_combatant":
      return handleAddCombatant(command, ctx);
    case "end_encounter":
      return handleEndEncounter(command, ctx);
    case "end_turn":
      return handleEndTurn(command, ctx);
    case "attack":
      return handleAttack(command, ctx);
    case "apply_condition":
      return handleApplyCondition(command, ctx);
    case "remove_condition":
      return handleRemoveCondition(command, ctx);
    case "saving_throw":
      return handleSavingThrow(command, ctx);
    case "ability_check":
      return handleAbilityCheck(command, ctx);
    case "death_save":
      return handleDeathSave(command, ctx);
    case "short_rest":
      return handleShortRest(command, ctx);
    case "long_rest":
      return handleLongRest(command, ctx);
    case "start_concentration":
      return handleStartConcentration(command, ctx);
    case "end_concentration":
      return handleEndConcentration(command, ctx);
    case "dispel_magic":
      return handleDispelMagic(command, ctx);
    case "opportunity_attack":
      return handleOpportunityAttack(command, ctx);
    case "ready_action":
      return handleReadyAction(command, ctx);
    case "trigger_readied":
      return handleTriggerReadied(command, ctx);
    case "cast_spell":
      return handleCastSpell(command, ctx);
    case "detect_trap":
      return handleDetectTrap(command, ctx);
    case "disable_trap":
      return handleDisableTrap(command, ctx);
    case "trigger_trap":
      return handleTriggerTrap(command, ctx);
    case "coat_weapon":
      return handleCoatWeapon(command, ctx);
    case "apply_poison":
      return handleApplyPoison(command, ctx);
    case "resolve_poison_tick":
      return handleResolvePoisonTick(command, ctx);
    case "apply_curse":
      return handleApplyCurse(command, ctx);
    case "resolve_curse_tick":
      return handleResolveCurseTick(command, ctx);
    case "remove_curse":
      return handleRemoveCurse(command, ctx);
    case "set_scene_environmental_effects":
      return handleSetSceneEnvironmentalEffects(command, ctx);
    case "apply_environmental_effect":
      return handleApplyEnvironmentalEffect(command, ctx);
    case "resolve_environmental_effect_tick":
      return handleResolveEnvironmentalEffectTick(command, ctx);
    case "remove_environmental_effect":
      return handleRemoveEnvironmentalEffect(command, ctx);
  }
}
