/**
 * DUN-1/2 — dungeon threshold, layout, zones, connections (see docs/engine/dungeon-exploration.md).
 */
import type { DraftEvent, EventMeta } from "../events/types";
import type { EntityRef } from "../entities/types";
import type { WorldState } from "../projections/world-state";
import type { CampaignStartingLocation } from "../fixtures/exploration";
import { zoneIdForRoomIndex } from "../dungeon/rooms";
import { sceneTrapsFromFloor } from "../dungeon/trap-bridge";
import {
  buildLayoutState,
  connectionIsOpen,
  connectionRequirementsMet,
  entityOnConnectionFromSide,
  findConnectionOnFloor,
  findTransitionOnFloor,
  floorByIndex,
  loadDungeonFloors,
  sceneIdForDungeonFloor,
  sameCell,
  zoneAtCell,
} from "../dungeon/layout";
import type { ExecutionContext } from "./context";
import {
  detectionEventsInZone,
  entitiesInZoneCells,
  isAutoUndetectable,
  isHostilePair,
  isPassivelyDetected,
  partySideFor,
  zoneFromLayout,
} from "../dungeon/detection";
import { interactObjectEvents } from "../dungeon/objects";
import {
  dungeonFogRevealEvents,
  dungeonFogRevealZoneEvents,
  dungeonFogSeedAuthoredEvents,
  revealAreaEvents,
  shareScoutRevealEvents,
} from "../dungeon/fog";
import {
  deployPatrolEvents,
  resetPatrolEvents,
  tickPatrolEvents,
} from "../dungeon/patrols";
import type {
  CommandResult,
  EnterDungeonCommand,
  InteractObjectCommand,
  MarkZoneClearedCommand,
  ReloadDungeonLayoutCommand,
  ResetPatrolsCommand,
  RevealAreaCommand,
  ShareScoutRevealCommand,
  StartZoneEncounterCommand,
  TickPatrolsCommand,
  UseConnectionCommand,
  UseFloorTransitionCommand,
} from "./types";
import { reject } from "./types";

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

function partyCharacters(ctx: ExecutionContext) {
  return Object.values(ctx.world.entities).filter(
    (e) => e.kind === "character" && !e.id.startsWith("npc:"),
  );
}

function floorSceneLabel(locationName: string, floorIndex: number): string {
  return floorIndex === 0
    ? `${locationName} — Ground Level`
    : `${locationName} — Floor ${floorIndex + 1}`;
}

function layoutForDungeon(ctx: ExecutionContext, dungeonEntityId: string) {
  return ctx.world.dungeonLayouts?.[dungeonEntityId];
}

function ensureLayoutEvents(
  ctx: ExecutionContext,
  cmd: EnterDungeonCommand,
): DraftEvent[] {
  if (layoutForDungeon(ctx, cmd.dungeonEntityId)) return [];
  const floors = loadDungeonFloors(cmd.entityData);
  if (floors.length === 0) return [];
  const layout = buildLayoutState(floors);
  return [
    {
      type: "DungeonLayoutSet",
      ...meta(ctx),
      payload: {
        dungeonEntityId: cmd.dungeonEntityId,
        floors: layout.floors,
        openedConnectionIds: layout.openedConnectionIds,
      },
    },
  ];
}

function floorMapForEntry(ctx: ExecutionContext, cmd: EnterDungeonCommand) {
  const layout = layoutForDungeon(ctx, cmd.dungeonEntityId);
  const floors = layout?.floors ?? loadDungeonFloors(cmd.entityData);
  const floor = floorByIndex(
    layout ?? buildLayoutState(floors),
    cmd.floorIndex,
  );
  return floor?.map;
}

function entrancePosition(
  ctx: ExecutionContext,
  cmd: EnterDungeonCommand,
): { x: number; y: number } {
  const layout = layoutForDungeon(ctx, cmd.dungeonEntityId);
  const floors = layout?.floors ?? loadDungeonFloors(cmd.entityData);
  const floor = floorByIndex(
    layout ?? buildLayoutState(floors),
    cmd.floorIndex,
  );
  if (floor?.entrance) return floor.entrance;
  const entryZone = floor?.zones.find((z) => z.zoneId === cmd.entryZoneId);
  if (entryZone?.cells[0]) return entryZone.cells[0]!;
  return { x: 1, y: 3 };
}

