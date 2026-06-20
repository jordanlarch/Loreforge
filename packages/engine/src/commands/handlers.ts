/**
 * Command handlers — validate then resolve a command into draft events.
 *
 * Each handler is a pure function of `(command, ctx)`. Validation failures
 * return a structured {@link CommandResult}; success returns the events to
 * append plus a compact summary (the summary is what gets fed back to the LLM
 * for narration — it never sees raw events). See `architecture.md` §4.4.
 */
import { abilityModifier } from "../entities/abilities";
import { sortInitiative, type InitiativeRollInput } from "../combat/initiative";
import { criticalNotation, resolveHit } from "../combat/attack";
import { distanceFeet, hasLineOfSight } from "../combat/grid";
import {
  attackedMode,
  charmedSources,
  combineMode,
  critsWhenAdjacent,
  effectiveSpeed,
  isCondition,
  isIncapacitated,
  ownAttackMode,
  saveResolution,
  type RollAdjust,
} from "../combat/conditions";
import { concentrationDC, resolveDeathSave } from "../combat/death";
import type { EntityState, GridPosition } from "../entities/types";
import type { RollMode } from "../rng/dice";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyConditionCommand,
  type ApplyDamageCommand,
  type ApplyHealingCommand,
  type AttackCommand,
  type ChangeSceneCommand,
  type Command,
  type CommandResult,
  type CreateEntityCommand,
  type CreateSceneCommand,
  type DamageSource,
  type DeathSaveCommand,
  type EndConcentrationCommand,
  type EndTurnCommand,
  type LongRestCommand,
  type MoveEntityCommand,
  type RemoveConditionCommand,
  type RollDiceCommand,
  type RollInitiativeCommand,
  type SavingThrowCommand,
  type ShortRestCommand,
  type StartConcentrationCommand,
  type StartEncounterCommand,
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
  return {
    accepted: true,
    events: [{ type: "SceneCreated", ...meta(ctx, "system"), payload: { scene: cmd.scene } }],
    summary: { sceneId: cmd.scene.id },
  };
}

function handleChangeScene(
  cmd: ChangeSceneCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (!ctx.world.scenes[cmd.sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.sceneId} does not exist.`);
  }
  return {
    accepted: true,
    events: [{ type: "SceneChanged", ...meta(ctx, "system"), payload: { sceneId: cmd.sceneId } }],
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

  if (effectiveSpeed(entity.speed, entity.conditions) === 0) {
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

  return {
    accepted: true,
    events: [
      {
        type: "EntityMoved",
        ...meta(ctx, cmd.entity),
        payload: { entity: cmd.entity, from: entity.position, to },
      },
    ],
    summary: { entity: cmd.entity, to },
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
  for (const ref of cmd.combatants) {
    if (!ctx.world.entities[ref]) {
      return reject("TARGET_NOT_FOUND", `Combatant ${ref} does not exist.`, {
        entity: ref,
      });
    }
  }
  return {
    accepted: true,
    events: [
      {
        type: "EncounterStarted",
        ...meta(ctx, "system"),
        payload: { sceneId, combatants: [...cmd.combatants] },
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

  return {
    accepted: true,
    events,
    summary: { order, active: first.entity, round: 1 },
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
  }
  events.push({
    type: "TurnStarted",
    ...meta(ctx, nextEntity),
    payload: { entity: nextEntity, index: nextIndex },
  });

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

  // Line of sight is enforced only when both combatants are placed in the same
  // mapped scene; mapless / unplaced combat (narrative, tests) is unaffected.
  if (
    attacker.position &&
    target.position &&
    attacker.sceneId &&
    attacker.sceneId === target.sceneId
  ) {
    const map = ctx.world.scenes[attacker.sceneId]?.map;
    if (map) {
      const exclude = new Set([attacker.id, target.id]);
      const blocked = (cell: GridPosition): boolean =>
        map.blockedCells.some((c) => sameCell(c, cell)) ||
        occupantAt(ctx.world, attacker.sceneId, cell, exclude) !== undefined;
      if (!hasLineOfSight(attacker.position, target.position, blocked)) {
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
    attacker.position && target.position
      ? distanceFeet(attacker.position, target.position) <= 5
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
    proneMode,
  );

  const d20 = ctx.roll("1d20", `attack:${cmd.attacker}->${cmd.target}`, mode);
  // "1d20" carries no modifier, so the total is the natural face (or the chosen
  // face under advantage/disadvantage).
  const natural = d20.total;
  const total = natural + cmd.attackBonus;
  const forceCrit =
    adjacent === true && critsWhenAdjacent(target.conditions);
  const { hit, critical } = resolveHit(natural, total, target.baseAc, {
    forceCrit,
  });

  const events: DraftEvent[] = [rollDiceEvent(ctx, d20)];

  let damage: number | undefined;
  let hpAfter = target.hp.current;
  if (hit) {
    const notation = critical
      ? criticalNotation(cmd.damage.notation)
      : cmd.damage.notation;
    const dmg = ctx.roll(notation, `damage:${cmd.target}`);
    events.push(rollDiceEvent(ctx, dmg));
    damage = Math.max(0, dmg.total);
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
      targetAc: target.baseAc,
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
  }

  return {
    accepted: true,
    events,
    summary: {
      attacker: cmd.attacker,
      target: cmd.target,
      natural,
      attackTotal: total,
      targetAc: target.baseAc,
      hit,
      critical,
      damageType: cmd.damage.type,
      damage: damage ?? 0,
      hpAfter,
      downed: hit && hpAfter <= 0,
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
    case "start_encounter":
      return handleStartEncounter(command, ctx);
    case "roll_initiative":
      return handleRollInitiative(command, ctx);
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
  }
}
