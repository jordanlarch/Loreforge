"use client";

import { useEffect, useMemo, useState } from "react";

import type { AuthoredDungeonFloor, GridCell } from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  dungeonCellKey,
  emitFloorsFromEntityData,
  normalizeAuthoredFloors,
  parseAuthoredFloors,
  setFloorEntrance,
  toggleBlockedCell,
  toggleConnectionLocked,
  toggleZoneObject,
  walkableCellKeys,
  zoneAtCell,
  zoneColor,
  type DungeonMapTool,
} from "@/lib/dungeon-map-editor";

const CELL_PX = 22;

type Props = {
  entityId: string;
  name: string;
  summary: string;
  isStub: boolean;
  data: Record<string, unknown>;
};

export function DungeonMapEditor({ entityId, name, summary, isStub, data }: Props) {
  const utils = trpc.useUtils();
  const update = trpc.realms.update.useMutation({
    onSuccess: async () => {
      setDirty(false);
      await utils.realms.get.invalidate({ id: entityId });
    },
  });

  const savedFloors = useMemo(() => parseAuthoredFloors(data), [data]);
  const [floors, setFloors] = useState<AuthoredDungeonFloor[]>(savedFloors);
  const [floorIndex, setFloorIndex] = useState(0);
  const [tool, setTool] = useState<DungeonMapTool>("select");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFloors(savedFloors);
    setDirty(false);
    setFloorIndex(0);
  }, [savedFloors]);

  const normalized = useMemo(() => normalizeAuthoredFloors(floors), [floors]);
  const currentFloor = floors[floorIndex];
  const currentNorm = normalized[floorIndex];

  const canBuildFromRooms = savedFloors.length === 0 && emitFloorsFromEntityData(data).length > 0;

  function patchFloor(next: AuthoredDungeonFloor) {
    setFloors((prev) => prev.map((f, i) => (i === floorIndex ? next : f)));
    setDirty(true);
  }

  function buildFromRooms() {
    const emitted = emitFloorsFromEntityData(data);
    if (emitted.length === 0) return;
    setFloors(emitted);
    setFloorIndex(0);
    setDirty(true);
  }

  function handleCellClick(cell: GridCell) {
    if (!currentFloor || !currentNorm) return;
    switch (tool) {
      case "wall":
        patchFloor(toggleBlockedCell(currentFloor, cell));
        break;
      case "entrance":
        patchFloor(setFloorEntrance(currentFloor, cell));
        break;
      case "object":
        patchFloor(toggleZoneObject(currentFloor, currentNorm, cell));
        break;
      default:
        break;
    }
  }

  function save() {
    update.mutate({
      id: entityId,
      type: "dungeon",
      name,
      summary,
      isStub,
      data: { ...data, floors },
    });
  }

  if (floors.length === 0) {
    return (
      <section className="mt-8 rounded-lg border border-lore-border bg-lore-surface p-6">
        <h2 className="font-display text-lg">Floor map</h2>
        <p className="mt-2 text-sm text-lore-muted">
          No authored floor layout yet. Expand the dungeon with the generator (Rooms tab) or
          build a layout from existing rooms.
        </p>
        {canBuildFromRooms ? (
          <button
            type="button"
            onClick={buildFromRooms}
            className="mt-4 rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            Build layout from rooms
          </button>
        ) : null}
      </section>
    );
  }

  const width = currentNorm?.map.width ?? 8;
  const height = currentNorm?.map.height ?? 12;
  const blocked = new Set(
    (currentFloor?.map?.blockedCells ?? []).map((c) => dungeonCellKey(c)),
  );
  const walkable = currentNorm ? walkableCellKeys(currentNorm) : new Set<string>();
  const objectCells = new Map<string, string>();
  for (const zone of currentFloor?.zones ?? []) {
    for (const obj of zone.objects ?? []) {
      objectCells.set(dungeonCellKey(obj.cell), obj.objectId);
    }
  }
  const entranceKey = currentFloor?.entrance
    ? dungeonCellKey(currentFloor.entrance)
    : undefined;

  const zoneByCell = new Map<string, string>();
  for (const zone of currentNorm?.zones ?? []) {
    for (const cell of zone.cells) {
      zoneByCell.set(dungeonCellKey(cell), zone.zoneId);
    }
  }

  const connections: Array<{
    zoneId: string;
    zoneName: string;
    connectionId: string;
    toZoneId: string;
    locked?: boolean;
  }> =
    currentFloor?.zones.flatMap((zone) =>
      (zone.connections ?? []).map((conn) => ({
        zoneId: zone.zoneId,
        zoneName: zone.name,
        connectionId: conn.connectionId,
        toZoneId: conn.toZoneId,
        locked: conn.locked,
      })),
    ) ?? [];

  return (
    <section className="mt-8 rounded-lg border border-lore-border bg-lore-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Floor map</h2>
          <p className="mt-1 text-xs text-lore-muted">
            Prep-only editor — paint walls, set entrance, place objects, toggle door locks. Zone
            geometry comes from the generator; fog paint deferred.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {floors.length > 1 ? (
            <select
              value={floorIndex}
              onChange={(e) => setFloorIndex(Number(e.target.value))}
              className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
            >
              {floors.map((f, i) => (
                <option key={f.index} value={i}>
                  {f.name || `Floor ${f.index + 1}`}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-lore-muted">
              {currentFloor?.name ?? "Ground level"}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || update.isPending}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : dirty ? "Save map" : "Saved"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["select", "Select"],
            ["wall", "Walls"],
            ["entrance", "Entrance"],
            ["object", "Objects"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            className={`rounded border px-2.5 py-1 text-xs transition-colors ${
              tool === id
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div className="overflow-x-auto rounded border border-lore-border bg-lore-bg p-2">
          <svg
            width={width * CELL_PX + 24}
            height={height * CELL_PX + 24}
            className="font-mono text-[10px]"
            aria-label={`Dungeon floor ${floorIndex + 1} map editor`}
          >
            {Array.from({ length: height }, (_, row) =>
              Array.from({ length: width }, (_, col) => {
                const cell = { x: col, y: row };
                const key = dungeonCellKey(cell);
                const zoneId = zoneByCell.get(key);
                const isBlocked = blocked.has(key);
                const isWalkable = walkable.has(key);
                const isEntrance = entranceKey === key;
                const objectId = objectCells.get(key);
                const clickable = tool !== "select";

                return (
                  <g key={key}>
                    <rect
                      x={col * CELL_PX + 20}
                      y={row * CELL_PX + 12}
                      width={CELL_PX - 2}
                      height={CELL_PX - 2}
                      fill={
                        isBlocked
                          ? "rgba(15, 15, 20, 0.95)"
                          : zoneId
                            ? zoneColor(zoneId)
                            : isWalkable
                              ? "rgba(120, 120, 130, 0.25)"
                              : "rgba(255,255,255,0.03)"
                      }
                      stroke={
                        isEntrance
                          ? "rgba(74, 222, 128, 0.9)"
                          : objectId
                            ? "rgba(250, 204, 21, 0.8)"
                            : "rgba(255,255,255,0.08)"
                      }
                      strokeWidth={isEntrance || objectId ? 1.5 : 0.5}
                      className={clickable ? "cursor-crosshair" : "cursor-default"}
                      onClick={() => clickable && handleCellClick(cell)}
                    />
                    {objectId ? (
                      <text
                        x={col * CELL_PX + 20 + (CELL_PX - 2) / 2}
                        y={row * CELL_PX + 12 + (CELL_PX - 2) / 2 + 3}
                        textAnchor="middle"
                        fill="rgba(250, 204, 21, 0.95)"
                        fontSize="9"
                      >
                        ◆
                      </text>
                    ) : null}
                  </g>
                );
              }),
            )}
            {currentNorm?.zones.map((zone) => {
              const mid = zone.cells[Math.floor(zone.cells.length / 2)];
              if (!mid) return null;
              return (
                <text
                  key={zone.zoneId}
                  x={mid.x * CELL_PX + 20 + (CELL_PX - 2) / 2}
                  y={mid.y * CELL_PX + 12 + (CELL_PX - 2) / 2 - 4}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="8"
                  pointerEvents="none"
                >
                  {zone.zoneId}
                </text>
              );
            })}
          </svg>
          <p className="mt-2 text-[11px] text-lore-muted">
            {width}×{height} · green outline = entrance · ◆ = object · dark = wall
          </p>
        </div>

        <div className="min-w-[220px] flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-lore-text">Zones</h3>
            <ul className="mt-2 space-y-1 text-xs text-lore-muted">
              {currentNorm?.zones.map((zone) => (
                <li key={zone.zoneId} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: zoneColor(zone.zoneId) }}
                  />
                  <span className="text-lore-text">{zone.name}</span>
                  <span className="text-lore-muted/70">({zone.zoneId})</span>
                </li>
              ))}
            </ul>
          </div>

          {connections.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-lore-text">Connections</h3>
              <ul className="mt-2 space-y-2">
                {connections.map((conn) => (
                  <li
                    key={conn.connectionId}
                    className="flex items-center justify-between gap-2 rounded border border-lore-border px-2 py-1.5 text-xs"
                  >
                    <span className="text-lore-muted">
                      {conn.zoneName} → {conn.toZoneId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentFloor) return;
                        patchFloor(
                          toggleConnectionLocked(
                            currentFloor,
                            conn.zoneId,
                            conn.connectionId,
                          ),
                        );
                      }}
                      className={`rounded px-2 py-0.5 ${
                        conn.locked
                          ? "border border-amber-500/40 text-amber-300"
                          : "border border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {conn.locked ? "Locked" : "Open"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tool === "object" && (
            <p className="text-xs text-lore-muted">
              Click a zone cell to toggle an interactable object. Objects must sit inside a room
              zone.
            </p>
          )}
          {tool === "entrance" && currentFloor?.entrance ? (
            <p className="text-xs text-lore-muted">
              Entrance: ({currentFloor.entrance.x}, {currentFloor.entrance.y})
            </p>
          ) : null}
        </div>
      </div>

      {update.error ? (
        <p className="mt-3 text-sm text-red-400">{update.error.message}</p>
      ) : null}
    </section>
  );
}