function enterDungeonEvents(
  ctx: ExecutionContext,
  cmd: EnterDungeonCommand,
): DraftEvent[] {
  const sceneId = sceneIdForDungeonFloor(cmd.dungeonEntityId, cmd.floorIndex);
  const layout = layoutForDungeon(ctx, cmd.dungeonEntityId);
  const floors = layout?.floors ?? loadDungeonFloors(cmd.entityData);
  const floor = floorByIndex(layout ?? buildLayoutState(floors), cmd.floorIndex);
  const sceneTraps = floor ? sceneTrapsFromFloor(floor) : [];
  const map = floorMapForEntry(ctx, cmd) ?? {
    width: 14,
    height: 12,
    blockedCells: [],
  };
  const events: DraftEvent[] = [...ensureLayoutEvents(ctx, cmd)];
  const progress = ctx.world.dungeonProgress;
  const firstThreshold =
    !progress?.thresholdOpened ||
    progress.dungeonEntityId !== cmd.dungeonEntityId;
  const sceneExists = Boolean(ctx.world.scenes[sceneId]);
  const sceneChanged = ctx.world.currentSceneId !== sceneId;

  if (!sceneExists) {
    events.push({
      type: "SceneCreated",
      ...meta(ctx),
      payload: {
        scene: {
          id: sceneId,
          name: floorSceneLabel(cmd.locationName, cmd.floorIndex),
          description: `${cmd.locationName} — ${floorSceneLabel(cmd.locationName, cmd.floorIndex)}`,
          sceneKind: "dungeon",
          map: {
            width: map.width,
            height: map.height,
            blockedCells: map.blockedCells,
          },
          ...(sceneTraps.length > 0 ? { traps: sceneTraps } : {}),
        },
      },
    });
  }

  if (sceneChanged) {
    events.push({
      type: "SceneChanged",
      ...meta(ctx),
      payload: { sceneId },
    });
  }

  if (firstThreshold) {
    const spawn = entrancePosition(ctx, cmd);
    partyCharacters(ctx).forEach((entity, i) => {
      events.push({
        type: "EntityRelocated",
        ...meta(ctx, entity.id),
        payload: {
          entity: entity.id,
          sceneId,
          position: { x: spawn.x + i, y: spawn.y },
        },
      });
    });

    events.push({
      type: "DungeonThresholdOpened",
      ...meta(ctx),
      payload: {
        dungeonEntityId: cmd.dungeonEntityId,
        floorIndex: cmd.floorIndex,
        entryZoneId: cmd.entryZoneId,
        locationName: cmd.locationName,
      },
    });
  }

  events.push({
    type: "ZoneVisited",
    ...meta(ctx),
    payload: {
      dungeonEntityId: cmd.dungeonEntityId,
      floorIndex: cmd.floorIndex,
      zoneId: cmd.entryZoneId,
      zoneName: cmd.zoneName,
    },
  });

  if (firstThreshold) {
    const partyIds = partyCharacters(ctx).map((e) => e.id);
    const floors =
      layoutForDungeon(ctx, cmd.dungeonEntityId)?.floors ??
      buildLayoutState(loadDungeonFloors(cmd.entityData)).floors;
    const floor = floorByIndex(
      { floors, openedConnectionIds: [] },
      cmd.floorIndex,
    );
    const entryZone = floor?.zones.find((z) => z.zoneId === cmd.entryZoneId);
    events.push(
      ...dungeonFogRevealZoneEvents(
        ctx,
        partyIds,
        sceneId,
        cmd.dungeonEntityId,
        cmd.floorIndex,
        cmd.entryZoneId,
        entryZone?.cells,
        floor?.zones,
      ),
    );
    if (floor?.revealedCells?.length) {
      events.push(
        ...dungeonFogSeedAuthoredEvents(
          ctx,
          partyIds,
          sceneId,
          floor.revealedCells,
          floor.zones,
        ),
      );
    }
    const patrolFloors =
      layoutForDungeon(ctx, cmd.dungeonEntityId)?.floors ??
      buildLayoutState(loadDungeonFloors(cmd.entityData)).floors;
    events.push(...deployPatrolEvents(ctx, cmd.dungeonEntityId, patrolFloors));
  }

  return events;
}

