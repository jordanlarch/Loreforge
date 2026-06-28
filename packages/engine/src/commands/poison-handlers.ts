/**
 * Gameplay Toolbox poison commands (GRILL-LIVE-POISON).
 * coat_weapon / apply_poison / resolve_poison_tick — deterministic saves and effects.
 */
import type { Condition } from "../combat/conditions";
import { abilityModifier } from "../entities/abilities";
import {
  getPoisonDefinition,
  type PoisonDefinition,
} from "../content/srd-poison-seeds";
import type { ActivePoisonInstance, EntityRef } from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyPoisonCommand,
  type CoatWeaponCommand,
  type CommandResult,
  type ResolvePoisonTickCommand,
} from "./types";

type PoisonHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function poisonMeta(ctx: ExecutionContext, actor?: string): PoisonHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

const INJURY_DAMAGE_TYPES = new Set(["piercing", "slashing"]);

/** Repeat-save poisons tick at turn start (Q4). */
export function poisonNeedsRepeatTick(def: PoisonDefinition): boolean {
  if (!def.repeat) return false;
  const r = def.repeat.toLowerCase();
  return (
    r.includes("repeat save") ||
    r.includes("start of each") ||
    r.includes("each turn")
  );
}

function poisonRepeatSuccessThreshold(def: PoisonDefinition): number | undefined {
  const r = def.repeat?.toLowerCase() ?? "";
  const match = r.match(/after (\w+) successful saves/);
  if (!match) return undefined;
  const word = match[1]!;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
  return words[word] ?? (Number.parseInt(word, 10) || undefined);
}

function shouldTrackActivePoison(
  def: PoisonDefinition,
  saveSuccess: boolean | undefined,
): boolean {
  if (!def.repeat) return false;
  if (saveSuccess === undefined) return true;
  if (saveSuccess && def.save?.onSuccess === "negates") return false;
  if (saveSuccess && def.save?.onSuccess === "half") return false;
  return true;
}

function makeInstanceId(target: EntityRef, slug: string, index: number): string {
  return `poison:${target}:${slug}:${index}`;
}

function applyPoisonDamageAndConditions(
  ctx: ExecutionContext,
  def: PoisonDefinition,
  target: EntityRef,
  damageMultiplier: number,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  const entity = ctx.world.entities[target];
  if (!entity) return events;

  if (def.damage?.length) {
    for (const chunk of def.damage) {
      const dmgRoll = ctx.roll(chunk.dice, `poison-dmg:${target}:${chunk.type}`, "normal");
      events.push({
        type: "DiceRolled",
        ...poisonMeta(ctx, "system"),
        payload: {
          notation: dmgRoll.notation,
          rolls: dmgRoll.rolls,
          total: dmgRoll.total,
          scope: dmgRoll.scope,
          drawIndex: dmgRoll.drawIndex,
          mode: "normal",
        },
      });
      const amount = Math.floor(dmgRoll.total * damageMultiplier);
      if (amount > 0) {
        const fromTemp = Math.min(entity.hp.temp, amount);
        const toCurrent = amount - fromTemp;
        const hpAfter = Math.max(0, entity.hp.current - toCurrent);
        events.push({
          type: "DamageDealt",
          ...poisonMeta(ctx, "system"),
          payload: {
            target,
            amount,
            damageType: chunk.type,
            hpBefore: entity.hp.current,
            hpAfter,
          },
        });
      }
    }
  }

  if (def.conditions?.length && damageMultiplier === 1) {
    for (const condition of def.conditions) {
      events.push({
        type: "ConditionApplied",
        ...poisonMeta(ctx, "system"),
        payload: {
          target,
          condition: condition as Condition,
        },
      });
    }
  }

  return events;
}

