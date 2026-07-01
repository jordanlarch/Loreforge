/**
 * SRD-FID-12 depth — Spiritual Weapon, spell zones, Polymorph stat-swap,
 * Spirit Guardians aura, Call Lightning strikes.
 */
import { abilityModifier } from "../entities/abilities";
import type {
  AbilityScores,
  EntityRef,
  EntityState,
  GridPosition,
  SceneId,
  SceneSpellZone,
} from "../entities/types";
import { monsterTemplate } from "../content/monsters";
import { spellAttackBonus, spellSaveDC } from "../content/spellcasting";
import { withinBurst, distanceFeet } from "../combat/grid";
import { areHostile } from "../combat/reactions";
import { effectiveAc } from "../combat/effects";
import { mainActionAvailable, mainActionSpendPayload } from "../combat/initiative";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "../commands/context";
import type { CommandResult } from "../commands/types";
import { reject } from "../commands/types";
import type {
  StrikeCallLightningCommand,
  StrikeSpiritualWeaponCommand,
} from "../commands/types";

const SPIRITUAL_WEAPON_ROUNDS = 10;

function entitiesAreHostileInEncounter(
  encounter: NonNullable<ExecutionContext["world"]["encounter"]>,
  caster: EntityState,
  entity: EntityState,
): boolean {
  const casterSide = encounter.sides[caster.id];
  const entitySide = encounter.sides[entity.id];
  if (casterSide !== undefined && entitySide !== undefined) {
    return areHostile(casterSide, entitySide);
  }
  return caster.kind !== entity.kind;
}

type ZoneTickSpec = {
  ability: keyof AbilityScores;
  baseDice: number;
  dieSize: number;
  baseSlot: number;
  damageType: string;
  fixedDice?: string;
  /** When false, a successful save negates damage (Cloudkill). Default true = half. */
  halfOnSuccess?: boolean;
};

const ZONE_TURN_START_TICKS: Record<string, ZoneTickSpec> = {
  "wall-of-fire": {
    ability: "dex",
    baseDice: 5,
    dieSize: 8,
    baseSlot: 4,
    damageType: "fire",
    fixedDice: "5d8",
  },
  moonbeam: {
    ability: "con",
    baseDice: 2,
    dieSize: 10,
    baseSlot: 2,
    damageType: "radiant",
  },
  cloudkill: {
    ability: "con",
    baseDice: 5,
    dieSize: 8,
    baseSlot: 5,
    damageType: "poison",
    fixedDice: "5d8",
    halfOnSuccess: false,
  },
};

