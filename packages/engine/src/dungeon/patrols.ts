/**
 * DUN-6 — authored patrol routes, waypoint ticks, session reset (docs/engine/dungeon-exploration.md).
 */
import { monsterTemplate } from "../content/monsters";
import type { EntityRef } from "../entities/types";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";
import {
  detectionEventsInZone,
  partySideFor,
} from "./detection";
import {
  floorByIndex,
  sceneIdForDungeonFloor,
  zoneAtCell,
} from "./layout";
import type { GridCell, NormalizedDungeonFloor, PatrolRoute } from "./types";

export const DEFAULT_PATROL_INTERVAL_MS = 8000;

export function patrolEntityId(
  dungeonEntityId: string,
  patrolId: string,
): EntityRef {
  return `npc:patrol:${dungeonEntityId.slice(0, 8)}:${patrolId}`;
}

export function isPatrolEntityId(entityId: EntityRef): boolean {
  return entityId.startsWith("npc:patrol:");
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

function resolvePatrolStats(templateRef: string) {
  const template = monsterTemplate(templateRef);
  if (!template) {
    return {
      name: "Patrol",
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      maxHp: 10,
      baseAc: 10,
      speed: 30,
    };
  }
  return {
    name: template.name,
    abilityScores: template.abilityScores,
    maxHp: template.maxHp,
    baseAc: template.baseAc,
    speed: template.speed,
  };
}

function partyOnFloor(world: WorldState, sceneId: string): boolean {
  return Object.values(world.entities).some(
    (e) =>
      e.kind === "character" &&
      !e.id.startsWith("npc:") &&
      e.sceneId === sceneId &&
      e.alive,
  );
}

function patrolRoutesForFloor(
  world: WorldState,
  dungeonEntityId: string,
  floorIndex: number,
): PatrolRoute[] {
  const layout = world.dungeonLayouts?.[dungeonEntityId];
  const floor = layout ? floorByIndex(layout, floorIndex) : undefined;
  return floor?.patrolRoutes ?? [];
}

/** Deploy patrol entities at waypoint 0 for all floors (first threshold). */
export function deployPatrolEvents(
  ctx: ExecutionContext,
  dungeonEntityId: string,
  floorsOverride?: NormalizedDungeonFloor[],
): DraftEvent[] {
  const floors =
    floorsOverride ??
    ctx.world.dungeonLayouts?.[dungeonEntityId]?.floors ??
    [];
  if (floors.length === 0) return [];

  const events: DraftEvent[] = [];
  const existing = new Set(
    Object.keys(ctx.world.dungeonProgress?.patrolStates ?? {}),
  );

  for (const floor of floors) {
    if (floor.patrolRoutes.length === 0) continue;
    const sceneId = sceneIdForDungeonFloor(dungeonEntityId, floor.index);
    for (const route of floor.patrolRoutes) {
      if (existing.has(route.patrolId)) continue;
      const cell = route.waypoints[0]!;
      const entityId = patrolEntityId(dungeonEntityId, route.patrolId);
      const stats = resolvePatrolStats(route.creatureTemplateRef);
      events.push({
        type: "PatrolSpawned",
        ...meta(ctx),
        payload: {
          patrolId: route.patrolId,
          entityId,
          dungeonEntityId,
          floorIndex: floor.index,
          sceneId,
          cell,
          name: stats.name,
          creatureTemplateRef: route.creatureTemplateRef,
          abilityScores: stats.abilityScores,
          maxHp: stats.maxHp,
          baseAc: stats.baseAc,
          speed: stats.speed,
        },
      });
    }
  }
  return events;
}

/** Advance each active patrol one waypoint; run zone detection at destination. */
export function tickPatrolEvents(
  ctx: ExecutionContext,
  dungeonEntityId: string,
  floorIndex?: number,
): DraftEvent[] {
  if (ctx.world.encounter) return [];
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== dungeonEntityId) return [];

  const patrolStates = progress.patrolStates ?? {};
  const events: DraftEvent[] = [];

  for (const state of Object.values(patrolStates)) {
    if (floorIndex !== undefined && state.floorIndex !== floorIndex) continue;
    const sceneId = sceneIdForDungeonFloor(dungeonEntityId, state.floorIndex);
    if (!partyOnFloor(ctx.world, sceneId)) continue;

    const routes = patrolRoutesForFloor(
      ctx.world,
      dungeonEntityId,
      state.floorIndex,
    );
    const route = routes.find((r) => r.patrolId === state.patrolId);
    if (!route || route.waypoints.length === 0) continue;

    const entity = ctx.world.entities[state.entityId];
    if (!entity?.alive || !entity.position) continue;

    const nextIndex = (state.waypointIndex + 1) % route.waypoints.length;
    const to = route.waypoints[nextIndex]!;
    if (to.x === entity.position.x && to.y === entity.position.y) continue;

    events.push({
      type: "PatrolMoved",
      ...meta(ctx, state.entityId),
      payload: {
        patrolId: state.patrolId,
        entityId: state.entityId,
        dungeonEntityId,
        floorIndex: state.floorIndex,
        sceneId,
        from: { ...entity.position },
        to: { ...to },
        waypointIndex: nextIndex,
      },
    });

    const layout = ctx.world.dungeonLayouts?.[dungeonEntityId];
    const floor = layout ? floorByIndex(layout, state.floorIndex) : undefined;
    const zone = floor ? zoneAtCell(floor, to) : undefined;
    if (zone) {
      events.push(
        ...detectionEventsInZone(
          ctx,
          dungeonEntityId,
          state.floorIndex,
          zone,
          sceneId,
          state.entityId,
          to,
        ),
      );
    }
  }

  return events;
}

/** Reset all patrols to waypoint 0 (session load v1 — Q34). */
export function resetPatrolEvents(
  ctx: ExecutionContext,
  dungeonEntityId: string,
): DraftEvent[] {
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== dungeonEntityId) return [];

  const patrolStates = progress.patrolStates ?? {};
  const events: DraftEvent[] = [];

  for (const state of Object.values(patrolStates)) {
    const routes = patrolRoutesForFloor(
      ctx.world,
      dungeonEntityId,
      state.floorIndex,
    );
    const route = routes.find((r) => r.patrolId === state.patrolId);
    if (!route || route.waypoints.length === 0) continue;
    const to = route.waypoints[0]!;
    const entity = ctx.world.entities[state.entityId];
    if (!entity?.position) continue;
    if (to.x === entity.position.x && to.y === entity.position.y && state.waypointIndex === 0) {
      continue;
    }

    events.push({
      type: "PatrolMoved",
      ...meta(ctx, state.entityId),
      payload: {
        patrolId: state.patrolId,
        entityId: state.entityId,
        dungeonEntityId,
        floorIndex: state.floorIndex,
        sceneId: sceneIdForDungeonFloor(dungeonEntityId, state.floorIndex),
        from: { ...entity.position },
        to: { ...to },
        waypointIndex: 0,
      },
    });
  }

  if (events.length > 0) {
    events.unshift({
      type: "PatrolsReset",
      ...meta(ctx),
      payload: { dungeonEntityId },
    });
  }

  return events;
}

export function patrolDetectedParty(
  world: WorldState,
  patrolEntityId: EntityRef,
): boolean {
  for (const pair of world.dungeonProgress?.detectedPairs ?? []) {
    const [detector, detected] = pair.split("->") as [EntityRef, EntityRef];
    if (detector === patrolEntityId || detected === patrolEntityId) {
      const other = detector === patrolEntityId ? detected : detector;
      if (partySideFor(other, world) === "party") return true;
    }
  }
  return false;
}
