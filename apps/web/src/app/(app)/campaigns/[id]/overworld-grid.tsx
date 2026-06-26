"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  OVERWORLD_CELL_PX,
  cellInBounds,
  cellKey,
  isPinType,
  isTerritoryType,
  ownerAtCell,
  pinAtCell,
  toolForEntityType,
  toggleTerritoryCell,
  type OverworldEntity,
  type OverworldTool,
} from "@/lib/overworld-map";
import { mapLevelBadge } from "@/lib/map-zoom-level";
import {
  clampZoom,
  OVERWORLD_ZOOM_MAX,
  OVERWORLD_ZOOM_MIN,
  OVERWORLD_ZOOM_STEP,
  panForSvgZoom,
} from "@/lib/map-viewport-zoom";
import {
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  type RealmEntityType,
} from "@/lib/realms";
import type { OverworldGridConfig } from "@app/db";
import { trpc } from "@/lib/trpc/client";

import { SettlementMapPanel } from "./settlement-map-panel";

type OverworldGridProps = {
  campaignId: string;
  grid: OverworldGridConfig;
  entities: OverworldEntity[];
  parentSettlementByEntity: Record<string, string | undefined>;
  mode: "edit" | "view";
  fill?: boolean;
  isOwner?: boolean;
  onEnterLocation?: (entityId: string) => void;
};

