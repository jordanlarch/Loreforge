/**
 * Gameplay Toolbox environmental effect commands (GRILL-LIVE-ENV-EFFECT).
 * apply_environmental_effect / resolve_environmental_effect_tick / remove_environmental_effect
 */
import { CONDITIONS, type Condition } from "../combat/conditions";
import { abilityModifier } from "../entities/abilities";
import type { EnvironmentalEffectDefinition } from "../content/toolbox-definitions";
import { getEnvironmentalEffectDefinition } from "../content/srd-environmental-effect-seeds";
import type {
  ActiveEnvironmentalEffectInstance,
  EntityRef,
  SceneId,
} from "../entities/types";
import type { DraftEvent } from "../events/types";
import type { ExecutionContext } from "./context";
import {
  reject,
  type ApplyEnvironmentalEffectCommand,
  type CommandResult,
  type RemoveEnvironmentalEffectCommand,
  type ResolveEnvironmentalEffectTickCommand,
  type SetSceneEnvironmentalEffectsCommand,
} from "./types";

type EnvHandlerMeta = Omit<DraftEvent, "type" | "payload" | "sequence">;

function envMeta(ctx: ExecutionContext, actor?: string): EnvHandlerMeta {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor ?? "system",
  };
}

function makeInstanceId(target: EntityRef, slug: string, index: number): string {
  return `env:${target}:${slug}:${index}`;
}

const VALID_CONDITIONS = new Set<string>(CONDITIONS);

/** Turn-start repeat saves (Slippery Ice v1). Hourly/travel deferred (Q4). */
export function environmentalEffectNeedsRepeatTick(
  def: EnvironmentalEffectDefinition,
): boolean {
  if (!def.repeat) return false;
  const r = def.repeat.toLowerCase();
  if (
    r.includes("each hour") ||
    r.includes("end of each hour") ||
    r.includes("travel pace") ||
    r.includes("each additional minute")
  ) {
    return false;
  }
  return (
    r.includes("starting a turn") ||
    r.includes("start of each") ||
    r.includes("each turn") ||
    r.includes("first time on a turn")
  );
}

function shouldTrackActiveEnvironmentalEffect(
  def: EnvironmentalEffectDefinition,
  saveSuccess: boolean | undefined,
): boolean {
  if (saveSuccess && def.save?.onSuccess === "negates") return false;
  if (def.conditions?.some((c) => VALID_CONDITIONS.has(c))) return true;
  if (environmentalEffectNeedsRepeatTick(def)) return true;
  if (def.repeat?.trim() || def.damage?.length) return true;
  return false;
}

function filterEngineConditions(def: EnvironmentalEffectDefinition): Condition[] {
  if (!def.conditions?.length) return [];
  return def.conditions.filter((c): c is Condition => VALID_CONDITIONS.has(c));
}

function applyEnvironmentalConditions(
  ctx: ExecutionContext,
  def: EnvironmentalEffectDefinition,
  target: EntityRef,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  for (const condition of filterEngineConditions(def)) {
    events.push({
      type: "ConditionApplied",
      ...envMeta(ctx, "system"),
      payload: { target, condition },
    });
  }
  return events;
}