function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function scaledDice(
  baseCount: number,
  dieSize: number,
  slotLevel: number,
  baseSlot: number,
): string {
  const count = baseCount + Math.max(0, slotLevel - baseSlot);
  return `${count}d${dieSize}`;
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

function zoneTickDice(zone: SceneSpellZone, spec: ZoneTickSpec): string {
  if (spec.fixedDice) return spec.fixedDice;
  return scaledDice(spec.baseDice, spec.dieSize, zone.slotLevel, spec.baseSlot);
}

function rollZoneSaveDamageTick(
  ctx: ExecutionContext,
  entity: EntityState,
  zone: SceneSpellZone,
  spec: ZoneTickSpec,
): DraftEvent[] {
  const caster = ctx.world.entities[zone.caster];
  const dc = spellSaveDC(caster ?? entity);
  if (dc === undefined) return [];

  const d20 = ctx.roll(
    "1d20",
    `${zone.spellId}:${entity.id}:${zone.instanceId}`,
  );
  const mod = abilityModifier(entity.abilityScores[spec.ability]);
  const total = d20.total + mod;
  const success = total >= dc;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...meta(ctx, entity.id),
      payload: {
        notation: d20.notation,
        rolls: d20.rolls,
        total: d20.total,
        scope: d20.scope,
        drawIndex: d20.drawIndex,
      },
    },
    {
      type: "SaveRolled",
      ...meta(ctx, entity.id),
      payload: {
        entity: entity.id,
        ability: spec.ability,
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    },
  ];
  const dice = zoneTickDice(zone, spec);
  const roll = ctx.roll(dice, `${zone.spellId}-dmg:${entity.id}:${zone.instanceId}`);
  events.push({
    type: "DiceRolled",
    ...meta(ctx, entity.id),
    payload: {
      notation: roll.notation,
      rolls: roll.rolls,
      total: roll.total,
      scope: roll.scope,
      drawIndex: roll.drawIndex,
    },
  });
  const amount =
    success && spec.halfOnSuccess === false
      ? 0
      : success
        ? Math.floor(roll.total / 2)
        : roll.total;
  if (amount > 0) {
    events.push({
      type: "DamageDealt",
      ...meta(ctx, zone.caster),
      payload: {
        target: entity.id,
        amount,
        damageType: spec.damageType,
        hpBefore: entity.hp.current,
        hpAfter: Math.max(0, entity.hp.current - amount),
        source: zone.caster,
      },
    });
  }
  return events;
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

export function spiritGuardiansStartedEvent(
  ctx: ExecutionContext,
  casterId: EntityRef,
  slotLevel: number,
  instanceId: string,
): DraftEvent {
  return {
    type: "SpiritGuardiansStarted",
    ...meta(ctx, casterId),
    payload: { caster: casterId, slotLevel, instanceId },
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
    events.push({
      type: "DamageDealt",
      ...meta(ctx, caster.id),
      payload: {
        target: target.id,
        amount: damage,
        damageType: "force",
        hpBefore: target.hp.current,
        hpAfter: Math.max(0, target.hp.current - damage),
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

function findCallLightningZone(
  ctx: ExecutionContext,
  casterId: EntityRef,
): SceneSpellZone | undefined {
  for (const scene of Object.values(ctx.world.scenes)) {
    const zone = scene.spellZones?.find(
      (z) => z.spellId === "call-lightning" && z.caster === casterId,
    );
    if (zone) return zone;
  }
  return undefined;
}

export function handleStrikeCallLightning(
  cmd: StrikeCallLightningCommand,
  ctx: ExecutionContext,
): CommandResult {
  const caster = ctx.world.entities[cmd.caster];
  if (!caster) {
    return reject("ACTOR_NOT_FOUND", `Caster ${cmd.caster} does not exist.`);
  }
  const zone = findCallLightningZone(ctx, caster.id);
  if (!zone) {
    return reject(
      "ACTION_UNAVAILABLE",
      "No call lightning storm cloud is active for this caster.",
    );
  }
  if (caster.actionEconomy && !mainActionAvailable(caster.actionEconomy)) {
    return reject(
      "ACTION_UNAVAILABLE",
      `${caster.name} has already used their action.`,
    );
  }
  const target = ctx.world.entities[cmd.target];
  if (!target) {
    return reject("TARGET_NOT_FOUND", `Target ${cmd.target} does not exist.`);
  }
  if (!target.alive) {
    return reject("INVALID_TARGET", `${target.name} is not a valid target.`);
  }
  if (!entityInZoneCells(target, zone.cells)) {
    return reject(
      "OUT_OF_RANGE",
      "Target must be under the call lightning storm cloud.",
    );
  }

  const dc = spellSaveDC(caster)!;
  const d20 = ctx.roll("1d20", `call-lightning:${caster.id}->${target.id}`);
  const mod = abilityModifier(target.abilityScores.dex);
  const total = d20.total + mod;
  const success = total >= dc;
  const dice = scaledDice(3, 10, zone.slotLevel, 3);
  const dmgRoll = ctx.roll(dice, `call-lightning-dmg:${caster.id}->${target.id}`);
  const amount = success ? Math.floor(dmgRoll.total / 2) : dmgRoll.total;

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
      type: "SaveRolled",
      ...meta(ctx, caster.id),
      payload: {
        entity: target.id,
        ability: "dex",
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    },
    {
      type: "DiceRolled",
      ...meta(ctx, caster.id),
      payload: {
        notation: dmgRoll.notation,
        rolls: dmgRoll.rolls,
        total: dmgRoll.total,
        scope: dmgRoll.scope,
        drawIndex: dmgRoll.drawIndex,
      },
    },
    {
      type: "ActionSpent",
      ...meta(ctx, caster.id),
      payload: {
        entity: caster.id,
        ...mainActionSpendPayload(caster.actionEconomy!),
      },
    },
  ];
  if (amount > 0) {
    events.push({
      type: "DamageDealt",
      ...meta(ctx, caster.id),
      payload: {
        target: target.id,
        amount,
        damageType: "lightning",
        hpBefore: target.hp.current,
        hpAfter: Math.max(0, target.hp.current - amount),
        source: caster.id,
      },
    });
  }
  return {
    accepted: true,
    events,
    summary: { caster: caster.id, target: target.id, success, damage: amount },
  };
}

export function spellZoneCreatedEvent(
  ctx: ExecutionContext,
  spellId: string,
  casterId: EntityRef,
  sceneId: SceneId,
  origin: GridPosition,
  slotLevel: number,
  instanceId: string,
  radiusFeet: number,
): DraftEvent {
  const map = ctx.world.scenes[sceneId]?.map;
  return {
    type: "SpellZoneCreated",
    ...meta(ctx, casterId),
    payload: {
      sceneId,
      instanceId,
      spellId,
      caster: casterId,
      slotLevel,
      origin,
      cells: enumerateBurstCells(origin, radiusFeet, map),
    },
  };
}

/** @deprecated Use spellZoneCreatedEvent */
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
    const spec = ZONE_TURN_START_TICKS[zone.spellId];
    if (!spec) continue;
    if (!entityInZoneCells(entity, zone.cells)) continue;
    events.push(...rollZoneSaveDamageTick(ctx, entity, zone, spec));
  }
  events.push(...stinkingCloudTurnStartEvents(ctx, entityId));
  return events;
}

/** Stinking Cloud — Con save at turn start in the zone or spend the action retching. */
export function stinkingCloudTurnStartEvents(
  ctx: ExecutionContext,
  entityId: EntityRef,
): DraftEvent[] {
  const entity = ctx.world.entities[entityId];
  if (!entity?.position || !entity.sceneId || !entity.alive) return [];
  const scene = ctx.world.scenes[entity.sceneId];
  const zones = scene?.spellZones?.filter((z) => z.spellId === "stinking-cloud");
  if (!zones?.length) return [];

  const inCloud = zones.some((z) => entityInZoneCells(entity, z.cells));
  if (!inCloud) return [];

  const caster = ctx.world.entities[zones[0]!.caster];
  const dc = spellSaveDC(caster ?? entity);
  if (dc === undefined) return [];

  const d20 = ctx.roll("1d20", `stinking-cloud:${entityId}`);
  const mod = abilityModifier(entity.abilityScores.con);
  const total = d20.total + mod;
  const success = total >= dc;
  const events: DraftEvent[] = [
    {
      type: "DiceRolled",
      ...meta(ctx, entityId),
      payload: {
        notation: d20.notation,
        rolls: d20.rolls,
        total: d20.total,
        scope: d20.scope,
        drawIndex: d20.drawIndex,
      },
    },
    {
      type: "SaveRolled",
      ...meta(ctx, entityId),
      payload: {
        entity: entityId,
        ability: "con",
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    },
  ];
  if (!success) {
    if (!entity.conditions.some((c) => c.condition === "poisoned")) {
      events.push({
        type: "ConditionApplied",
        ...meta(ctx, zones[0]!.caster),
        payload: {
          target: entityId,
          condition: "poisoned",
          source: zones[0]!.caster,
        },
      });
    }
    if (entity.actionEconomy?.action === "available") {
      events.push({
        type: "ActionSpent",
        ...meta(ctx, entityId),
        payload: { entity: entityId, action: true },
      });
    }
  }
  return events;
}

export function spiritGuardiansTurnStartEvents(
  ctx: ExecutionContext,
  entityId: EntityRef,
): DraftEvent[] {
  const entity = ctx.world.entities[entityId];
  if (!entity?.position || !entity.sceneId || !entity.alive) return [];
  const encounter = ctx.world.encounter;
  if (!encounter) return [];

  const events: DraftEvent[] = [];
  for (const [casterId, caster] of Object.entries(ctx.world.entities)) {
    const guardians = caster.activeSpiritGuardians;
    if (!guardians || caster.sceneId !== entity.sceneId || !caster.position) {
      continue;
    }
    if (entityId === casterId) continue;
    if (!entitiesAreHostileInEncounter(encounter, caster, entity)) continue;
    if (
      distanceFeet(caster.position, entity.position) > 15 ||
      !entity.alive
    ) {
      continue;
    }

    const dc = spellSaveDC(caster);
    if (dc === undefined) continue;
    const d20 = ctx.roll(
      "1d20",
      `spirit-guardians:${entityId}:${guardians.instanceId}`,
    );
    const mod = abilityModifier(entity.abilityScores.wis);
    const total = d20.total + mod;
    const success = total >= dc;
    const dice = scaledDice(3, 8, guardians.slotLevel, 3);
    const roll = ctx.roll(
      dice,
      `spirit-guardians-dmg:${entityId}:${guardians.instanceId}`,
    );
    events.push(
      {
        type: "DiceRolled",
        ...meta(ctx, entityId),
        payload: {
          notation: d20.notation,
          rolls: d20.rolls,
          total: d20.total,
          scope: d20.scope,
          drawIndex: d20.drawIndex,
        },
      },
      {
        type: "SaveRolled",
        ...meta(ctx, entityId),
        payload: {
          entity: entityId,
          ability: "wis",
          dc,
          mode: "normal",
          natural: d20.total,
          total,
          success,
          autoFail: false,
        },
      },
      {
        type: "DiceRolled",
        ...meta(ctx, entityId),
        payload: {
          notation: roll.notation,
          rolls: roll.rolls,
          total: roll.total,
          scope: roll.scope,
          drawIndex: roll.drawIndex,
        },
      },
    );
    const amount = success ? Math.floor(roll.total / 2) : roll.total;
    if (amount > 0) {
      events.push({
        type: "DamageDealt",
        ...meta(ctx, casterId),
        payload: {
          target: entityId,
          amount,
          damageType: "radiant",
          hpBefore: entity.hp.current,
          hpAfter: Math.max(0, entity.hp.current - amount),
          source: casterId,
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

export function creatureBanishedEvent(
  ctx: ExecutionContext,
  casterId: EntityRef,
  target: EntityState,
): DraftEvent {
  return {
    type: "CreatureBanished",
    ...meta(ctx, casterId),
    payload: {
      target: target.id,
      caster: casterId,
      returnSceneId: target.sceneId ?? "",
      returnPosition: target.position ?? { x: 0, y: 0 },
    },
  };
}

export function creatureReturnedEvent(
  ctx: ExecutionContext,
  targetId: EntityRef,
  reason: "concentration" | "duration",
): DraftEvent {
  return {
    type: "CreatureReturned",
    ...meta(ctx, targetId),
    payload: { target: targetId, reason },
  };
}

export function buildBanishmentCastEvents(
  ctx: ExecutionContext,
  caster: EntityState,
  target: EntityState,
): { events: DraftEvent[]; blocked?: string } {
  const encounter = ctx.world.encounter;
  const hostile =
    encounter &&
    areHostile(encounter.sides[caster.id], encounter.sides[target.id]);
  const unwilling = hostile && target.id !== caster.id;

  const events: DraftEvent[] = [];
  if (unwilling) {
    const dc = spellSaveDC(caster)!;
    const d20 = ctx.roll("1d20", `banishment-save:${target.id}`);
    const mod = abilityModifier(target.abilityScores.cha);
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
        ability: "cha",
        dc,
        mode: "normal",
        natural: d20.total,
        total,
        success,
        autoFail: false,
      },
    });
    if (success) {
      return {
        events,
        blocked: `${target.name} succeeded on the Charisma save.`,
      };
    }
  }

  if (!target.position || !target.sceneId) {
    return { events, blocked: `${target.name} is not on the battlefield.` };
  }

  events.push(creatureBanishedEvent(ctx, caster.id, target));
  return { events };
}

/** Spell display names → zone spell ids for concentration cleanup. */
export const CONCENTRATION_ZONE_SPELL_IDS: Record<string, string> = {
  "wall of fire": "wall-of-fire",
  moonbeam: "moonbeam",
  "call lightning": "call-lightning",
  cloudkill: "cloudkill",
  "stinking cloud": "stinking-cloud",
};