function rollPoisonSave(
  ctx: ExecutionContext,
  target: EntityRef,
  def: PoisonDefinition,
  scope: string,
): { events: DraftEvent[]; success: boolean; damageMultiplier: number } {
  const entity = ctx.world.entities[target];
  if (!entity || !def.save) {
    return { events: [], success: true, damageMultiplier: 1 };
  }

  const saveRoll = ctx.roll("1d20", scope, "normal");
  const natural = saveRoll.total;
  const total = natural + abilityModifier(entity.abilityScores[def.save.ability]);
  const success = total >= def.save.dc;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...poisonMeta(ctx, target),
      payload: {
        notation: saveRoll.notation,
        rolls: saveRoll.rolls,
        total: saveRoll.total,
        scope: saveRoll.scope,
        drawIndex: saveRoll.drawIndex,
        mode: "normal",
      },
    },
    {
      type: "SaveRolled",
      ...poisonMeta(ctx, target),
      payload: {
        entity: target,
        ability: def.save.ability,
        dc: def.save.dc,
        mode: "normal",
        natural,
        total,
        success,
        autoFail: false,
      },
    },
  ];

  let damageMultiplier = 1;
  if (success) {
    if (def.save.onSuccess === "negates") {
      return { events, success, damageMultiplier: 0 };
    }
    if (def.save.onSuccess === "half") {
      damageMultiplier = 0.5;
    }
  }

  return { events, success, damageMultiplier };
}

/** Core poison resolution — save, damage, conditions, active instance. */
export function buildApplyPoisonEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  poisonSlug: string,
  opts?: { source?: EntityRef; saveScope?: string },
): DraftEvent[] {
  const def = getPoisonDefinition(poisonSlug);
  if (!def) return [];

  const events: DraftEvent[] = [];
  let saveSuccess: boolean | undefined;
  let damageMultiplier = 1;

  if (def.save) {
    const save = rollPoisonSave(
      ctx,
      target,
      def,
      opts?.saveScope ?? `poison-save:${target}:${poisonSlug}`,
    );
    events.push(...save.events);
    saveSuccess = save.success;
    damageMultiplier = save.damageMultiplier;
    if (damageMultiplier === 0) {
      return events;
    }
  }

  events.push(...applyPoisonDamageAndConditions(ctx, def, target, damageMultiplier));

  if (shouldTrackActivePoison(def, saveSuccess)) {
    const existing = ctx.world.entities[target]?.activePoisons?.length ?? 0;
    const instanceId = makeInstanceId(target, poisonSlug, existing);
    events.push({
      type: "PoisonApplied",
      ...poisonMeta(ctx, "system"),
      payload: {
        target,
        instanceId,
        poisonSlug,
        pendingRepeat: poisonNeedsRepeatTick(def),
        ...(opts?.source ? { source: opts.source } : {}),
      },
    });
  }

  if (opts?.source) {
    const source = ctx.world.entities[opts.source];
    if (source?.coatedPoisonSlug === poisonSlug) {
      events.push({
        type: "PoisonCoatingCleared",
        ...poisonMeta(ctx, opts.source),
        payload: { entity: opts.source },
      });
    }
  }

  return events;
}

export function handleCoatWeapon(
  cmd: CoatWeaponCommand,
  ctx: ExecutionContext,
): CommandResult {
  const actor = ctx.world.entities[cmd.entity];
  if (!actor) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const def = getPoisonDefinition(cmd.poisonSlug);
  if (!def) {
    return reject("POISON_NOT_FOUND", `Unknown poison slug ${cmd.poisonSlug}.`);
  }
  if (def.poisonType !== "injury") {
    return reject(
      "POISON_WRONG_TYPE",
      `${def.name} is ${def.poisonType}; only injury poisons can coat a weapon.`,
    );
  }

  const encounter = ctx.world.encounter;
  const inCombat = Boolean(encounter?.initiativeRolled);
  const events: DraftEvent[] = [];

  if (inCombat) {
    const active = encounter!.order[encounter!.activeIndex]?.entity;
    if (active !== cmd.entity) {
      return reject("ACTION_UNAVAILABLE", "Coat weapon is only available on your turn.");
    }
    const econ = actor.actionEconomy;
    if (!econ || econ.action !== "available") {
      return reject(
        "ACTION_UNAVAILABLE",
        `${actor.name} has already used its action this turn.`,
      );
    }
    events.push({
      type: "ActionSpent",
      ...poisonMeta(ctx, cmd.entity),
      payload: { entity: cmd.entity, action: true },
    });
  }

  events.push({
    type: "WeaponCoated",
    ...poisonMeta(ctx, cmd.entity),
    payload: { entity: cmd.entity, poisonSlug: cmd.poisonSlug },
  });

  return {
    accepted: true,
    events,
    summary: { entity: cmd.entity, poisonSlug: cmd.poisonSlug },
  };
}

