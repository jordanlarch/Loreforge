"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  type RealmEntityType,
} from "@/lib/realms";
import { trpc } from "@/lib/trpc/client";

type WorldMapCanvasProps = {
  campaignId: string;
  /** Fill parent height (play shell map zone). */
  fill?: boolean;
  /** Campaign owner can peek hidden stubs (Grill #9). */
  isOwner?: boolean;
  /** In play: travel to a location instead of opening Realms. */
  onEnterLocation?: (entityId: string) => void;
};

/**
 * Embeddable strategic world map (CAMP-7 / CAMP-UX UX-1). Used in prep World
 * Map tab and the play shell **World** map tab.
 */
export function WorldMapCanvas({
  campaignId,
  fill = false,
  isOwner = true,
  onEnterLocation,
}: WorldMapCanvasProps) {
  const world = trpc.campaigns.world.useQuery({ campaignId });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showHidden, setShowHidden] = useState(false);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(
    null,
  );

  const nodes = useMemo(() => {
    const members = world.data ?? [];
    const cols = Math.max(3, Math.ceil(Math.sqrt(members.length || 1)));
    return members.map((m, i) => ({
      ...m,
      x: (i % cols) * 140 + 40,
      y: Math.floor(i / cols) * 100 + 40,
    }));
  }, [world.data]);

  const visibleNodes = useMemo(() => {
    if (isOwner && showHidden) return nodes;
    return nodes.filter((n) => n.discovered);
  }, [nodes, isOwner, showHidden]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { ox: e.clientX, oy: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.ox),
      y: drag.current.py + (e.clientY - drag.current.oy),
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  if (world.isLoading) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-lore-muted">
        Loading world map…
      </p>
    );
  }

  const heightClass = fill
    ? "h-full min-h-[12rem]"
    : "h-[min(60vh,32rem)]";

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${fill ? "h-full" : ""}`}>
      {isOwner ? (
        <div className="flex shrink-0 items-center justify-end gap-2 px-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-lore-muted">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded border-lore-border"
            />
            Show hidden
          </label>
        </div>
      ) : null}

      {visibleNodes.length === 0 ? (
        <div
          className={`flex items-center justify-center rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted ${heightClass}`}
        >
          {nodes.length === 0
            ? "No world locations linked yet."
            : "No discovered locations yet — explore to reveal the map."}
        </div>
      ) : (
        <div
          className={`relative cursor-grab overflow-hidden rounded-lg border border-lore-border bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-lore-accent-dim/20 to-lore-bg active:cursor-grabbing ${heightClass}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {visibleNodes.map((node) => {
              const type = node.type as RealmEntityType;
              const fogged = !node.discovered;
              const inner = (
                <>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: REALM_TYPE_COLOR[type] }}
                  />
                  <span className="font-medium leading-tight text-lore-text">
                    {fogged && isOwner && showHidden
                      ? node.name
                      : fogged
                        ? "Unknown site"
                        : node.name}
                  </span>
                  <span className="text-[10px] text-lore-muted">
                    {REALM_TYPE_LABEL[type]}
                  </span>
                </>
              );
              const className = `absolute flex w-28 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-xs transition-opacity ${
                fogged
                  ? "border-lore-border/60 bg-lore-bg/80 opacity-60 grayscale"
                  : "border-lore-border bg-lore-bg hover:border-lore-accent"
              }`;
              const style = { left: node.x, top: node.y };

              if (onEnterLocation && node.discovered) {
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={className}
                    style={style}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterLocation(node.id);
                    }}
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <Link
                  key={node.id}
                  href={`/realms/${node.id}`}
                  className={className}
                  style={style}
                  onClick={(e) => e.stopPropagation()}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
