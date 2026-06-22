"use client";

/**
 * Map viewport (PLAY-7, #102) — wraps the tactical {@link BattleMap} with the
 * map-zone chrome: a scene transition banner (#103), a zoom control (CSS scale,
 * so PixiJS hit-testing stays correct), and a layers panel toggling the grid and
 * the movement-radius overlay.
 *
 * Hierarchical L0–L4 zoom (world/region/settlement maps), fog of war, Edit Map
 * authoring, token context menus, and text-driven movement are deferred
 * follow-ups (see docs/deferrals.md PLAY-7).
 */
import dynamic from "next/dynamic";
import { useState } from "react";

import { CELL_SIZE } from "../../../../../lib/battle-map/geometry";

import type { BattleMapProps } from "./battle-map";
import { SceneBanner } from "./scene-banner";
import type { SceneBannerInfo } from "./use-scene-transition";

const BattleMap = dynamic(() => import("./battle-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-[528px] items-center justify-center rounded-lg border border-lore-border bg-lore-bg text-sm text-lore-muted">
      Loading map…
    </div>
  ),
});

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

/** Clamp + round a zoom factor to avoid floating-point drift across steps. */
export function clampZoom(z: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
}

export function MapViewport({
  sceneBanner,
  transitioning,
  reachable,
  ...mapProps
}: BattleMapProps & {
  sceneBanner: SceneBannerInfo | null;
  transitioning: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showReach, setShowReach] = useState(true);

  const baseW = mapProps.cols * CELL_SIZE;
  const baseH = mapProps.rows * CELL_SIZE;

  return (
    <div className="relative inline-block">
      <SceneBanner banner={sceneBanner} />

      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1 rounded border border-lore-border bg-lore-surface/95 px-1.5 py-1 text-xs">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            className="rounded px-1.5 text-lore-muted transition-colors hover:text-lore-text disabled:opacity-30"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-[2.75rem] rounded px-1 tabular-nums text-lore-muted transition-colors hover:text-lore-text"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            className="rounded px-1.5 text-lore-muted transition-colors hover:text-lore-text disabled:opacity-30"
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="flex flex-col gap-1 rounded border border-lore-border bg-lore-surface/95 px-2 py-1.5 text-xs text-lore-muted">
          <span className="text-[10px] uppercase tracking-widest">Layers</span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="accent-lore-accent"
            />
            Grid
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showReach}
              onChange={(e) => setShowReach(e.target.checked)}
              className="accent-lore-accent"
            />
            Movement
          </label>
        </div>
      </div>

      <div className="max-h-[560px] max-w-full overflow-auto rounded-lg border border-lore-border bg-lore-bg">
        <div style={{ width: baseW * zoom, height: baseH * zoom }}>
          <div
            className={`transition-opacity duration-700 ${
              transitioning ? "opacity-40" : "opacity-100"
            }`}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            <BattleMap
              {...mapProps}
              reachable={showReach ? reachable : []}
              showGrid={showGrid}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