export function handleApplyPoison(
  cmd: ApplyPoisonCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const def = getPoisonDefinition(cmd.poisonSlug);
  if (!def) {
    return reject("POISON_NOT_FOUND", `Unknown poison slug ${cmd.poisonSlug}.`);
  }
  if (def.poisonType === "contact" || def.poisonType === "inhaled") {
    return reject(
      "POISON_DELIVERY_NOT_SUPPORTED",
      `${def.name} (${def.poisonType}) delivery is deferred to GRILL-EXPLORATION.`,
    );
  }

  const events = buildApplyPoisonEvents(ctx, cmd.target, cmd.poisonSlug, {
    source: cmd.source,
  });

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, poisonSlug: cmd.poisonSlug },
  };
}

function resolvePaleTinctureTick(
  ctx: ExecutionContext,
  cmd: ResolvePoisonTickCommand,
  instance: ActivePoisonInstance,
  def: PoisonDefinition,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity || !def.save) {
    return reject("POISON_NOT_ACTIVE", "Poison instance is no longer active.");
  }

  const events: DraftEvent[] = [];
  const save = rollPoisonSave(
    ctx,
    cmd.entity,
    def,
    `poison-tick-save:${cmd.entity}:${instance.instanceId}`,
  );
  events.push(...save.events);

  if (save.success) {
    events.push({
      type: "PoisonRemoved",
      ...poisonMeta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        instanceId: instance.instanceId,
        poisonSlug: instance.poisonSlug,
        reason: "saved",
      },
    });
    events.push({
      type: "PoisonTickResolved",
      ...poisonMeta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        instanceId: instance.instanceId,
        poisonSlug: instance.poisonSlug,
        success: true,
      },
    });
    return {
      accepted: true,
      events,
      summary: { instanceId: instance.instanceId, removed: true },
    };
  }

  const hpRoll = ctx.roll("1d6", `poison-max-hp:${cmd.entity}`, "normal");
  events.push({
    type: "DiceRolled",
    ...poisonMeta(ctx, "system"),
    payload: {
      notation: hpRoll.notation,
      rolls: hpRoll.rolls,
      total: hpRoll.total,
      scope: hpRoll.scope,
      drawIndex: hpRoll.drawIndex,
      mode: "normal",
    },
  });
  const amount = hpRoll.total;
  const hpMaxBefore = entity.hp.max;
  const hpMaxAfter = Math.max(1, hpMaxBefore - amount);
  events.push({
    type: "MaxHpReduced",
    ...poisonMeta(ctx, "system"),
    payload: {
      target: cmd.entity,
      amount,
      hpMaxBefore,
      hpMaxAfter,
    },
  });
  events.push({
    type: "PoisonTickResolved",
    ...poisonMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: instance.instanceId,
      poisonSlug: instance.poisonSlug,
      success: false,
      maxHpReduced: amount,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: instance.instanceId, maxHpReduced: amount },
  };
}

