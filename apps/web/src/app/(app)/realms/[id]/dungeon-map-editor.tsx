"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AuthoredDungeonFloor, GridCell } from "@app/engine";

import {
  CodexItemAddPicker,
  CodexToolboxAddPicker,
  RealmsNpcAddPicker,
} from "@/components/realms-dungeon-pickers";
import {
  clampZoom,
  OVERWORLD_ZOOM_MAX,
  OVERWORLD_ZOOM_MIN,
  OVERWORLD_ZOOM_STEP,
  panForSvgZoom,
} from "@/lib/map-viewport-zoom";
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
  setZoneRect,
  applyZoneRectResize,
  inferAuthoredZoneRect,
  addDungeonFloor,
  addFloorTransition,
  removeFloorTransition,
  updateFloorTransitionCell,
  transitionCellsOnFloor,
  toggleBlockedCell,
  toggleConnectionLocked,
  toggleZoneObject,
  walkableCellKeys,
  zoneAtCell,
  zoneColor,
  type DungeonMapTool,
  type ZoneRect,
  type ZoneResizeHandle,
} from "@/lib/dungeon-map-editor";

const CELL_PX = 22;
const SVG_PAD_X = 20;
const SVG_PAD_Y = 12;
const HANDLE_PX = 8;
const VIEWPORT_PAN_DEFAULT = { x: 24, y: 24 };

function rectSvgBounds(rect: ZoneRect) {
  return {
    x: rect.x * CELL_PX + SVG_PAD_X,
    y: rect.y * CELL_PX + SVG_PAD_Y,
    w: rect.w * CELL_PX - 2,
    h: rect.h * CELL_PX - 2,
  };
}

function resizeHandles(rect: ZoneRect): { handle: ZoneResizeHandle; cx: number; cy: number }[] {
  const b = rectSvgBounds(rect);
  const midX = b.x + b.w / 2;
  const midY = b.y + b.h / 2;
  return [
    { handle: "nw", cx: b.x, cy: b.y },
    { handle: "n", cx: midX, cy: b.y },
    { handle: "ne", cx: b.x + b.w, cy: b.y },
    { handle: "e", cx: b.x + b.w, cy: midY },
    { handle: "se", cx: b.x + b.w, cy: b.y + b.h },
    { handle: "s", cx: midX, cy: b.y + b.h },
    { handle: "sw", cx: b.x, cy: b.y + b.h },
    { handle: "w", cx: b.x, cy: midY },
  ];
}

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

