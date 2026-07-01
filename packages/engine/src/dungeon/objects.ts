/**
 * DUN-4 — dungeon map object interaction (docs/engine/dungeon-exploration.md §4, Q25).
 */
import { abilityModifier } from "../entities/abilities";
import type { EntityRef, EntityState } from "../entities/types";
import type { DraftEvent, EventMeta } from "../events/types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";
import {
  detectionEventsInZone,
  entitiesInZoneCells,
  isHostilePair,
  passivePerception,
} from "./detection";
import {
  actorCanReachObject,
  findObjectOnFloor,
  floorByIndex,
  zoneAtCell,
} from "./layout";
import type { NormalizedDungeonZone, ObjectNoise } from "./types";

const PARTY_SIDE = "party";
const FOES_SIDE = "foes";

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

export function objectTaken(
  world: WorldState,
  dungeonEntityId: string,
  objectId: string,
): boolean {
  const progress = world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== dungeonEntityId) return false;
  return Boolean(progress.objectStates?.[objectId]?.takenByEntityId);
}

function partySideFor(entityId: EntityRef, world: WorldState): string {
  const enc = world.encounter?.sides[entityId];
  if (enc) return enc;
  const entity = world.entities[entityId];
  if (entity?.kind === "character" && !entityId.startsWith("npc:")) {
    return PARTY_SIDE;
  }
  return FOES_SIDE;
}

function hostileMonstersInZone(
  world: WorldState,
  sceneId: string,
  zone: NormalizedDungeonZone,
): EntityState[] {
  const inZone = entitiesInZoneCells(world, sceneId, zone);
  const party = inZone.filter(
    (e) => partySideFor(e.id, world) === PARTY_SIDE,
  );
  if (party.length === 0) return [];
  return inZone.filter((e) => {
    if (partySideFor(e.id, world) !== FOES_SIDE || !e.alive) return false;
    return party.some((ally) => isHostilePair(ally.id, e.id, world));
  });
}

function stealthCheckEvents(
  ctx: ExecutionContext,
  actor: EntityState,
  dc: number,
): DraftEvent[] {
  const dex = abilityModifier(actor.abilityScores.dex);
  const proficient = actor.skillProficiencies?.includes("Stealth") ?? false;
  const prof = proficient ? actor.proficiencyBonus : 0;
  const roll = ctx.roll("1d20", `stealth:${actor.id}`, "normal");
  const total = roll.total + dex + prof;
  return [
    {
      type: "CheckRolled",
      ...meta(ctx, actor.id),
      payload: {
        entity: actor.id,
        ability: "dex",
        skill: "Stealth",
        dc,
        mode: "normal",
        natural: roll.total,
        total,
        proficient,
        success: total >= dc,
      },
    },
  ];
}

export type InteractObjectInput = {
  entity: EntityRef;
  dungeonEntityId: string;
  floorIndex: number;
  zoneId: string;
  objectId: string;
  noise?: ObjectNoise;
};

/** Build events for a successful object interaction (noise adjudication included). */
export function interactObjectEvents(
  ctx: ExecutionContext,
  cmd: InteractObjectInput,
):
  | { events: DraftEvent[]; noise: ObjectNoise }
  | { error: string; code: string; hint?: unknown } {
  const actor = ctx.world.entities[cmd.entity];
  if (!actor?.position) {
    return { error: `Entity ${cmd.entity} is not on the map.`, code: "ACTOR_NOT_FOUND" };
  }
  const layout = ctx.world.dungeonLayouts?.[cmd.dungeonEntityId];
  if (!layout) {
    return { error: "Dungeon layout is not loaded.", code: "INVALID_PAYLOAD" };
  }
  const floor = floorByIndex(layout, cmd.floorIndex);
  if (!floor) {
    return { error: `Floor ${cmd.floorIndex} not found.`, code: "INVALID_PAYLOAD" };
  }
  const found = findObjectOnFloor(floor, cmd.zoneId, cmd.objectId);
  if (!found) {
    return {
      error: `Object ${cmd.objectId} not found in zone ${cmd.zoneId}.`,
      code: "INVALID_PAYLOAD",
    };
  }
  if (objectTaken(ctx.world, cmd.dungeonEntityId, cmd.objectId)) {
    return {
      error: "That object has already been taken.",
      code: "INVALID_PAYLOAD",
      hint: "Choose another objective in this zone.",
    };
  }
  const actorZone = zoneAtCell(floor, actor.position);
  if (!actorZone || actorZone.zoneId !== cmd.zoneId) {
    return {
      error: `${actor.name} must be in the same zone as the object.`,
      code: "NOT_ADJACENT",
    };
  }
  if (!actorCanReachObject(actor.position, found.object.cell)) {
    return {
      error: `${actor.name} must stand on or beside the object to interact.`,
      code: "NOT_ADJACENT",
      hint: { objectCell: found.object.cell, actorCell: actor.position },
    };
  }

  const noise = cmd.noise ?? found.object.noise ?? "quiet";
  const events: DraftEvent[] = [];
  const sceneId = actor.sceneId;
  if (!sceneId) {
    return { error: "Actor has no scene.", code: "INVALID_PAYLOAD" };
  }

  const hostiles = hostileMonstersInZone(ctx.world, sceneId, found.zone);

  if (noise === "quiet" && hostiles.length > 0) {
    const dc = Math.max(...hostiles.map((h) => passivePerception(h)));
    const checkEvents = stealthCheckEvents(ctx, actor, dc);
    events.push(...checkEvents);
    const check = checkEvents[0];
    const success =
      check?.type === "CheckRolled" &&
      (check.payload as { success?: boolean }).success === true;
    if (!success) {
      events.push(
        ...detectionEventsInZone(
          ctx,
          cmd.dungeonEntityId,
          cmd.floorIndex,
          found.zone,
          sceneId,
          cmd.entity,
          actor.position,
        ),
      );
    }
  }

  if (noise === "loud") {
    const alerted = ctx.world.dungeonProgress?.alertedZoneIds ?? [];
    if (!alerted.includes(cmd.zoneId)) {
      events.push({
        type: "ZoneAlerted",
        ...meta(ctx),
        payload: { dungeonEntityId: cmd.dungeonEntityId, zoneId: cmd.zoneId },
      });
    }
    if (!ctx.world.encounter) {
      events.push(
        ...detectionEventsInZone(
          ctx,
          cmd.dungeonEntityId,
          cmd.floorIndex,
          found.zone,
          sceneId,
          cmd.entity,
          actor.position,
        ),
      );
    }
  }

  events.push({
    type: "ObjectTaken",
    ...meta(ctx, cmd.entity),
    payload: {
      dungeonEntityId: cmd.dungeonEntityId,
      floorIndex: cmd.floorIndex,
      zoneId: cmd.zoneId,
      objectId: cmd.objectId,
      actor: cmd.entity,
      noise,
      kind: found.object.kind,
    },
  });

  return { events, noise };
}