export function OverworldGrid({
  campaignId,
  grid,
  entities,
  parentSettlementByEntity,
  mode,
  fill = false,
  isOwner = true,
  onEnterLocation,
}: OverworldGridProps) {
  const utils = trpc.useUtils();
  const [tool, setTool] = useState<OverworldTool>("pan");
  const [activeEntityId, setActiveEntityId] = useState<string>("");
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [zoom, setZoom] = useState(1);
  const [showHidden, setShowHidden] = useState(false);
  const [painting, setPainting] = useState(false);
  const [paintAdd, setPaintAdd] = useState(true);
  const [draftTerritory, setDraftTerritory] = useState<string[] | null>(null);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(
    null,
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const el = mapRef.current;
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

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -OVERWORLD_ZOOM_STEP : OVERWORLD_ZOOM_STEP;
      applyZoom(
        clampZoom(
          zoomRef.current + delta,
          OVERWORLD_ZOOM_MIN,
          OVERWORLD_ZOOM_MAX,
        ),
        { clientX: e.clientX, clientY: e.clientY },
      );
    },
    [applyZoom],
  );

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const setTerritory = trpc.campaigns.setOverworldTerritory.useMutation({
    onSuccess: async () => {
      await utils.campaigns.overworldMap.invalidate({ campaignId });
    },
  });
  const setPin = trpc.campaigns.setOverworldPin.useMutation({
    onSuccess: async () => {
      await utils.campaigns.overworldMap.invalidate({ campaignId });
    },
  });
  const setSettlementPin = trpc.campaigns.setSettlementPin.useMutation({
    onSuccess: async () => {
      await utils.campaigns.overworldMap.invalidate({ campaignId });
    },
  });

  const activeEntity = entities.find((e) => e.id === activeEntityId);

  const visibleEntities = useMemo(() => {
    if (isOwner && showHidden) return entities;
    return entities.filter((e) => e.discovered);
  }, [entities, isOwner, showHidden]);

  const renderedEntities = useMemo(() => {
    if (!activeEntity || draftTerritory == null) return visibleEntities;
    return visibleEntities.map((entity) =>
      entity.id === activeEntity.id
        ? { ...entity, overworldMap: { ...entity.overworldMap, territory: draftTerritory } }
        : entity,
    );
  }, [activeEntity, draftTerritory, visibleEntities]);

  const territoryEntities = useMemo(
    () =>
      renderedEntities.filter(
        (e) => isTerritoryType(e.type) && (e.overworldMap.territory?.length ?? 0) > 0,
      ),
    [renderedEntities],
  );

  const pinEntities = useMemo(
    () => renderedEntities.filter((e) => e.overworldMap.pin != null),
    [renderedEntities],
  );

  const regionOptions = entities.filter((e) => e.type === "region");
  const settlementOptions = entities.filter((e) => e.type === "settlement");
  const pinOptions = entities.filter((e) => isPinType(e.type));

  const parentSettlementIdForActive =
    activeEntity && isPinType(activeEntity.type)
      ? parentSettlementByEntity[activeEntity.id]
      : undefined;
  const parentSettlement = parentSettlementIdForActive
    ? entities.find((e) => e.id === parentSettlementIdForActive)
    : undefined;
  const poisInSettlement = parentSettlementIdForActive
    ? entities.filter(
        (e) =>
          isPinType(e.type) &&
          parentSettlementByEntity[e.id] === parentSettlementIdForActive,
      )
    : [];

  const persistTerritory = useCallback(
    async (entityId: string, territory: string[]) => {
      await setTerritory.mutateAsync({
        campaignId,
        entityId,
        territory,
      });
    },
    [campaignId, setTerritory],
  );

  function paintCell(col: number, row: number, add: boolean) {
    if (!activeEntity || !isTerritoryType(activeEntity.type)) return;
    const base = draftTerritory ?? activeEntity.overworldMap.territory ?? [];
    const next = toggleTerritoryCell({ territory: base }, col, row, add);
    setDraftTerritory(next.territory ?? []);
  }

  async function placePin(col: number, row: number) {
    if (!activeEntity || !isPinType(activeEntity.type)) return;
    await setPin.mutateAsync({
      campaignId,
      entityId: activeEntity.id,
      pin: { col, row },
    });
  }

  function cellFromEvent(e: React.PointerEvent<SVGElement>): OverworldCell | null {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    const col = Math.floor(x / OVERWORLD_CELL_PX);
    const row = Math.floor(y / OVERWORLD_CELL_PX);
    if (!cellInBounds(col, row, grid)) return null;
    return { col, row };
  }

  function onGridPointerDown(e: React.PointerEvent<SVGElement>) {
    if (mode === "view" || tool === "pan") {
      drag.current = { ox: e.clientX, oy: e.clientY, px: pan.x, py: pan.y };
      (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
      return;
    }

    if (mode !== "edit") return;
    const cell = cellFromEvent(e);
    if (!cell) return;

    if (tool === "select") {
      const owner = ownerAtCell(entities, cell.col, cell.row);
      const pin = pinAtCell(entities, cell.col, cell.row);
      const picked = pin ?? owner;
      if (picked) {
        setActiveEntityId(picked.id);
        const nextTool = toolForEntityType(picked.type);
        if (nextTool) setTool(nextTool);
      }
      return;
    }

    if (tool === "pin") {
      void placePin(cell.col, cell.row);
      return;
    }

    if (tool === "paint-region" || tool === "paint-settlement" || tool === "erase") {
      if (!activeEntity) return;
      setPainting(true);
      setPaintAdd(tool !== "erase");
      setDraftTerritory(activeEntity.overworldMap.territory ?? []);
      paintCell(cell.col, cell.row, tool !== "erase");
    }
  }

  function onGridPointerMove(e: React.PointerEvent<SVGElement>) {
    if (drag.current) {
      setPan({
        x: drag.current.px + (e.clientX - drag.current.ox),
        y: drag.current.py + (e.clientY - drag.current.oy),
      });
      return;
    }
    if (!painting || mode !== "edit") return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    paintCell(cell.col, cell.row, paintAdd);
  }

  async function onGridPointerUp() {
    if (painting && activeEntity && draftTerritory != null) {
      await persistTerritory(activeEntity.id, draftTerritory);
      setDraftTerritory(null);
    }
    drag.current = null;
    setPainting(false);
  }

  const heightClass = fill ? "h-full min-h-[12rem]" : "h-[min(60vh,32rem)]";

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${fill ? "h-full" : ""}`}>
      {mode === "edit" ? (
        <div className="flex flex-wrap items-end gap-2">
          <ToolButton active={tool === "pan"} onClick={() => setTool("pan")}>
            Pan
          </ToolButton>
          <ToolButton active={tool === "select"} onClick={() => setTool("select")}>
            Select
          </ToolButton>
          <ToolButton
            active={tool === "paint-region"}
            onClick={() => setTool("paint-region")}
          >
            Paint region
          </ToolButton>
          <ToolButton
            active={tool === "paint-settlement"}
            onClick={() => setTool("paint-settlement")}
          >
            Paint settlement
          </ToolButton>
          <ToolButton active={tool === "pin"} onClick={() => setTool("pin")}>
            Pin
          </ToolButton>
          <ToolButton active={tool === "erase"} onClick={() => setTool("erase")}>
            Erase
          </ToolButton>

          <EntityPicker
            label="Region"
            value={tool === "paint-region" ? activeEntityId : ""}
            options={regionOptions}
            onChange={(id) => {
              setActiveEntityId(id);
              setTool("paint-region");
            }}
            hidden={tool !== "paint-region" && tool !== "erase"}
          />
          <EntityPicker
            label="Settlement"
            value={tool === "paint-settlement" ? activeEntityId : ""}
            options={settlementOptions}
            onChange={(id) => {
              setActiveEntityId(id);
              setTool("paint-settlement");
            }}
            hidden={tool !== "paint-settlement"}
          />
          <EntityPicker
            label="POI"
            value={tool === "pin" ? activeEntityId : ""}
            options={pinOptions}
            onChange={(id) => {
              setActiveEntityId(id);
              setTool("pin");
            }}
            hidden={tool !== "pin"}
          />

          {activeEntity ? (
            <span className="text-xs text-lore-muted">
              Active:{" "}
              <span className="text-lore-text">{activeEntity.name}</span> (
              {REALM_TYPE_LABEL[activeEntity.type as RealmEntityType]})
            </span>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" &&
      tool === "pin" &&
      activeEntity &&
      isPinType(activeEntity.type) &&
      parentSettlement ? (
        <SettlementMapPanel
          settlement={parentSettlement}
          poi={activeEntity}
          poisInSettlement={poisInSettlement}
          onPlacePin={(col, row) => {
            void setSettlementPin.mutateAsync({
              campaignId,
              entityId: activeEntity.id,
              settlementPin: { col, row },
            });
          }}
        />
      ) : null}

      <div className="flex shrink-0 items-center justify-end gap-2 px-1">
        {isOwner ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-lore-muted">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded border-lore-border"
            />
            Show hidden
          </label>
        ) : null}
      </div>

      {entities.length === 0 ? (
        <div
          className={`flex items-center justify-center rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted ${heightClass}`}
        >
          No world locations linked yet. Add entities from the Locations tab.
        </div>
      ) : (
        <div
          ref={mapRef}
          className={`relative overflow-hidden rounded-lg border border-lore-border bg-lore-bg ${heightClass}`}
        >
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded border border-lore-border bg-lore-surface/95 px-1.5 py-1 text-xs">
            <span
              className="rounded bg-lore-bg px-1.5 py-0.5 tabular-nums text-[10px] font-medium uppercase tracking-wide text-lore-muted"
              title="Campaign overworld depth"
            >
              {mapLevelBadge(0)}
            </span>
            <button
              type="button"
              onClick={() => applyZoom(zoom - OVERWORLD_ZOOM_STEP)}
              disabled={zoom <= OVERWORLD_ZOOM_MIN}
              className="rounded px-1.5 text-lore-muted transition-colors hover:text-lore-text disabled:opacity-30"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                applyZoom(1);
                const reset = { x: 24, y: 24 };
                panRef.current = reset;
                setPan(reset);
              }}
              className="min-w-[2.75rem] rounded px-1 tabular-nums text-lore-muted transition-colors hover:text-lore-text"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => applyZoom(zoom + OVERWORLD_ZOOM_STEP)}
              disabled={zoom >= OVERWORLD_ZOOM_MAX}
              className="rounded px-1.5 text-lore-muted transition-colors hover:text-lore-text disabled:opacity-30"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <svg
            className={`h-full w-full touch-none ${
              tool === "pan" || mode === "view" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
            }`}
            onPointerDown={onGridPointerDown}
            onPointerMove={onGridPointerMove}
            onPointerUp={onGridPointerUp}
            onPointerLeave={onGridPointerUp}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {Array.from({ length: grid.height }, (_, row) =>
                Array.from({ length: grid.width }, (_, col) => (
                  <rect
                    key={cellKey(col, row)}
                    x={col * OVERWORLD_CELL_PX}
                    y={row * OVERWORLD_CELL_PX}
                    width={OVERWORLD_CELL_PX}
                    height={OVERWORLD_CELL_PX}
                    fill={
                      (col + row) % 2 === 0
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.08)"
                    }
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={0.5}
                  />
                )),
              )}

              {territoryEntities.map((entity) => {
                const color = REALM_TYPE_COLOR[entity.type as RealmEntityType];
                const fogged = !entity.discovered;
                return (entity.overworldMap.territory ?? []).map((key) => {
                  const [colRaw, rowRaw] = key.split(",");
                  const col = Number(colRaw);
                  const row = Number(rowRaw);
                  return (
                    <rect
                      key={`${entity.id}-${key}`}
                      x={col * OVERWORLD_CELL_PX + 1}
                      y={row * OVERWORLD_CELL_PX + 1}
                      width={OVERWORLD_CELL_PX - 2}
                      height={OVERWORLD_CELL_PX - 2}
                      rx={3}
                      fill={color}
                      fillOpacity={fogged && isOwner && showHidden ? 0.15 : 0.35}
                      stroke={entity.id === activeEntityId ? color : "transparent"}
                      strokeWidth={2}
                      className={fogged ? "opacity-60" : undefined}
                    />
                  );
                });
              })}

              {pinEntities.map((entity) => {
                const pin = entity.overworldMap.pin!;
                const type = entity.type as RealmEntityType;
                const fogged = !entity.discovered;
                const cx = pin.col * OVERWORLD_CELL_PX + OVERWORLD_CELL_PX / 2;
                const cy = pin.row * OVERWORLD_CELL_PX + OVERWORLD_CELL_PX / 2;
                const label =
                  fogged && !(isOwner && showHidden) ? "?" : entity.name;
                const interactive = onEnterLocation && entity.discovered;

                const pinNode = (
                  <g
                    key={entity.id}
                    transform={`translate(${cx} ${cy})`}
                    className={interactive ? "cursor-pointer" : undefined}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (interactive) onEnterLocation(entity.id);
                      if (mode === "edit") {
                        setActiveEntityId(entity.id);
                        setTool("pin");
                      }
                    }}
                  >
                    <circle
                      r={9}
                      fill={REALM_TYPE_COLOR[type]}
                      fillOpacity={fogged ? 0.45 : 0.9}
                      stroke={entity.id === activeEntityId ? "#fff" : "rgba(0,0,0,0.35)"}
                      strokeWidth={1.5}
                    />
                    <text
                      y={-14}
                      textAnchor="middle"
                      className="fill-lore-text text-[10px] font-medium"
                    >
                      {label}
                    </text>
                  </g>
                );

                if (interactive) return pinNode;
                return pinNode;
              })}
            </g>
          </svg>
          <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-lore-bg/80 px-2 py-1 text-[10px] text-lore-muted">
            {grid.width}×{grid.height} grid · scroll to zoom
          </div>
        </div>
      )}
    </div>
  );
}

type OverworldCell = { col: number; row: number };

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}

function EntityPicker({
  label,
  value,
  options,
  onChange,
  hidden,
}: {
  label: string;
  value: string;
  options: OverworldEntity[];
  onChange: (id: string) => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs outline-none focus:border-lore-accent"
    >
      <option value="">{label}…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

export function OverworldMapShell({
  campaignId,
  mode,
  fill,
  isOwner,
  onEnterLocation,
}: {
  campaignId: string;
  mode: "edit" | "view";
  fill?: boolean;
  isOwner?: boolean;
  onEnterLocation?: (entityId: string) => void;
}) {
  const map = trpc.campaigns.overworldMap.useQuery({ campaignId });

  if (map.isLoading) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-lore-muted">
        Loading world map…
      </p>
    );
  }

  if (!map.data) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-lore-muted">
        Could not load overworld map.
      </p>
    );
  }

  return (
    <OverworldGrid
      campaignId={campaignId}
      grid={map.data.grid}
      entities={map.data.entities}
      parentSettlementByEntity={map.data.parentSettlementByEntity}
      mode={mode}
      fill={fill}
      isOwner={isOwner}
      onEnterLocation={onEnterLocation}
    />
  );
}
