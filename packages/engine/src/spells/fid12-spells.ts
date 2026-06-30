/**
 * SRD-FID-12 depth — Spiritual Weapon, Wall of Fire zone, Polymorph stat-swap.
 */
import { abilityModifier } from "../entities/abilities";
import type {
  AbilityScores,
  EntityRef,
  EntityState,
  GridPosition,
  SceneId,
} from "../entities/types";
import { monsterTemplate } from "../content/monsters";
import { spellAttackBonus, spellSaveDC } from "../content/spellcasting";
import { withinBurst, distanceFeet } from "../combat/grid";
import { areHostile } from "../combat/reactions";
import { effectiveAc } from "../combat/effects";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "../commands/context";
import type { CommandResult } from "../commands/types";
import { reject } from "../commands/types";
import type { StrikeSpiritualWeaponCommand } from "../commands/types";

const SPIRITUAL_WEAPON_ROUNDS = 10;

function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function enumerateBurstCells(
  center: GridPosition,
  radiusFeet: number,
  map?: { width: number; height: number },
): GridPosition[] {
  const width = map?.width ?? 60;
  const height = map?.height ?? 60;
  const cells: GridPosition[] = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const cell = { x, y };
      if (withinBurst(center, cell, radiusFeet)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

export function entityInZoneCells(
  entity: EntityState,
  cells: readonly GridPosition[],
): boolean {
  if (!entity.position) return false;
  return cells.some((c) => sameCell(c, entity.position!));
}

function meta(
  ctx: ExecutionContext,
  actor?: string,
): Omit<EventMeta, "sequence"> {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor,
  };
}

export function spiritualWeaponSummonedEvent(
  ctx: ExecutionContext,
  casterId: EntityRef,
  slotLevel: number,
  instanceId: string,
): DraftEvent {
  return {
    type: "SpiritualWeaponSummoned",
    ...meta(ctx, casterId),
    payload: {
      caster: casterId,
      slotLevel,
      instanceId,
      roundsRemaining: SPIRITUAL_WEAPON_ROUNDS,
    },
  };
}

export function handleStrikeSpiritualWeapon(
  cmd: StrikeSpiritualWeaponCommand,
  ctx: ExecutionContext,
): CommandResult {
  const caster = ctx.world.entities[cmd.caster];
  if (!caster) {
    return reject("ACTOR_NOT_FOUND", `Caster ${cmd.caster} does not exist.`);
  }
  const weapon = caster.activeSpiritualWeapon;
  if (!weapon) {
    return reject(
      "ACTION_UNAVAILABLE",
      "No spiritual weapon is active for this caster.",
    );
  }
  if (
    caster.actionEconomy &&
    caster.actionEconomy.bonusAction !== "available"
  ) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${caster.name} has already used their bonus action.`,
    );
  }
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (!target.alive) {
    return reject("INVALID_TARGET", `${target.name} is not a valid target.`);
  }
  if (
    caster.position &&
    target.position &&
    caster.sceneId === target.sceneId &&
    distanceFeet(caster.position, target.position) > 60
  ) {
    return reject("OUT_OF_RANGE", "Target is out of range for Spiritual Weapon.");
  }

  const bonus = spellAttackBonus(caster);
  if (bonus === undefined) {
    return reject("INVALID_PAYLOAD", "Caster cannot make spell attacks.");
  }
  const d20 = ctx.roll("1d20", `spiritual-weapon:${caster.id}->${target.id}`);
  const natural = d20.total;
  const total = natural + bonus;
  const targetAc = effectiveAc(target);
  const hit = total >= targetAc;
  const critical = hit && natural === 20;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...meta(ctx, caster.id),
      payload: {
        notation: d20.notation,
        rolls: d20.rolls,
        total: d20.total,
        scope: d20.scope,
        drawIndex: d20.drawIndex,
      },
    },
    {
      type: "AttackResolved",
      ...meta(ctx, caster.id),
      payload: {
        attacker: caster.id,
        target: target.id,
        attackRoll: { natural, total, mode: "normal" },
        targetAc,
        hit,
        critical,
        damageType: "force",
      },
    },
    {
      type: "ActionSpent",
      ...meta(ctx, caster.id),
      payload: { entity: caster.id, bonusAction: true },
    },
  ];
  let damage = 0;
  if (hit) {
    const extraLevels = Math.max(0, weapon.slotLevel - 2);
    const ability = caster.spellcasting?.ability ?? "int";
    const mod = abilityModifier(caster.abilityScores[ability]);
    const diceCount = 1 + extraLevels;
    const roll = ctx.roll(`${diceCount}d8+${mod}`, `spiritual-weapon-dmg:${caster.id}`);
    events.push({
      type: "DiceRolled",
      ...meta(ctx, caster.id),
      payload: {
        notation: roll.notation,
        rolls: roll.rolls,
        total: roll.total,
        scope: roll.scope,
        drawIndex: roll.drawIndex,
      },
    });
    damage = Math.max(0, roll.total);
    events[1] = {
      type: "AttackResolved",
      ...meta(ctx, caster.id),
      payload: {
        attacker: caster.id,
        target: target.id,
        attackRoll: { natural, total, mode: "normal" },
        targetAc,
        hit,
        critical,
        damageType: "force",
        damage,
      },
    };
    const hpAfter = Math.max(0, target.hp.current - damage);
    events.push({
      type: "DamageDealt",
      ...meta(ctx, caster.id),
      payload: {
        target: target.id,
        amount: damage,
        damageType: "force",
        hpBefore: target.hp.current,
        hpAfter,
        source: caster.id,
      },
    });
  }
  return {
    accepted: true,
    events,
    summary: { caster: caster.id, target: target.id, hit, damage },
  };
}

export function wallOfFireZoneCreatedEvent(
  ctx: ExecutionContext,
  casterId: EntityRef,
  sceneId: SceneId,
  origin: GridPosition,
  slotLevel: number,
  instanceId: string,
  cells: GridPosition[],
): DraftEvent {
  return {
    type: "SpellZoneCreated",
    ...meta(ctx, casterId),
    payload: {
      sceneId,
      instanceId,
      spellId: "wall-of-fire",
      caster: casterId,
      slotLevel,
      origin,
      cells,
    },
  };
}

export function spellZoneTurnStartEvents(
  ctx: ExecutionContext,
  entityId: EntityRef,
): DraftEvent[] {
  const entity = ctx.world.entities[entityId];
  if (!entity?.position || !entity.sceneId || !entity.alive) return [];
  const scene = ctx.world.scenes[entity.sceneId];
  const zones = scene?.spellZones;
  if (!zones?.length) return [];

  const events: DraftEvent[] = [];
  for (const zone of zones) {
    if (zone.spellId !== "wall-of-fire") continue;
    if (!entityInZoneCells(entity, zone.cells)) continue;
    const dc = spellSaveDC(ctx.world.entities[zone.caster] ?? entity)!;
    const d20 = ctx.roll("1d20", `wall-of-fire:${entityId}:${zone.instanceId}`);
    const mod = abilityModifier(entity.abilityScores.dex);
    const total = d20.total + mod;
    const success = total >= dc;
    events.push({
      type: "DiceRolled",
      ...meta(ctx, entityId),
      payload: {
        notation: d20.notation,
        rolls: d20.rolls,
        total: d20.total,
        scope: d20.scope,
        drawIndex: d20.drawIndex,
      },
    });
    events.push({
      type: "SaveRolled",
      ...meta(ctx, entityId),
      payload: {
        entity: entityId,
        ability: "dex",
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    });
    const roll = ctx.roll("5d8", `wall-of-fire-dmg:${entityId}:${zone.instanceId}`);
    events.push({
      type: "DiceRolled",
      ...meta(ctx, entityId),
      payload: {
        notation: roll.notation,
        rolls: roll.rolls,
        total: roll.total,
        scope: roll.scope,
        drawIndex: roll.drawIndex,
      },
    });
    const amount = success ? Math.floor(roll.total / 2) : roll.total;
    if (amount > 0) {
      events.push({
        type: "DamageDealt",
        ...meta(ctx, zone.caster),
        payload: {
          target: entityId,
          amount,
          damageType: "fire",
          hpBefore: entity.hp.current,
          hpAfter: Math.max(0, entity.hp.current - amount),
          source: zone.caster,
        },
      });
    }
  }
  return events;
}

export function spiritualWeaponRoundTickEvents(
  ctx: ExecutionContext,
): DraftEvent[] {
  const events: DraftEvent[] = [];
  for (const [id, entity] of Object.entries(ctx.world.entities)) {
    const weapon = entity.activeSpiritualWeapon;
    if (!weapon) continue;
    const remaining = weapon.roundsRemaining - 1;
    if (remaining <= 0) {
      events.push({
        type: "SpiritualWeaponDismissed",
        ...meta(ctx, id),
        payload: { caster: id, instanceId: weapon.instanceId },
      });
    } else {
      events.push({
        type: "SpiritualWeaponTicked",
        ...meta(ctx, id),
        payload: {
          caster: id,
          instanceId: weapon.instanceId,
          roundsRemaining: remaining,
        },
      });
    }
  }
  return events;
}

export type PolymorphBeastForm = {
  slug: string;
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed: number;
};

export function defaultPolymorphBeast(): PolymorphBeastForm {
  const wolf = monsterTemplate("wolf")!;
  return {
    slug: "wolf",
    name: wolf.name,
    abilityScores: { ...wolf.abilityScores },
    maxHp: wolf.maxHp,
    baseAc: wolf.baseAc,
    speed: wolf.speed,
  };
}

export function polymorphAppliedEvent(
  ctx: ExecutionContext,
  casterId: EntityRef,
  targetId: EntityRef,
  beast: PolymorphBeastForm,
  stored: {
    abilityScores: AbilityScores;
    maxHp: number;
    baseAc: number;
    speed: number;
    hpCurrent: number;
  },
): DraftEvent {
  return {
    type: "PolymorphApplied",
    ...meta(ctx, casterId),
    payload: {
      target: targetId,
      caster: casterId,
      beastSlug: beast.slug,
      beastName: beast.name,
      beastAbilityScores: beast.abilityScores,
      beastMaxHp: beast.maxHp,
      beastAc: beast.baseAc,
      beastSpeed: beast.speed,
      storedAbilityScores: stored.abilityScores,
      storedMaxHp: stored.maxHp,
      storedBaseAc: stored.baseAc,
      storedSpeed: stored.speed,
      storedHpCurrent: stored.hpCurrent,
    },
  };
}

export function polymorphEndedEvent(
  ctx: ExecutionContext,
  targetId: EntityRef,
  reason: "concentration" | "zero_hp",
): DraftEvent {
  return {
    type: "PolymorphEnded",
    ...meta(ctx, targetId),
    payload: { target: targetId, reason },
  };
}

export function buildPolymorphCastEvents(
  ctx: ExecutionContext,
  caster: EntityState,
  target: EntityState,
): { events: DraftEvent[]; blocked?: string } {
  const encounter = ctx.world.encounter;
  const hostile =
    encounter &&
    areHostile(
      encounter.sides[caster.id],
      encounter.sides[target.id],
    );
  const unwilling = hostile && target.id !== caster.id;

  const events: DraftEvent[] = [];
  if (unwilling) {
    const dc = spellSaveDC(caster)!;
    const d20 = ctx.roll("1d20", `polymorph-save:${target.id}`);
    const mod = abilityModifier(target.abilityScores.wis);
    const total = d20.total + mod;
    const success = total >= dc;
    events.push({
      type: "DiceRolled",
      ...meta(ctx, caster.id),
      payload: {
        notation: d20.notation,
        rolls: d20.rolls,
        total: d20.total,
        scope: d20.scope,
        drawIndex: d20.drawIndex,
      },
    });
    events.push({
      type: "SaveRolled",
      ...meta(ctx, caster.id),
      payload: {
        entity: target.id,
        ability: "wis",
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    });
    if (success) {
      return { events, blocked: `${target.name} succeeded on the Wisdom save.` };
    }
  }

  const beast = defaultPolymorphBeast();
  events.push(
    polymorphAppliedEvent(ctx, caster.id, target.id, beast, {
      abilityScores: { ...target.abilityScores },
      maxHp: target.hp.max,
      baseAc: target.baseAc,
      speed: target.speed,
      hpCurrent: target.hp.current,
    }),
  );
  return { events };
}