function reloadDungeonLayoutEvents(
  ctx: ExecutionContext,
  cmd: ReloadDungeonLayoutCommand,
): DraftEvent[] {
  const floors = loadDungeonFloors(cmd.entityData);
  if (floors.length === 0) return [];

  const existing = layoutForDungeon(ctx, cmd.dungeonEntityId);
  const openedConnectionIds = existing?.openedConnectionIds ?? [];
  const layout = buildLayoutState(floors);
  layout.openedConnectionIds = openedConnectionIds;

  const events: DraftEvent[] = [
    {
      type: "DungeonLayoutSet",
      ...meta(ctx),
      payload: {
        dungeonEntityId: cmd.dungeonEntityId,
        floors: layout.floors,
        openedConnectionIds,
      },
    },
  ];

  for (const floor of layout.floors) {
    const sceneId = sceneIdForDungeonFloor(cmd.dungeonEntityId, floor.index);
    if (!ctx.world.scenes[sceneId]) continue;
    const sceneTraps = sceneTrapsFromFloor(floor);
    events.push({
      type: "SceneMapPatched",
      ...meta(ctx),
      payload: {
        sceneId,
        map: {
          width: floor.map.width,
          height: floor.map.height,
          blockedCells: floor.map.blockedCells,
        },
        traps: sceneTraps,
      },
    });
  }

  return events;
}

export function handleEnterDungeon(
  cmd: EnterDungeonCommand,
  ctx: ExecutionContext,
): CommandResult {
  return {
    accepted: true,
    events: enterDungeonEvents(ctx, cmd),
    summary: {
      dungeonEntityId: cmd.dungeonEntityId,
      floorIndex: cmd.floorIndex,
      entryZoneId: cmd.entryZoneId,
      zoneName: cmd.zoneName,
      firstThreshold:
        !ctx.world.dungeonProgress?.thresholdOpened ||
        ctx.world.dungeonProgress.dungeonEntityId !== cmd.dungeonEntityId,
    },
  };
}

export function handleReloadDungeonLayout(
  cmd: ReloadDungeonLayoutCommand,
  ctx: ExecutionContext,
): CommandResult {
  const events = reloadDungeonLayoutEvents(ctx, cmd);
  if (events.length === 0) {
    return reject(
      "INVALID_PAYLOAD",
      "No authored floors[] found in entity data.",
    );
  }
  return {
    accepted: true,
    events,
    summary: { dungeonEntityId: cmd.dungeonEntityId, reloaded: true },
  };
}

