"use client";

/**
 * Map viewport (PLAY-7, #102) — wraps the tactical {@link BattleMap} with the
 * map-zone chrome: a scene transition banner (#103), a zoom control (CSS scale,
 * so PixiJS hit-testing stays correct), middle-mouse drag pan, and wheel zoom.
 * Layer toggles cover the grid and movement-radius overlay.
 *
 * Hierarchical L0–L4 zoom (world/region/settlement maps), fog of war, Edit Map
 * authoring, token context menus, and text-driven movement are deferred
 * follow-ups (see docs/deferrals.md PLAY-7).
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { CELL_SIZE } from "@/lib/battle-map/geometry";

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

/** Keep the content point under the cursor fixed when zoom changes. */
export function scrollForZoom(params: {
  scrollLeft: number;
  scrollTop: number;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number };
  oldZoom: number;
  newZoom: number;
}): { scrollLeft: number; scrollTop: number } {
  const { scrollLeft, scrollTop, clientX, clientY, rect, oldZoom, newZoom } =
    params;
  if (oldZoom === newZoom) return { scrollLeft, scrollTop };

  const offsetX = clientX - rect.left + scrollLeft;
  const offsetY = clientY - rect.top + scrollTop;
  const ratio = newZoom / oldZoom;
  return {
    scrollLeft: offsetX * ratio - (clientX - rect.left),
    scrollTop: offsetY * ratio - (clientY - rect.top),
  };
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
  const [panning, setPanning] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null,
  );

  const baseW = mapProps.cols * CELL_SIZE;
  const baseH = mapProps.rows * CELL_SIZE;

  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const el = scrollRef.current;
      setZoom((prev) => {
        const clamped = clampZoom(next);
        if (clamped === prev) return prev;
        if (el && anchor) {
          const rect = el.getBoundingClientRect();
          const scroll = scrollForZoom({
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop,
            clientX: anchor.clientX,
            clientY: anchor.clientY,
            rect,
            oldZoom: prev,
            newZoom: clamped,
          });
          requestAnimationFrame(() => {
            el.scrollLeft = scroll.scrollLeft;
            el.scrollTop = scroll.scrollTop;
          });
        }
        return clamped;
      });
    },
    [],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      applyZoom(
        clampZoom(zoom + delta),
        { clientX: e.clientX, clientY: e.clientY },
      );
    },
    [applyZoom, zoom],
  );

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setPanning(true);
  }, []);

  useEffect(() => {
    if (!panning) return;

    function onMove(ev: MouseEvent) {
      const pan = panRef.current;
      const el = scrollRef.current;
      if (!pan || !el) return;
      el.scrollLeft = pan.scrollLeft - (ev.clientX - pan.x);
      el.scrollTop = pan.scrollTop - (ev.clientY - pan.y);
    }

    function onUp(ev: MouseEvent) {
      if (ev.button === 1) {
        panRef.current = null;
        setPanning(false);
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panning]);

  return (
    <div className="relative inline-block">
      <SceneBanner banner={sceneBanner} />

      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1 rounded border border-lore-border bg-lore-surface/95 px-1.5 py-1 text-xs">
          <button
            type="button"
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            className="rounded px-1.5 text-lore-muted transition-colors hover:text-lore-text disabled:opacity-30"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => applyZoom(1)}
            className="min-w-[2.75rem] rounded px-1 tabular-nums text-lore-muted transition-colors hover:text-lore-text"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
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

      <div
        ref={scrollRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onAuxClick={(e) => e.button === 1 && e.preventDefault()}
        className={`max-h-[560px] max-w-full overflow-auto rounded-lg border border-lore-border bg-lore-bg ${
          panning ? "cursor-grabbing select-none" : "cursor-default"
        }`}
        title="Scroll to zoom · middle-mouse drag to pan"
      >
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
