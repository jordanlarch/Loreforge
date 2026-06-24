"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  type RealmEntityType,
} from "@/lib/realms";
import { trpc } from "@/lib/trpc/client";

/**
 * World Map tab (CAMP-7 tracer): a pannable strategic canvas of campaign world
 * entities. Discovered sites render in full color; undiscovered ones stay
 * fogged. Edit mode, layers, and party-token sync are deferred.
 */
export function WorldMapTab({ campaignId }: { campaignId: string }) {
  const world = trpc.campaigns.world.useQuery({ campaignId });
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
    return <p className="text-sm text-lore-muted">Loading world map…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">World Map</h2>
          <p className="mt-1 text-sm text-lore-muted">
            Strategic view of campaign locations. Drag to pan.
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}?tab=world`}
          className="text-sm text-lore-accent underline"
        >
          Manage in World tab →
        </Link>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-12 text-center text-sm text-lore-muted">
          No world entities yet. Add regions and settlements from the World tab.
        </div>
      ) : (
        <div
          className="relative h-[min(60vh,32rem)] cursor-grab overflow-hidden rounded-lg border border-lore-border bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-lore-accent-dim/20 to-lore-bg active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {nodes.map((node) => {
              const type = node.type as RealmEntityType;
              const fogged = !node.discovered;
              return (
                <Link
                  key={node.id}
                  href={`/realms/${node.id}`}
                  className={`absolute flex w-28 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-xs transition-opacity ${
                    fogged
                      ? "border-lore-border/60 bg-lore-bg/80 opacity-50 grayscale"
                      : "border-lore-border bg-lore-bg hover:border-lore-accent"
                  }`}
                  style={{ left: node.x, top: node.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: REALM_TYPE_COLOR[type] }}
                  />
                  <span className="font-medium leading-tight text-lore-text">
                    {fogged ? "Unknown site" : node.name}
                  </span>
                  <span className="text-[10px] text-lore-muted">
                    {REALM_TYPE_LABEL[type]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
