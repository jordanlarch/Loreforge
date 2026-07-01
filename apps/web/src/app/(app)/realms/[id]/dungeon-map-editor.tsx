"use client";

import { useEffect, useMemo, useState } from "react";

import type { AuthoredDungeonFloor, GridCell } from "@app/engine";

import {
  CodexItemAddPicker,
  CodexToolboxAddPicker,
  RealmsNpcAddPicker,
} from "@/components/realms-dungeon-pickers";
import { trpc } from "@/lib/trpc/client";
import {
  addCellTrap,
  addConnectionTrap,
  addZoneTrap,
  cellTrapAt,
  dungeonCellKey,
  emitFloorsFromEntityData,
  lootObjectAt,
  normalizeAuthoredFloors,
  npcAtCell,
  parseAuthoredFloors,
  placeLootObject,
  placeNpcOnCell,
  removeCellTrap,
  removeConnectionTrap,
  removeLootObject,
  removeNpcAtCell,
  removeZoneTrap,
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

type PickerTarget =
  | { kind: "trap-cell"; cell: GridCell }
  | { kind: "loot-cell"; cell: GridCell }
  | { kind: "npc-cell"; cell: GridCell }
  | { kind: "trap-connection"; zoneId: string; connectionId: string }
  | { kind: "trap-zone"; zoneId: string };

export function DungeonMapEditor({ entityId, name, summary, isStub, data }: Props) {
  const utils = trpc.useUtils();
  const links = trpc.realms.links.useQuery({ entityId });
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
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  useEffect(() => {
    setFloors(savedFloors);
    setDirty(false);
    setFloorIndex(0);
  }, [savedFloors]);

  const normalized = useMemo(() => normalizeAuthoredFloors(floors), [floors]);
  const currentFloor = floors[floorIndex];
  const currentNorm = normalized[floorIndex];

  const linkedNpcs = useMemo(
    () =>
      (links.data ?? [])
        .filter((link) => link.other.type === "npc")
        .map((link) => ({
          id: link.other.id,
          name: link.other.name,
          summary: null as string | null,
        })),
    [links.data],
  );

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
      case "loot":
        if (lootObjectAt(currentFloor, cell)) {
          patchFloor(removeLootObject(currentFloor, currentNorm, cell));
        } else {
          setPicker({ kind: "loot-cell", cell });
        }
        break;
      case "trap":
        if (cellTrapAt(currentFloor, cell)) {
          patchFloor(removeCellTrap(currentFloor, currentNorm, cell));
        } else {
          setPicker({ kind: "trap-cell", cell });
        }
        break;
      case "npc":
        if (npcAtCell(currentFloor, cell)) {
          patchFloor(removeNpcAtCell(currentFloor, currentNorm, cell));
        } else {
          setPicker({ kind: "npc-cell", cell });
        }
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

  const interactableCells = new Set<string>();
  const lootCells = new Set<string>();
  const trapCells = new Set<string>();
  const npcCells = new Set<string>();

  for (const zone of currentFloor?.zones ?? []) {
    for (const obj of zone.objects ?? []) {
      const key = dungeonCellKey(obj.cell);
      if (obj.kind === "loot") lootCells.add(key);
      else interactableCells.add(key);
    }
    for (const trap of zone.traps ?? []) {
      if (trap.cell) trapCells.add(dungeonCellKey(trap.cell));
    }
    for (const npc of zone.npcPlacements ?? []) {
      if (npc.cell) npcCells.add(dungeonCellKey(npc.cell));
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
    traps: { trapId: string; label?: string; codexSlug: string }[];
  }> =
    currentFloor?.zones.flatMap((zone) =>
      (zone.connections ?? []).map((conn) => ({
        zoneId: zone.zoneId,
        zoneName: zone.name,
        connectionId: conn.connectionId,
        toZoneId: conn.toZoneId,
        locked: conn.locked,
        traps: (conn.traps ?? []).map((t) => ({
          trapId: t.trapId,
          label: t.label,
          codexSlug: t.codexSlug,
        })),
      })),
    ) ?? [];

  return (
    <section className="mt-8 rounded-lg border border-lore-border bg-lore-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Floor map</h2>
          <p className="mt-1 text-xs text-lore-muted">
            Paint walls, entrance, loot, traps, NPCs, and interactables. Codex slugs resolve in
            Live Play.
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
            ["object", "Interact"],
            ["loot", "Loot"],
            ["trap", "Trap"],
            ["npc", "NPC"],
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
                const isLoot = lootCells.has(key);
                const isInteract = interactableCells.has(key);
                const isTrap = trapCells.has(key);
                const isNpc = npcCells.has(key);
                const clickable = tool !== "select";

                let stroke = "rgba(255,255,255,0.08)";
                let strokeWidth = 0.5;
                if (isEntrance) {
                  stroke = "rgba(74, 222, 128, 0.9)";
                  strokeWidth = 1.5;
                } else if (isTrap) {
                  stroke = "rgba(248, 113, 113, 0.95)";
                  strokeWidth = 1.5;
                } else if (isLoot) {
                  stroke = "rgba(250, 204, 21, 0.9)";
                  strokeWidth = 1.5;
                } else if (isNpc) {
                  stroke = "rgba(96, 165, 250, 0.9)";
                  strokeWidth = 1.5;
                } else if (isInteract) {
                  stroke = "rgba(250, 204, 21, 0.8)";
                  strokeWidth = 1.5;
                }

                let marker: string | null = null;
                if (isTrap) marker = "⚠";
                else if (isLoot) marker = "$";
                else if (isNpc) marker = "@";
                else if (isInteract) marker = "◆";

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
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      className={clickable ? "cursor-crosshair" : "cursor-default"}
                      onClick={() => clickable && handleCellClick(cell)}
                    />
                    {marker ? (
                      <text
                        x={col * CELL_PX + 20 + (CELL_PX - 2) / 2}
                        y={row * CELL_PX + 12 + (CELL_PX - 2) / 2 + 3}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.9)"
                        fontSize="9"
                      >
                        {marker}
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
            {width}×{height} · green = entrance · $ loot · ⚠ trap · @ NPC · ◆ interactable
          </p>
        </div>

        <div className="min-w-[240px] flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-lore-text">Zones</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {currentFloor?.zones.map((zone) => {
                const zoneWide = (zone.traps ?? []).filter((t) => !t.cell);
                return (
                  <li
                    key={zone.zoneId}
                    className="rounded border border-lore-border bg-lore-bg px-2 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: zoneColor(zone.zoneId) }}
                      />
                      <span className="text-lore-text">{zone.name}</span>
                    </div>
                    {zoneWide.length > 0 ? (
                      <ul className="mt-2 space-y-1 pl-4 text-lore-muted">
                        {zoneWide.map((t) => (
                          <li key={t.trapId} className="flex items-center justify-between gap-2">
                            <span>Zone trap: {t.label ?? t.codexSlug}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentFloor) return;
                                patchFloor(removeZoneTrap(currentFloor, zone.zoneId, t.trapId));
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setPicker({ kind: "trap-zone", zoneId: zone.zoneId })
                      }
                      className="mt-2 text-lore-accent hover:underline"
                    >
                      + Zone trap
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {connections.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-lore-text">Connections</h3>
              <ul className="mt-2 space-y-2">
                {connections.map((conn) => (
                  <li
                    key={conn.connectionId}
                    className="rounded border border-lore-border px-2 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
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
                    </div>
                    {conn.traps.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-lore-muted">
                        {conn.traps.map((t) => (
                          <li key={t.trapId} className="flex justify-between gap-2">
                            <span>{t.label ?? t.codexSlug}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentFloor) return;
                                patchFloor(
                                  removeConnectionTrap(
                                    currentFloor,
                                    conn.zoneId,
                                    t.trapId,
                                  ),
                                );
                              }}
                              className="text-red-400"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setPicker({
                          kind: "trap-connection",
                          zoneId: conn.zoneId,
                          connectionId: conn.connectionId,
                        })
                      }
                      className="mt-2 text-lore-accent hover:underline"
                    >
                      + Connection trap
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tool === "loot" && (
            <p className="text-xs text-lore-muted">
              Click a zone cell to place Codex loot, or click again to remove.
            </p>
          )}
          {tool === "trap" && (
            <p className="text-xs text-lore-muted">
              Click a cell for a grid trap, or use zone/connection trap buttons in the sidebar.
            </p>
          )}
          {tool === "npc" && (
            <p className="text-xs text-lore-muted">
              Click a zone cell to place a linked NPC token.
            </p>
          )}
          {tool === "object" && (
            <p className="text-xs text-lore-muted">
              Click a zone cell to toggle a generic interactable (DUN-4).
            </p>
          )}
          {tool === "entrance" && currentFloor?.entrance ? (
            <p className="text-xs text-lore-muted">
              Entrance: ({currentFloor.entrance.x}, {currentFloor.entrance.y})
            </p>
          ) : null}
        </div>
      </div>

      {picker?.kind === "loot-cell" && currentFloor && currentNorm ? (
        <CodexItemAddPicker
          title="Place loot on map"
          onClose={() => setPicker(null)}
          onPick={(item) => {
            patchFloor(
              placeLootObject(currentFloor, currentNorm, picker.cell, {
                codexSlug: item.slug,
                label: item.name,
              }),
            );
            setPicker(null);
          }}
        />
      ) : null}

      {picker?.kind === "trap-cell" && currentFloor && currentNorm ? (
        <CodexToolboxAddPicker
          topic="trap"
          onClose={() => setPicker(null)}
          onPick={(entry) => {
            patchFloor(
              addCellTrap(currentFloor, currentNorm, picker.cell, {
                codexSlug: entry.slug,
                label: entry.name,
              }),
            );
            setPicker(null);
          }}
        />
      ) : null}

      {picker?.kind === "trap-connection" && currentFloor ? (
        <CodexToolboxAddPicker
          topic="trap"
          title="Add connection trap"
          onClose={() => setPicker(null)}
          onPick={(entry) => {
            patchFloor(
              addConnectionTrap(
                currentFloor,
                picker.zoneId,
                picker.connectionId,
                { codexSlug: entry.slug, label: entry.name },
              ),
            );
            setPicker(null);
          }}
        />
      ) : null}

      {picker?.kind === "trap-zone" && currentFloor ? (
        <CodexToolboxAddPicker
          topic="trap"
          title="Add zone-wide trap"
          onClose={() => setPicker(null)}
          onPick={(entry) => {
            patchFloor(
              addZoneTrap(currentFloor, picker.zoneId, {
                codexSlug: entry.slug,
                label: entry.name,
              }),
            );
            setPicker(null);
          }}
        />
      ) : null}

      {picker?.kind === "npc-cell" && currentFloor && currentNorm ? (
        <RealmsNpcAddPicker
          npcs={linkedNpcs}
          onClose={() => setPicker(null)}
          onPick={(npc) => {
            patchFloor(
              placeNpcOnCell(currentFloor, currentNorm, picker.cell, npc),
            );
            setPicker(null);
          }}
        />
      ) : null}

      {update.error ? (
        <p className="mt-3 text-sm text-red-400">{update.error.message}</p>
      ) : null}
    </section>
  );
}