function resolveBurntOthurTick(
  ctx: ExecutionContext,
  cmd: ResolvePoisonTickCommand,
  instance: ActivePoisonInstance,
  def: PoisonDefinition,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity || !def.save) {
    return reject("POISON_NOT_ACTIVE", "Poison instance is no longer active.");
  }

  const events: DraftEvent[] = [];
  const save = rollPoisonSave(
    ctx,
    cmd.entity,
    def,
    `poison-tick-save:${cmd.entity}:${instance.instanceId}`,
  );
  events.push(...save.events);

  const threshold = poisonRepeatSuccessThreshold(def) ?? 3;

  if (save.success) {
    const successes = (instance.repeatSuccesses ?? 0) + 1;
    if (successes >= threshold) {
      events.push({
        type: "PoisonRemoved",
        ...poisonMeta(ctx, cmd.entity),
        payload: {
          target: cmd.entity,
          instanceId: instance.instanceId,
          poisonSlug: instance.poisonSlug,
          reason: "saved",
        },
      });
    } else {
      events.push({
        type: "PoisonRepeatProgressed",
        ...poisonMeta(ctx, cmd.entity),
        payload: {
          target: cmd.entity,
          instanceId: instance.instanceId,
          poisonSlug: instance.poisonSlug,
          repeatSuccesses: successes,
        },
      });
    }
    events.push({
      type: "PoisonTickResolved",
      ...poisonMeta(ctx, cmd.entity),
      payload: {
        target: cmd.entity,
        instanceId: instance.instanceId,
        poisonSlug: instance.poisonSlug,
        success: true,
      },
    });
    return {
      accepted: true,
      events,
      summary: { instanceId: instance.instanceId, repeatSuccesses: successes },
    };
  }

  const dmgRoll = ctx.roll("1d6", `poison-tick-dmg:${cmd.entity}`, "normal");
  events.push({
    type: "DiceRolled",
    ...poisonMeta(ctx, "system"),
    payload: {
      notation: dmgRoll.notation,
      rolls: dmgRoll.rolls,
      total: dmgRoll.total,
      scope: dmgRoll.scope,
      drawIndex: dmgRoll.drawIndex,
      mode: "normal",
    },
  });
  const amount = dmgRoll.total;
  const hpAfter = Math.max(0, entity.hp.current - amount);
  events.push({
    type: "DamageDealt",
    ...poisonMeta(ctx, "system"),
    payload: {
      target: cmd.entity,
      amount,
      damageType: "poison",
      hpBefore: entity.hp.current,
      hpAfter,
    },
  });
  events.push({
    type: "PoisonTickResolved",
    ...poisonMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: instance.instanceId,
      poisonSlug: instance.poisonSlug,
      success: false,
      damage: amount,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: instance.instanceId, damage: amount },
  };
}

export function handleResolvePoisonTick(
  cmd: ResolvePoisonTickCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const instance = entity.activePoisons?.find((p) => p.instanceId === cmd.instanceId);
  if (!instance?.pendingRepeat) {
    return reject(
      "POISON_NOT_ACTIVE",
      `No repeating poison instance ${cmd.instanceId} on ${cmd.entity}.`,
    );
  }
  const def = getPoisonDefinition(instance.poisonSlug);
  if (!def) {
    return reject("POISON_NOT_FOUND", `Unknown poison slug ${instance.poisonSlug}.`);
  }

  if (instance.poisonSlug === "srd-2024_pale-tincture") {
    return resolvePaleTinctureTick(ctx, cmd, instance, def);
  }
  if (instance.poisonSlug === "srd-2024_burnt-othur-fumes") {
    return resolveBurntOthurTick(ctx, cmd, instance, def);
  }

  return reject(
    "POISON_NOT_ACTIVE",
    `Repeat tick for ${instance.poisonSlug} is not implemented in v1.`,
  );
}

/** After a qualifying weapon hit, deliver coated injury poison (GRILL-LIVE-POISON Q4). */
export function poisonDeliveryEventsAfterHit(
  ctx: ExecutionContext,
  attacker: EntityRef,
  target: EntityRef,
  damageType: string,
): DraftEvent[] {
  const attackerState = ctx.world.entities[attacker];
  if (!attackerState?.coatedPoisonSlug) return [];
  if (!INJURY_DAMAGE_TYPES.has(damageType.toLowerCase())) return [];

  return buildApplyPoisonEvents(ctx, target, attackerState.coatedPoisonSlug, {
    source: attacker,
    saveScope: `poison-injury:${attacker}->${target}:${attackerState.coatedPoisonSlug}`,
  });
}

/** At turn start, auto-resolve repeat saves for the active combatant (Q4). */
export function poisonTickEventsAfterTurnStart(
  ctx: ExecutionContext,
  entity: EntityRef,
): DraftEvent[] {
  const actor = ctx.world.entities[entity];
  if (!actor?.activePoisons?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of actor.activePoisons) {
    if (!instance.pendingRepeat) continue;
    const result = handleResolvePoisonTick(
      {
        type: "resolve_poison_tick",
        entity,
        instanceId: instance.instanceId,
      },
      ctx,
    );
    if (result.accepted) {
      events.push(...result.events);
    }
  }
  return events;
}
