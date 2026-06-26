"use client";

/**
 * Map viewport (PLAY-7, #102) — wraps the tactical {@link BattleMap} with the
 * map-zone chrome: a scene transition banner (#103), a zoom control (CSS scale,
 * so PixiJS hit-testing stays correct), middle-mouse drag pan, and wheel zoom.
 * Layer toggles cover the grid and movement-radius overlay.
 *
 * Hierarchical L1–L2 parent-map scroll-out, fog of war, Edit Map authoring,
 * token context menus, and text-driven movement are deferred follow-ups
 * (see docs/deferrals.md PLAY-7). UX-7 adds L-level badges and a
 * "Return to scene" pill when manual zoom diverges from 100%.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { CELL_SIZE } from "@/lib/battle-map/geometry";
import {
  mapLevelBadge,
  type MapZoomLevel,
} from "@/lib/map-zoom-level";
import {
  clampZoom,
  scrollForZoom,
  TACTICAL_ZOOM_MAX,
  TACTICAL_ZOOM_MIN,
  TACTICAL_ZOOM_STEP,
} from "@/lib/map-viewport-zoom";

import type { BattleMapProps } from "./battle-map";
import { SceneBanner } from "./scene-banner";
import { TacticalGridOverlay } from "./tactical-grid-overlay";
import type { SceneBannerInfo } from "./use-scene-transition";

const BattleMap = dynamic(() => import("./battle-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-[528px] items-center justify-center rounded-lg border border-lore-border bg-lore-bg text-sm text-lore-muted">
      Loading map…
    </div>
  ),
});

export function MapViewport({
  sceneBanner,
  transitioning,
  reachable,
  fill = false,
  mapLevel,
  sceneName,
  ...mapProps
}: BattleMapProps & {
  sceneBanner: SceneBannerInfo | null;
  transitioning: boolean;
  /** Expand to fill the play-surface map column (wheel zoom stays contained). */
  fill?: boolean;
  /** Native scene depth for the level badge (L3 exploration / L4 combat). */
  mapLevel?: MapZoomLevel;
  sceneName?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showReach, setShowReach] = useState(true);
  const [panning, setPanning] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null,
  );

  const baseW = mapProps.cols * CELL_SIZE;
  const baseH = mapProps.rows * CELL_SIZE;

  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const el = scrollRef.current;
      setZoom((prev) => {
        const clamped = clampZoom(next, TACTICAL_ZOOM_MIN, TACTICAL_ZOOM_MAX);
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
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -TACTICAL_ZOOM_STEP : TACTICAL_ZOOM_STEP;
      applyZoom(
        clampZoom(
          zoomRef.current + delta,
          TACTICAL_ZOOM_MIN,
          TACTICAL_ZOOM_MAX,
        ),
        { clientX: e.clientX, clientY: e.clientY },
      );
    },
    [applyZoom],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

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
    <div
      className={
        fill
          ? "relative flex min-h-0 min-w-0 flex-1 flex-col"
          : "relative inline-block"
      }
    >
      <SceneBanner banner={sceneBanner} />

      {zoom !== 1 && sceneName && mapLevel != null ? (
        <button
          type="button"
          onClick={() => applyZoom(1)}
          className="absolute left-2 top-2 z-10 max-w-[min(100%,18rem)] truncate rounded-full border border-lore-accent/40 bg-lore-accent-dim/95 px-3 py-1 text-xs text-lore-text shadow-sm transition-colors hover:border-lore-accent"
          title={`Reset zoom to ${sceneName}`}
        >
          Return to {sceneName} ({mapLevelBadge(mapLevel)})
        </button>
      ) : null}

      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1 rounded border border-lore-border bg-lore-surface/95 px-1.5 py-1 text-xs">
          {mapLevel != null ? (
            <span
              className="rounded bg-lore-bg px-1.5 py-0.5 tabular-nums text-[10px] font-medium uppercase tracking-wide text-lore-muted"
              title="Current map depth"
            >
              {mapLevelBadge(mapLevel)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => applyZoom(zoom - TACTICAL_ZOOM_STEP)}
            disabled={zoom <= TACTICAL_ZOOM_MIN}
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
            onClick={() => applyZoom(zoom + TACTICAL_ZOOM_STEP)}
            disabled={zoom >= TACTICAL_ZOOM_MAX}
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
        onMouseDown={onMouseDown}
        onAuxClick={(e) => e.button === 1 && e.preventDefault()}
        className={`overflow-auto overscroll-contain rounded-lg border border-lore-border bg-lore-bg ${
          fill
            ? "flex min-h-0 flex-1 items-center justify-center"
            : "max-h-[560px] max-w-full"
        } ${panning ? "cursor-grabbing select-none" : "cursor-default"}`}
        title="Scroll to zoom · middle-mouse drag to pan"
      >
        <div
          className={fill ? "flex min-h-full min-w-full items-center justify-center p-1" : undefined}
        >
          <div style={{ width: baseW * zoom, height: baseH * zoom, flexShrink: 0 }}>
            <div
              className={`relative transition-opacity duration-700 ${
                transitioning ? "opacity-40" : "opacity-100"
              }`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                paddingTop: 18,
                paddingLeft: 18,
              }}
            >
              <TacticalGridOverlay cols={mapProps.cols} rows={mapProps.rows} />
              <BattleMap
                {...mapProps}
                reachable={showReach ? reachable : []}
                showGrid={showGrid}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