function applyEnvironmentalDamage(
  ctx: ExecutionContext,
  def: EnvironmentalEffectDefinition,
  target: EntityRef,
  scope: string,
): DraftEvent[] {
  const entity = ctx.world.entities[target];
  if (!entity?.hp || !def.damage?.length) return [];

  const events: DraftEvent[] = [];
  for (const chunk of def.damage) {
    const dmgRoll = ctx.roll(chunk.dice, `${scope}:${chunk.type}`, "normal");
    events.push({
      type: "DiceRolled",
      ...envMeta(ctx, "system"),
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
    if (amount > 0) {
      const fromTemp = Math.min(entity.hp.temp, amount);
      const toCurrent = amount - fromTemp;
      const hpAfter = Math.max(0, entity.hp.current - toCurrent);
      events.push({
        type: "DamageDealt",
        ...envMeta(ctx, "system"),
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
  return events;
}

function rollEnvironmentalSave(
  ctx: ExecutionContext,
  target: EntityRef,
  def: EnvironmentalEffectDefinition,
  scope: string,
): { events: DraftEvent[]; success: boolean } {
  const entity = ctx.world.entities[target];
  if (!entity || !def.save) {
    return { events: [], success: true };
  }

  const saveRoll = ctx.roll("1d20", scope, "normal");
  const natural = saveRoll.total;
  const total = natural + abilityModifier(entity.abilityScores[def.save.ability]);
  const success = total >= def.save.dc;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...envMeta(ctx, target),
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
      ...envMeta(ctx, target),
      payload: {
        entity: target,
        ability: def.save.ability,
        dc: def.save.dc,
        mode: "normal",
        natural,
        total,
        success,
      },
    },
  ];

  return { events, success };
}

/** Core environmental effect resolution — save, conditions, active instance. */
export function buildApplyEnvironmentalEffectEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  effectSlug: string,
  opts?: { saveScope?: string; skipSave?: boolean },
): DraftEvent[] {
  const def = getEnvironmentalEffectDefinition(effectSlug);
  if (!def) return [];

  const events: DraftEvent[] = [];
  let saveSuccess: boolean | undefined;

  if (def.save && !opts?.skipSave) {
    const save = rollEnvironmentalSave(
      ctx,
      target,
      def,
      opts?.saveScope ?? `env-save:${target}:${effectSlug}`,
    );
    events.push(...save.events);
    saveSuccess = save.success;
    if (save.success && def.save.onSuccess === "negates") {
      return events;
    }
  }

  events.push(...applyEnvironmentalConditions(ctx, def, target));
  events.push(
    ...applyEnvironmentalDamage(
      ctx,
      def,
      target,
      `env-dmg:${target}:${effectSlug}`,
    ),
  );

  if (shouldTrackActiveEnvironmentalEffect(def, saveSuccess)) {
    const existing = ctx.world.entities[target]?.activeEnvironmentalEffects?.length ?? 0;
    const instanceId = makeInstanceId(target, effectSlug, existing);
    events.push({
      type: "EnvironmentalEffectApplied",
      ...envMeta(ctx, "system"),
      payload: {
        target,
        instanceId,
        effectSlug,
        pendingRepeat: environmentalEffectNeedsRepeatTick(def),
      },
    });
  }

  return events;
}

export function buildRemoveEnvironmentalEffectEvents(
  ctx: ExecutionContext,
  target: EntityRef,
  instanceId: string,
  reason: "saved" | "removed",
): DraftEvent[] {
  const entity = ctx.world.entities[target];
  const instance = entity?.activeEnvironmentalEffects?.find(
    (i) => i.instanceId === instanceId,
  );
  if (!instance) return [];

  const def = getEnvironmentalEffectDefinition(instance.effectSlug);
  const events: DraftEvent[] = [
    {
      type: "EnvironmentalEffectRemoved",
      ...envMeta(ctx, target),
      payload: {
        target,
        instanceId,
        effectSlug: instance.effectSlug,
        reason,
      },
    },
  ];

  if (def) {
    for (const condition of filterEngineConditions(def)) {
      events.push({
        type: "ConditionRemoved",
        ...envMeta(ctx, target),
        payload: { target, condition },
      });
    }
  }

  return events;
}

/** Remove ambient instances matching slugs when leaving a scene (Q4). */
export function buildLeaveSceneEnvironmentalEffectEvents(
  ctx: ExecutionContext,
  departingSceneId: SceneId,
): DraftEvent[] {
  const slugs = ctx.world.scenes[departingSceneId]?.environmentalEffectSlugs;
  if (!slugs?.length) return [];

  const slugSet = new Set(slugs);
  const events: DraftEvent[] = [];
  for (const entity of Object.values(ctx.world.entities)) {
    if (!entity.activeEnvironmentalEffects?.length) continue;
    for (const instance of entity.activeEnvironmentalEffects) {
      if (!slugSet.has(instance.effectSlug)) continue;
      events.push(
        ...buildRemoveEnvironmentalEffectEvents(
          ctx,
          entity.id,
          instance.instanceId,
          "removed",
        ),
      );
    }
  }
  return events;
}

export function handleSetSceneEnvironmentalEffects(
  cmd: SetSceneEnvironmentalEffectsCommand,
  ctx: ExecutionContext,
): CommandResult {
  const scene = ctx.world.scenes[cmd.sceneId];
  if (!scene) {
    return reject("SCENE_NOT_FOUND", `Scene ${cmd.sceneId} does not exist.`);
  }
  for (const slug of cmd.slugs) {
    if (!getEnvironmentalEffectDefinition(slug)) {
      return reject(
        "ENVIRONMENTAL_EFFECT_NOT_FOUND",
        `Unknown environmental effect slug ${slug}.`,
      );
    }
  }

  return {
    accepted: true,
    events: [
      {
        type: "SceneEnvironmentalEffectsSet",
        ...envMeta(ctx, "system"),
        payload: { sceneId: cmd.sceneId, slugs: cmd.slugs },
      },
    ],
    summary: { sceneId: cmd.sceneId, slugs: cmd.slugs },
  };
}

export function handleApplyEnvironmentalEffect(
  cmd: ApplyEnvironmentalEffectCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const def = getEnvironmentalEffectDefinition(cmd.effectSlug);
  if (!def) {
    return reject(
      "ENVIRONMENTAL_EFFECT_NOT_FOUND",
      `Unknown environmental effect slug ${cmd.effectSlug}.`,
    );
  }
  if (
    target.activeEnvironmentalEffects?.some((i) => i.effectSlug === cmd.effectSlug)
  ) {
    return reject(
      "ENVIRONMENTAL_EFFECT_ALREADY_ACTIVE",
      `${target.name} is already affected by ${def.name}.`,
    );
  }

  const events = buildApplyEnvironmentalEffectEvents(ctx, cmd.target, cmd.effectSlug);

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, effectSlug: cmd.effectSlug },
  };
}

export function handleRemoveEnvironmentalEffect(
  cmd: RemoveEnvironmentalEffectCommand,
  ctx: ExecutionContext,
): CommandResult {
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Entity ${cmd.target} does not exist.`);
  }
  const instance = target.activeEnvironmentalEffects?.find(
    (i) => i.instanceId === cmd.instanceId,
  );
  if (!instance) {
    return reject(
      "ENVIRONMENTAL_EFFECT_NOT_ACTIVE",
      `No environmental effect instance ${cmd.instanceId} on ${cmd.target}.`,
    );
  }

  const events = buildRemoveEnvironmentalEffectEvents(
    ctx,
    cmd.target,
    cmd.instanceId,
    "removed",
  );

  return {
    accepted: true,
    events,
    summary: { target: cmd.target, instanceId: cmd.instanceId },
  };
}

function resolveGenericEnvironmentalEffectTick(
  ctx: ExecutionContext,
  cmd: ResolveEnvironmentalEffectTickCommand,
  instance: ActiveEnvironmentalEffectInstance,
  def: EnvironmentalEffectDefinition,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }

  const events: DraftEvent[] = [];
  let success = true;

  if (def.save) {
    const save = rollEnvironmentalSave(
      ctx,
      cmd.entity,
      def,
      `env-tick-save:${cmd.entity}:${instance.instanceId}`,
    );
    events.push(...save.events);
    success = save.success;
    if (!save.success) {
      events.push(...applyEnvironmentalConditions(ctx, def, cmd.entity));
      events.push(
        ...applyEnvironmentalDamage(
          ctx,
          def,
          cmd.entity,
          `env-tick-dmg:${cmd.entity}:${instance.instanceId}`,
        ),
      );
    } else if (def.save.onSuccess === "negates") {
      events.push(
        ...buildRemoveEnvironmentalEffectEvents(
          ctx,
          cmd.entity,
          instance.instanceId,
          "saved",
        ),
      );
    }
  }

  events.push({
    type: "EnvironmentalEffectTickResolved",
    ...envMeta(ctx, cmd.entity),
    payload: {
      target: cmd.entity,
      instanceId: instance.instanceId,
      effectSlug: instance.effectSlug,
      success,
    },
  });

  return {
    accepted: true,
    events,
    summary: { instanceId: instance.instanceId, success },
  };
}

export function handleResolveEnvironmentalEffectTick(
  cmd: ResolveEnvironmentalEffectTickCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} does not exist.`);
  }
  const instance = entity.activeEnvironmentalEffects?.find(
    (i) => i.instanceId === cmd.instanceId,
  );
  if (!instance?.pendingRepeat) {
    return reject(
      "ENVIRONMENTAL_EFFECT_NOT_ACTIVE",
      `No repeat-tracked environmental effect instance ${cmd.instanceId} on ${cmd.entity}.`,
    );
  }
  const def = getEnvironmentalEffectDefinition(instance.effectSlug);
  if (!def) {
    return reject(
      "ENVIRONMENTAL_EFFECT_NOT_FOUND",
      `Unknown environmental effect slug ${instance.effectSlug}.`,
    );
  }

  return resolveGenericEnvironmentalEffectTick(ctx, cmd, instance, def);
}

/** At turn start, auto-resolve repeat saves for the active combatant (Q4). */
export function environmentalEffectTickEventsAfterTurnStart(
  ctx: ExecutionContext,
  entity: EntityRef,
): DraftEvent[] {
  const actor = ctx.world.entities[entity];
  if (!actor?.activeEnvironmentalEffects?.length) return [];

  const events: DraftEvent[] = [];
  for (const instance of actor.activeEnvironmentalEffects) {
    if (!instance.pendingRepeat) continue;
    const result = handleResolveEnvironmentalEffectTick(
      {
        type: "resolve_environmental_effect_tick",
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
