/**
 * DUN-3 — passive detection on zone entry (docs/engine/dungeon-exploration.md §2.2 Q16–17, Q24).
 */
import { areHostile } from "../combat/reactions";
import { abilityModifier } from "../entities/abilities";
import type { EntityRef, EntityState } from "../entities/types";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";
import {
  floorByIndex,
  parseDungeonFloorSceneId,
  type NormalizedDungeonZone,
} from "./layout";
import type { GridCell } from "./types";

const PARTY_SIDE = "party";
const FOES_SIDE = "foes";

/** Invisible skips auto-detection (Q16; `hidden` tracer = invisible per §11). */
export function isAutoUndetectable(entity: EntityState): boolean {
  return entity.conditions.some((c) => c.condition === "invisible");
}

export function passivePerception(entity: EntityState): number {
  return 10 + abilityModifier(entity.abilityScores.wis);
}

export function passiveStealth(entity: EntityState): number {
  const dex = abilityModifier(entity.abilityScores.dex);
  const proficient = entity.skillProficiencies?.includes("Stealth") ?? false;
  const prof = proficient ? entity.proficiencyBonus : 0;
  return 10 + dex + prof;
}

/** True when the observer passively notices the target (PP vs passive Stealth). */
export function isPassivelyDetected(
  observer: EntityState,
  target: EntityState,
): boolean {
  if (isAutoUndetectable(target)) return false;
  return passivePerception(observer) >= passiveStealth(target);
}

export function entitiesInZoneCells(
  world: WorldState,
  sceneId: string,
  zone: NormalizedDungeonZone,
  positionOverrides?: ReadonlyMap<EntityRef, GridCell>,
): EntityState[] {
  return Object.values(world.entities)
    .filter((e) => {
      if (e.sceneId !== sceneId || !e.alive) return false;
      const pos = positionOverrides?.get(e.id) ?? e.position;
      if (!pos) return false;
      return zone.cells.some((c) => c.x === pos.x && c.y === pos.y);
    })
    .map((e) => {
      const override = positionOverrides?.get(e.id);
      return override ? { ...e, position: override } : e;
    });
}

export function partySideFor(entityId: EntityRef, world: WorldState): string {
  const enc = world.encounter?.sides[entityId];
  if (enc) return enc;
  const entity = world.entities[entityId];
  if (entity?.kind === "character" && !entityId.startsWith("npc:")) {
    return PARTY_SIDE;
  }
  return FOES_SIDE;
}

export function isHostilePair(
  a: EntityRef,
  b: EntityRef,
  world: WorldState,
): boolean {
  return areHostile(partySideFor(a, world), partySideFor(b, world));
}

function detectionKey(detectorId: EntityRef, detectedId: EntityRef): string {
  return `${detectorId}->${detectedId}`;
}

function alreadyDetected(
  world: WorldState,
  detectorId: EntityRef,
  detectedId: EntityRef,
): boolean {
  return (
    world.dungeonProgress?.detectedPairs?.includes(
      detectionKey(detectorId, detectedId),
    ) ?? false
  );
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

/** Run passive detection for all hostile pairs in a zone; emit CreatureDetected. */
export function detectionEventsInZone(
  ctx: ExecutionContext,
  dungeonEntityId: string,
  floorIndex: number,
  zone: NormalizedDungeonZone,
  sceneId: string,
  moverId?: EntityRef,
  moverCell?: GridCell,
): DraftEvent[] {
  const overrides =
    moverId && moverCell
      ? new Map<EntityRef, GridCell>([[moverId, moverCell]])
      : undefined;
  const inZone = entitiesInZoneCells(ctx.world, sceneId, zone, overrides);
  const events: DraftEvent[] = [];
  let anyNew = false;

  for (const observer of inZone) {
    if (isAutoUndetectable(observer)) continue;
    for (const target of inZone) {
      if (observer.id === target.id) continue;
      if (!isHostilePair(observer.id, target.id, ctx.world)) continue;
      if (alreadyDetected(ctx.world, observer.id, target.id)) continue;
      if (!isPassivelyDetected(observer, target)) continue;
      anyNew = true;
      events.push({
        type: "CreatureDetected",
        ...meta(ctx, observer.id),
        payload: {
          dungeonEntityId,
          floorIndex,
          zoneId: zone.zoneId,
          detectorId: observer.id,
          detectedId: target.id,
        },
      });
    }
  }

  if (zone.alertZoneOnDetection && anyNew) {
    const alerted = ctx.world.dungeonProgress?.alertedZoneIds ?? [];
    if (!alerted.includes(zone.zoneId)) {
      events.push({
        type: "ZoneAlerted",
        ...meta(ctx),
        payload: { dungeonEntityId, zoneId: zone.zoneId },
      });
    }
  }

  return events;
}

function detectedSet(world: WorldState): Set<EntityRef> {
  const ids = new Set<EntityRef>();
  for (const pair of world.dungeonProgress?.detectedPairs ?? []) {
    const [detector, detected] = pair.split("->") as [EntityRef, EntityRef];
    if (detector) ids.add(detector);
    if (detected) ids.add(detected);
  }
  return ids;
}

/** Build encounter roster: visible party/hostiles in zone; hidden stay off until detected (Q24). */
export function rosterForZoneEncounter(
  world: WorldState,
  zone: NormalizedDungeonZone,
  sceneId: string,
): EntityRef[] {
  const inZone = entitiesInZoneCells(world, sceneId, zone);
  const detected = detectedSet(world);
  const roster = new Set<EntityRef>(detected);

  for (const entity of inZone) {
    if (isAutoUndetectable(entity) && !detected.has(entity.id)) continue;
    const side = partySideFor(entity.id, world);
    if (
      side === PARTY_SIDE ||
      side === FOES_SIDE
    ) {
      roster.add(entity.id);
    }
  }

  return [...roster];
}

export function zoneFromLayout(
  world: WorldState,
  dungeonEntityId: string,
  floorIndex: number,
  zoneId: string,
): NormalizedDungeonZone | undefined {
  const layout = world.dungeonLayouts?.[dungeonEntityId];
  if (!layout) return undefined;
  const floor = floorByIndex(layout, floorIndex);
  return floor?.zones.find((z) => z.zoneId === zoneId);
}

export function dungeonSceneForFloor(
  dungeonEntityId: string,
  floorIndex: number,
): string {
  return `scene:realm:${dungeonEntityId}:floor:${floorIndex}`;
}

export function parseSceneContext(
  sceneId: string,
): { dungeonEntityId: string; floorIndex: number } | undefined {
  return parseDungeonFloorSceneId(sceneId);
}