type ResizeDragState = {
  zoneId: string;
  handle: ZoneResizeHandle;
  startRect: ZoneRect;
  startClientX: number;
  startClientY: number;
};

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
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState | null>(null);
  const [previewRect, setPreviewRect] = useState<ZoneRect | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(
    null,
  );
  const [pan, setPan] = useState(VIEWPORT_PAN_DEFAULT);
  const [zoom, setZoom] = useState(1);
  const [viewportPanning, setViewportPanning] = useState(false);

  const mapViewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const viewportPanDrag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    setFloors(savedFloors);
    setDirty(false);
    setFloorIndex(0);
    setSelectedZoneId(null);
    setSelectedTransitionId(null);
    setResizeDrag(null);
    setPreviewRect(null);
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

  function patchFloors(next: AuthoredDungeonFloor[]) {
    setFloors(next);
    setDirty(true);
  }

  function patchFloor(next: AuthoredDungeonFloor) {
    setFloors((prev) => prev.map((f, i) => (i === floorIndex ? next : f)));
    setDirty(true);
  }

  const applyViewportZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const el = mapViewportRef.current;
      setZoom((prev) => {
        const clamped = clampZoom(next, OVERWORLD_ZOOM_MIN, OVERWORLD_ZOOM_MAX);
        if (clamped === prev) return prev;
        if (el && anchor) {
          const rect = el.getBoundingClientRect();
          const nextPan = panForSvgZoom({
            panX: panRef.current.x,
            panY: panRef.current.y,
            clientX: anchor.clientX,
            clientY: anchor.clientY,
            rect,
            oldZoom: prev,
            newZoom: clamped,
          });
          const updated = { x: nextPan.panX, y: nextPan.panY };
          panRef.current = updated;
          setPan(updated);
        }
        return clamped;
      });
    },
    [],
  );

  const resetViewport = useCallback(() => {
    setZoom(1);
    setPan(VIEWPORT_PAN_DEFAULT);
    panRef.current = VIEWPORT_PAN_DEFAULT;
  }, []);

  const onViewportWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -OVERWORLD_ZOOM_STEP : OVERWORLD_ZOOM_STEP;
      applyViewportZoom(
        clampZoom(
          zoomRef.current + delta,
          OVERWORLD_ZOOM_MIN,
          OVERWORLD_ZOOM_MAX,
        ),
        { clientX: e.clientX, clientY: e.clientY },
      );
    },
    [applyViewportZoom],
  );

  useEffect(() => {
    const el = mapViewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", onViewportWheel, { passive: false });
    return () => el.removeEventListener("wheel", onViewportWheel);
  }, [onViewportWheel]);

  const onViewportMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1) return;
    e.preventDefault();
    viewportPanDrag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    setViewportPanning(true);
  }, []);

  useEffect(() => {
    if (!viewportPanning) return;

    function onMove(ev: MouseEvent) {
      const drag = viewportPanDrag.current;
      if (!drag) return;
      const updated = {
        x: drag.panX + (ev.clientX - drag.x),
        y: drag.panY + (ev.clientY - drag.y),
      };
      panRef.current = updated;
      setPan(updated);
    }

    function onUp(ev: MouseEvent) {
      if (ev.button === 1) {
        viewportPanDrag.current = null;
        setViewportPanning(false);
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [viewportPanning]);

  const finishResizeDrag = useCallback(
    (drag: ResizeDragState, rect: ZoneRect) => {
      if (!currentFloor) return;
      patchFloor(setZoneRect(currentFloor, drag.zoneId, rect));
      setResizeDrag(null);
      setPreviewRect(null);
    },
    [currentFloor, floorIndex],
  );

  useEffect(() => {
    if (!resizeDrag) return;
    const drag = resizeDrag;

    function onMove(e: MouseEvent) {
      const scale = zoomRef.current;
      const deltaX = Math.round((e.clientX - drag.startClientX) / (CELL_PX * scale));
      const deltaY = Math.round((e.clientY - drag.startClientY) / (CELL_PX * scale));
      setPreviewRect(
        applyZoneRectResize(drag.startRect, drag.handle, deltaX, deltaY),
      );
    }

    function onUp(e: MouseEvent) {
      const scale = zoomRef.current;
      const deltaX = Math.round((e.clientX - drag.startClientX) / (CELL_PX * scale));
      const deltaY = Math.round((e.clientY - drag.startClientY) / (CELL_PX * scale));
      finishResizeDrag(
        drag,
        applyZoneRectResize(drag.startRect, drag.handle, deltaX, deltaY),
      );
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeDrag, finishResizeDrag]);

  function beginResizeDrag(
    zoneId: string,
    handle: ZoneResizeHandle,
    startRect: ZoneRect,
    e: React.MouseEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedZoneId(zoneId);
    setResizeDrag({
      zoneId,
      handle,
      startRect,
      startClientX: e.clientX,
      startClientY: e.clientY,
    });
    setPreviewRect(startRect);
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
      case "zone": {
        const zone = zoneAtCell(currentNorm, cell);
        setSelectedZoneId(zone?.zoneId ?? null);
        break;
      }
      case "wall":
        patchFloor(toggleBlockedCell(currentFloor, cell));
        break;
      case "entrance":
        patchFloor(setFloorEntrance(currentFloor, cell));
        break;
      case "stair": {
        if (!selectedTransitionId) break;
        const onThisFloor = (currentFloor.transitions ?? []).find(
          (t) => t.transitionId === selectedTransitionId,
        );
        if (!onThisFloor) break;
        if (onThisFloor.transitionId.endsWith("-return")) {
          const sourceId = onThisFloor.transitionId.replace(/-return$/, "");
          patchFloors(
            updateFloorTransitionCell(
              floors,
              onThisFloor.toFloorIndex,
              sourceId,
              "to",
              cell,
            ),
          );
        } else {
          patchFloors(
            updateFloorTransitionCell(
              floors,
              currentFloor.index,
              selectedTransitionId,
              "from",
              cell,
            ),
          );
        }
        break;
      }
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

  const transitionCells = currentFloor
    ? transitionCellsOnFloor(currentFloor)
    : new Map<string, { transitionId: string; direction: "out" | "in" }>();

  const otherFloors = floors.filter((f) => f.index !== currentFloor?.index);

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
            Paint walls, entrance, loot, traps, NPCs, and interactables. Use Zones to
            drag-resize room geometry; Stairs links floors. Wheel zoom · middle-click pan.
            Codex slugs resolve in Live Play.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={floorIndex}
            onChange={(e) => {
              setFloorIndex(Number(e.target.value));
              setSelectedTransitionId(null);
            }}
            className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
          >
            {floors.map((f, i) => (
              <option key={f.index} value={i}>
                {f.name || `Floor ${f.index + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const next = addDungeonFloor(floors);
              patchFloors(next);
              setFloorIndex(next.length - 1);
            }}
            className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
          >
            + Add floor
          </button>
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
            ["zone", "Zones"],
            ["wall", "Walls"],
            ["entrance", "Entrance"],
            ["stair", "Stairs"],
            ["object", "Interact"],
            ["loot", "Loot"],
            ["trap", "Trap"],
            ["npc", "NPC"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTool(id);
              if (id !== "zone") setSelectedZoneId(null);
              if (id !== "stair") setSelectedTransitionId(null);
            }}
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
        <div
          ref={mapViewportRef}
          className={`relative max-h-[min(70vh,520px)] min-h-[280px] overflow-hidden rounded border border-lore-border bg-lore-bg p-2 ${
            viewportPanning ? "cursor-grabbing" : "cursor-default"
          }`}
          onMouseDown={onViewportMouseDown}
        >
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 rounded border border-lore-border bg-lore-surface/95 px-1.5 py-1 text-xs shadow-sm">
            <button
              type="button"
              className="pointer-events-auto rounded px-1.5 py-0.5 text-lore-muted hover:bg-lore-bg hover:text-lore-text"
              onClick={() =>
                applyViewportZoom(zoomRef.current - OVERWORLD_ZOOM_STEP)
              }
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center tabular-nums text-lore-text">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="pointer-events-auto rounded px-1.5 py-0.5 text-lore-muted hover:bg-lore-bg hover:text-lore-text"
              onClick={() =>
                applyViewportZoom(zoomRef.current + OVERWORLD_ZOOM_STEP)
              }
              aria-label="Zoom in"
            >
              +
            </button>
            {zoom !== 1 ||
            pan.x !== VIEWPORT_PAN_DEFAULT.x ||
            pan.y !== VIEWPORT_PAN_DEFAULT.y ? (
              <button
                type="button"
                className="pointer-events-auto ml-1 rounded border border-lore-border px-1.5 py-0.5 text-[10px] text-lore-muted hover:text-lore-text"
                onClick={resetViewport}
              >
                Reset view
              </button>
            ) : null}
          </div>
          <div
            className="inline-block origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
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
                const transition = transitionCells.get(key);
                const clickable = tool !== "select";

                let stroke = "rgba(255,255,255,0.08)";
                let strokeWidth = 0.5;
                if (tool === "zone" && zoneId === selectedZoneId) {
                  stroke = "rgba(255,255,255,0.45)";
                  strokeWidth = 1;
                } else if (transition) {
                  stroke = "rgba(167, 139, 250, 0.95)";
                  strokeWidth = 1.5;
                } else if (isEntrance) {
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
                if (transition) marker = transition.direction === "out" ? "↑" : "↓";
                else if (isTrap) marker = "⚠";
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
                  x={mid.x * CELL_PX + SVG_PAD_X + (CELL_PX - 2) / 2}
                  y={mid.y * CELL_PX + SVG_PAD_Y + (CELL_PX - 2) / 2 - 4}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="8"
                  pointerEvents="none"
                >
                  {zone.zoneId}
                </text>
              );
            })}
            {tool === "zone" && selectedZoneId && currentFloor
              ? (() => {
                  const zone = currentFloor.zones.find((z) => z.zoneId === selectedZoneId);
                  const normZone = currentNorm?.zones.find((z) => z.zoneId === selectedZoneId);
                  if (!zone) return null;
                  const baseRect = inferAuthoredZoneRect(zone, normZone);
                  if (!baseRect) return null;
                  const rect = previewRect ?? baseRect;
                  const bounds = rectSvgBounds(rect);
                  return (
                    <g key={`zone-resize-${selectedZoneId}`} aria-hidden>
                      <rect
                        x={bounds.x - 1}
                        y={bounds.y - 1}
                        width={bounds.w + 2}
                        height={bounds.h + 2}
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        pointerEvents="none"
                      />
                      {resizeHandles(rect).map(({ handle, cx, cy }) => (
                        <rect
                          key={handle}
                          x={cx - HANDLE_PX / 2}
                          y={cy - HANDLE_PX / 2}
                          width={HANDLE_PX}
                          height={HANDLE_PX}
                          fill="rgba(255,255,255,0.95)"
                          stroke="rgba(15,15,20,0.9)"
                          strokeWidth={1}
                          className="cursor-pointer"
                          onMouseDown={(e) =>
                            beginResizeDrag(selectedZoneId, handle, baseRect, e)
                          }
                        />
                      ))}
                    </g>
                  );
                })()
              : null}
          </svg>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-lore-muted">
            {width}×{height} · green = entrance · ↑↓ stair · $ loot · ⚠ trap · @ NPC · ◆ interactable
            {tool === "zone" ? " · drag handles to resize selected zone" : ""}
            {tool === "stair" && selectedTransitionId
              ? " · click a cell to place the selected stair endpoint"
              : ""}
          </p>
        </div>

        <div className="min-w-[240px] flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-lore-text">Zones</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {currentFloor?.zones.map((zone) => {
                const zoneWide = (zone.traps ?? []).filter((t) => !t.cell);
                const normZone = currentNorm?.zones.find((z) => z.zoneId === zone.zoneId);
                const rect = inferAuthoredZoneRect(zone, normZone);
                const isSelected = selectedZoneId === zone.zoneId;
                return (
                  <li
                    key={zone.zoneId}
                    className={`rounded border px-2 py-2 ${
                      isSelected
                        ? "border-lore-accent bg-lore-accent-dim/40"
                        : "border-lore-border bg-lore-bg"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTool("zone");
                        setSelectedZoneId(zone.zoneId);
                      }}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: zoneColor(zone.zoneId) }}
                      />
                      <span className="text-lore-text">{zone.name}</span>
                      {rect ? (
                        <span className="ml-auto text-[10px] text-lore-muted">
                          {rect.w}×{rect.h}
                        </span>
                      ) : null}
                    </button>
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

          <div>
            <h3 className="text-sm font-medium text-lore-text">Floor transitions</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {(currentFloor?.transitions ?? []).map((transition) => {
                const isReturn = transition.transitionId.endsWith("-return");
                const targetFloor = floors.find((f) => f.index === transition.toFloorIndex);
                const label = isReturn
                  ? `↓ from ${targetFloor?.name ?? `floor ${transition.toFloorIndex}`}`
                  : `↑ to ${targetFloor?.name ?? `floor ${transition.toFloorIndex}`}`;
                const cell = isReturn ? transition.fromCell : transition.fromCell;
                const isSelected = selectedTransitionId === transition.transitionId;
                return (
                  <li
                    key={transition.transitionId}
                    className={`rounded border px-2 py-2 ${
                      isSelected
                        ? "border-violet-400/60 bg-violet-500/10"
                        : "border-lore-border bg-lore-bg"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTool("stair");
                        setSelectedTransitionId(transition.transitionId);
                      }}
                      className="flex w-full flex-col items-start gap-0.5 text-left"
                    >
                      <span className="text-lore-text">{label}</span>
                      <span className="text-[10px] text-lore-muted">
                        cell ({cell.x}, {cell.y})
                      </span>
                    </button>
                    {!isReturn ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentFloor) return;
                          patchFloors(
                            removeFloorTransition(
                              floors,
                              currentFloor.index,
                              transition.transitionId,
                            ),
                          );
                          if (selectedTransitionId === transition.transitionId) {
                            setSelectedTransitionId(null);
                          }
                        }}
                        className="mt-2 text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {otherFloors.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {otherFloors.map((floor) => (
                  <button
                    key={floor.index}
                    type="button"
                    onClick={() => {
                      if (!currentFloor) return;
                      patchFloors(
                        addFloorTransition(floors, currentFloor.index, floor.index),
                      );
                    }}
                    className="rounded border border-lore-border px-2 py-1 text-[11px] text-lore-muted transition-colors hover:border-violet-400/50 hover:text-lore-text"
                  >
                    + Stair to {floor.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-lore-muted">
                Add another floor to link stairs between levels.
              </p>
            )}
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
