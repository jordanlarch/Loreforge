"use client";

/**
 * Scene transition detection for the Live Play surface (PLAY-8, #103).
 *
 * Watches the synced scene id and, when the AI/engine advances to a new scene,
 * fires a short cross-fade + a drop-in location banner. The initial scene load
 * is not animated. AI auto-forging of destination stubs on travel is a deferred
 * follow-up handled by the generation pipeline, not this view hook.
 */
import { useEffect, useRef, useState } from "react";

/** A real scene change: both ids known and different (ignores initial load). */
export function isSceneChange(
  prev: string | undefined,
  next: string | undefined,
): boolean {
  return next !== undefined && prev !== undefined && prev !== next;
}

export type SceneBannerInfo = { name: string; subtitle?: string };

export type SceneTransition = {
  /** The banner to show, or null when no transition is in flight. */
  banner: SceneBannerInfo | null;
  /** True during the brief cross-fade window (drives map opacity). */
  transitioning: boolean;
};

const FADE_MS = 700;
const BANNER_MS = 3200;

export function useSceneTransition(
  sceneId: string | undefined,
  sceneName: string | undefined,
  subtitle?: string,
): SceneTransition {
  const prev = useRef<string | undefined>(sceneId);
  const [banner, setBanner] = useState<SceneBannerInfo | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const changed = isSceneChange(prev.current, sceneId);
    prev.current = sceneId;
    if (!changed) return;

    setTransitioning(true);
    setBanner({ name: sceneName ?? "New location", subtitle });
    const fade = setTimeout(() => setTransitioning(false), FADE_MS);
    const clear = setTimeout(() => setBanner(null), BANNER_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(clear);
    };
  }, [sceneId, sceneName, subtitle]);

  return { banner, transitioning };
}