export function handleUseConnection(
  cmd: UseConnectionCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity?.position) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} is not on the map.`);
  }
  const layout = layoutForDungeon(ctx, cmd.dungeonEntityId);
  if (!layout) {
    return reject("INVALID_PAYLOAD", "Dungeon layout is not loaded.");
  }
  const floor = floorByIndex(layout, cmd.floorIndex);
  if (!floor) {
    return reject("INVALID_PAYLOAD", `Floor ${cmd.floorIndex} not found.`);
  }
  const found = findConnectionOnFloor(floor, cmd.connectionId);
  if (!found) {
    return reject("INVALID_PAYLOAD", `Connection ${cmd.connectionId} not found.`);
  }
  const { zone, connection } = found;
  if (!entityOnConnectionFromSide(entity.position, connection, zone)) {
    return reject(
      "NOT_ADJACENT",
      `${entity.name} must be at the connection to open it.`,
      { connectionId: cmd.connectionId },
    );
  }
  const cleared = ctx.world.dungeonProgress?.clearedZoneIds ?? [];
  if (!connectionRequirementsMet(connection, cleared)) {
    return reject(
      "INVALID_PAYLOAD",
      "Clear the required zones before opening this passage.",
      { requiresCleared: connection.requiresCleared },
    );
  }
  if (connectionIsOpen(connection, layout, cleared)) {
    return {
      accepted: true,
      events: [],
      summary: { alreadyOpen: true, connectionId: cmd.connectionId },
    };
  }
  return {
    accepted: true,
    events: [
      {
        type: "ConnectionOpened",
        ...meta(ctx, cmd.entity),
        payload: {
          dungeonEntityId: cmd.dungeonEntityId,
          floorIndex: cmd.floorIndex,
          connectionId: cmd.connectionId,
          zoneId: zone.zoneId,
        },
      },
    ],
    summary: { opened: cmd.connectionId },
  };
}

export function handleUseFloorTransition(
  cmd: UseFloorTransitionCommand,
  ctx: ExecutionContext,
): CommandResult {
  const entity = ctx.world.entities[cmd.entity];
  if (!entity?.position) {
    return reject("ACTOR_NOT_FOUND", `Entity ${cmd.entity} is not on the map.`);
  }
  const layout = layoutForDungeon(ctx, cmd.dungeonEntityId);
  if (!layout) {
    return reject("INVALID_PAYLOAD", "Dungeon layout is not loaded.");
  }
  const floor = floorByIndex(layout, cmd.floorIndex);
  if (!floor) {
    return reject("INVALID_PAYLOAD", `Floor ${cmd.floorIndex} not found.`);
  }
  const transition = findTransitionOnFloor(floor, cmd.transitionId);
  if (!transition) {
    return reject(
      "INVALID_PAYLOAD",
      `Transition ${cmd.transitionId} not found.`,
    );
  }
  if (!sameCell(entity.position, transition.fromCell)) {
    return reject(
      "NOT_ADJACENT",
      `${entity.name} must stand on the transition cell.`,
      { transitionId: cmd.transitionId, fromCell: transition.fromCell },
    );
  }
  const targetFloor = floorByIndex(layout, transition.toFloorIndex);
  if (!targetFloor) {
    return reject(
      "INVALID_PAYLOAD",
      `Target floor ${transition.toFloorIndex} not found.`,
    );
  }
  const targetSceneId = sceneIdForDungeonFloor(
    cmd.dungeonEntityId,
    transition.toFloorIndex,
  );
  const events: DraftEvent[] = [];
  if (!ctx.world.scenes[targetSceneId]) {
    events.push({
      type: "SceneCreated",
      ...meta(ctx),
      payload: {
        scene: {
          id: targetSceneId,
          name: targetFloor.name,
          description: targetFloor.name,
          sceneKind: "dungeon",
          map: targetFloor.map,
        },
      },
    });
  }
  events.push({
    type: "EntityRelocated",
    ...meta(ctx, cmd.entity),
    payload: {
      entity: cmd.entity,
      sceneId: targetSceneId,
      position: { ...transition.toCell },
    },
  });
  const destZone = zoneAtCell(targetFloor, transition.toCell);
  if (destZone) {
    events.push({
      type: "ZoneVisited",
      ...meta(ctx, cmd.entity),
      payload: {
        dungeonEntityId: cmd.dungeonEntityId,
        floorIndex: transition.toFloorIndex,
        zoneId: destZone.zoneId,
        zoneName: destZone.name,
      },
    });
    if (!ctx.world.encounter) {
      events.push(
        ...detectionEventsInZone(
          ctx,
          cmd.dungeonEntityId,
          transition.toFloorIndex,
          destZone,
          targetSceneId,
        ),
      );
    }
    events.push(
      ...dungeonFogRevealEvents(
        ctx,
        cmd.entity,
        undefined,
        transition.toCell,
        targetSceneId,
      ),
    );
  }
  return {
    accepted: true,
    events,
    summary: {
      entity: cmd.entity,
      toFloorIndex: transition.toFloorIndex,
      toCell: transition.toCell,
    },
  };
}

function detectionPairKey(detectorId: string, detectedId: string): string {
  return `${detectorId}->${detectedId}`;
}

export function handleStartZoneEncounter(
  cmd: StartZoneEncounterCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.encounter) {
    return reject("ENCOUNTER_EXISTS", "An encounter is already in progress.");
  }
  const zone = zoneFromLayout(
    ctx.world,
    cmd.dungeonEntityId,
    cmd.floorIndex,
    cmd.zoneId,
  );
  if (!zone) {
    return reject("INVALID_PAYLOAD", `Zone ${cmd.zoneId} not found.`);
  }
  const sceneId = sceneIdForDungeonFloor(cmd.dungeonEntityId, cmd.floorIndex);
  if (!ctx.world.scenes[sceneId]) {
    return reject("SCENE_NOT_FOUND", `Scene ${sceneId} does not exist.`);
  }

  const inZone = entitiesInZoneCells(ctx.world, sceneId, zone);
  const pairs = new Set(ctx.world.dungeonProgress?.detectedPairs ?? []);
  const events: DraftEvent[] = [];

  for (const observer of inZone) {
    if (isAutoUndetectable(observer)) continue;
    for (const target of inZone) {
      if (observer.id === target.id) continue;
      if (!isHostilePair(observer.id, target.id, ctx.world)) continue;
      const key = detectionPairKey(observer.id, target.id);
      if (pairs.has(key)) continue;
      if (!isPassivelyDetected(observer, target)) continue;
      pairs.add(key);
      events.push({
        type: "CreatureDetected",
        ...meta(ctx, observer.id),
        payload: {
          dungeonEntityId: cmd.dungeonEntityId,
          floorIndex: cmd.floorIndex,
          zoneId: cmd.zoneId,
          detectorId: observer.id,
          detectedId: target.id,
        },
      });
    }
  }

  const rosterIds = new Set<EntityRef>();
  for (const pair of pairs) {
    const [detector, detected] = pair.split("->");
    if (detector) rosterIds.add(detector);
    if (detected) rosterIds.add(detected);
  }
  for (const entity of inZone) {
    if (isAutoUndetectable(entity) && !rosterIds.has(entity.id)) continue;
    const side = partySideFor(entity.id, ctx.world);
    if (side === "party" || side === "foes") {
      rosterIds.add(entity.id);
    }
  }
  const combatants = [...rosterIds];
  const party = combatants.filter(
    (id) => partySideFor(id, ctx.world) === "party",
  );
  const hostiles = combatants.filter(
    (id) => partySideFor(id, ctx.world) === "foes",
  );
  if (party.length === 0 || hostiles.length === 0) {
    return reject(
      "INVALID_PAYLOAD",
      "No detected hostiles and party in this zone to start combat.",
      { zoneId: cmd.zoneId, detectedPairs: [...pairs] },
    );
  }

  const sides: Record<string, string> = {};
  for (const id of combatants) {
    sides[id] = partySideFor(id, ctx.world);
  }

  events.push({
    type: "EncounterStarted",
    ...meta(ctx),
    payload: {
      sceneId,
      combatants,
      sides,
    },
  });

  return {
    accepted: true,
    events,
    summary: { zoneId: cmd.zoneId, combatants: combatants.length, detected: pairs.size },
  };
}

export function handleInteractObject(
  cmd: InteractObjectCommand,
  ctx: ExecutionContext,
): CommandResult {
  const result = interactObjectEvents(ctx, cmd);
  if ("error" in result) {
    const hint =
      result.hint !== undefined &&
      typeof result.hint === "object" &&
      result.hint !== null
        ? (result.hint as Record<string, unknown>)
        : undefined;
    return reject(
      result.code as "ACTOR_NOT_FOUND" | "INVALID_PAYLOAD" | "NOT_ADJACENT",
      result.error,
      hint,
    );
  }
  return {
    accepted: true,
    events: result.events,
    summary: {
      objectId: cmd.objectId,
      zoneId: cmd.zoneId,
      noise: result.noise,
    },
  };
}

export function handleShareScoutReveal(
  cmd: ShareScoutRevealCommand,
  ctx: ExecutionContext,
): CommandResult {
  const result = shareScoutRevealEvents(ctx, cmd.scout);
  if ("error" in result) {
    return reject(
      result.code as "ACTOR_NOT_FOUND" | "INVALID_PAYLOAD",
      result.error,
    );
  }
  const shared = result.events.find((e) => e.type === "ScoutRevealShared");
  const recipientIds =
    shared?.payload && "recipientIds" in shared.payload
      ? shared.payload.recipientIds
      : [];
  return {
    accepted: true,
    events: result.events,
    summary: { scout: cmd.scout, recipientIds },
  };
}

export function handleRevealArea(
  cmd: RevealAreaCommand,
  ctx: ExecutionContext,
): CommandResult {
  const result = revealAreaEvents(ctx, cmd.sceneId, cmd.cells, cmd.forEntity);
  if ("error" in result) {
    return reject(
      result.code as "ACTOR_NOT_FOUND" | "INVALID_PAYLOAD",
      result.error,
    );
  }
  return {
    accepted: true,
    events: result.events,
    summary: {
      sceneId: cmd.sceneId,
      cells: cmd.cells.length,
      forEntity: cmd.forEntity,
    },
  };
}

export function handleTickPatrols(
  cmd: TickPatrolsCommand,
  ctx: ExecutionContext,
): CommandResult {
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== cmd.dungeonEntityId) {
    return reject("INVALID_PAYLOAD", "The party is not in this dungeon.");
  }
  if (ctx.world.encounter) {
    return { accepted: true, events: [], summary: { skipped: "encounter" } };
  }
  const events = tickPatrolEvents(ctx, cmd.dungeonEntityId, cmd.floorIndex);
  return {
    accepted: true,
    events,
    summary: { moved: events.filter((e) => e.type === "PatrolMoved").length },
  };
}

export function handleResetPatrols(
  cmd: ResetPatrolsCommand,
  ctx: ExecutionContext,
): CommandResult {
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== cmd.dungeonEntityId) {
    return reject("INVALID_PAYLOAD", "The party is not in this dungeon.");
  }
  const events = resetPatrolEvents(ctx, cmd.dungeonEntityId);
  return {
    accepted: true,
    events,
    summary: { reset: events.filter((e) => e.type === "PatrolMoved").length },
  };
}

export function handleMarkZoneCleared(
  cmd: MarkZoneClearedCommand,
  ctx: ExecutionContext,
): CommandResult {
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== cmd.dungeonEntityId) {
    return reject(
      "INVALID_PAYLOAD",
      "The party is not in this dungeon.",
    );
  }
  if (progress.clearedZoneIds.includes(cmd.zoneId)) {
    return {
      accepted: true,
      events: [],
      summary: { alreadyCleared: true },
    };
  }
  return {
    accepted: true,
    events: [
      {
        type: "ZoneCleared",
        ...meta(ctx),
        payload: {
          dungeonEntityId: cmd.dungeonEntityId,
          zoneId: cmd.zoneId,
          zoneName: cmd.zoneName,
        },
      },
    ],
    summary: { cleared: cmd.zoneId },
  };
}

/** After victorious dungeon combat, queue zone-cleared when an entry encounter applies. */
export function dungeonZoneClearCommand(
  state: WorldState,
  location: CampaignStartingLocation,
  entityData?: unknown,
): MarkZoneClearedCommand | undefined {
  if (location.type !== "dungeon") return undefined;
  const progress = state.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== location.entityId) {
    return undefined;
  }
  const zoneId =
    progress.activeEncounterZoneId ?? zoneIdForRoomIndex(0);
  if (progress.clearedZoneIds.includes(zoneId)) return undefined;

  const rooms = (entityData && typeof entityData === "object"
    ? (entityData as Record<string, unknown>).rooms
    : undefined) as unknown;
  let zoneName = "Entry";
  if (Array.isArray(rooms) && rooms[0] && typeof rooms[0] === "object") {
    const name = (rooms[0] as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) zoneName = name.trim();
  }

  return {
    type: "mark_zone_cleared",
    dungeonEntityId: location.entityId,
    zoneId,
    zoneName,
  };
}

/** @deprecated Use {@link dungeonZoneClearCommand}. */
export const dungeonRoomClearCommand = dungeonZoneClearCommand;
