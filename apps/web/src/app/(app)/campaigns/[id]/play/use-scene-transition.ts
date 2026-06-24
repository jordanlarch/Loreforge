"use client";

/**
 * Scene transition detection for the Live Play surface (PLAY-8, #103).
 *
 * Watches the synced scene id and, when the AI/engine advances to a new scene,
 * fires a short cross-fade + a drop-in location banner + a client-side chat
 * divider. Combat start/end edges also emit dividers. The initial scene load
 * is not animated. AI auto-forging of destination stubs on travel is deferred
 * to the generation pipeline.
 */
import { useEffect, useRef, useState } from "react";

import type { ChatEntry } from "@/lib/live-chat";
import {
  formatSceneDividerLabel,
  isCombatEnd,
  isCombatStart,
  makeSceneDividerEntry,
  sceneSubtitle,
} from "@/lib/scene-transition-chat";

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
  /** Client-only chat dividers to merge into the narrative log. */
  dividers: ChatEntry[];
};

const FADE_MS = 700;
const BANNER_MS = 3200;

export function useSceneTransition(
  sceneId: string | undefined,
  sceneName: string | undefined,
  sceneDescription?: string | null,
): SceneTransition {
  const prev = useRef<string | undefined>(sceneId);
  const [banner, setBanner] = useState<SceneBannerInfo | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [dividers, setDividers] = useState<ChatEntry[]>([]);

  const subtitle = sceneSubtitle(sceneDescription);

  useEffect(() => {
    const changed = isSceneChange(prev.current, sceneId);
    prev.current = sceneId;
    if (!changed || !sceneId) return;

    const name = sceneName ?? "New location";
    setTransitioning(true);
    setBanner({ name, subtitle });
    setDividers((prevDividers) => [
      ...prevDividers,
      makeSceneDividerEntry(sceneId, formatSceneDividerLabel(name, subtitle)),
    ]);
    const fade = setTimeout(() => setTransitioning(false), FADE_MS);
    const clear = setTimeout(() => setBanner(null), BANNER_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(clear);
    };
  }, [sceneId, sceneName, subtitle]);

  return { banner, transitioning, dividers };
}

/** Emit chat dividers when combat starts or ends (PLAY-8 design pass). */
export function useCombatTransition(inCombat: boolean): ChatEntry[] {
  const prev = useRef(inCombat);
  const [dividers, setDividers] = useState<ChatEntry[]>([]);

  useEffect(() => {
    const was = prev.current;
    prev.current = inCombat;
    if (isCombatStart(was, inCombat)) {
      setDividers((d) => [
        ...d,
        makeSceneDividerEntry("combat-start", "⚔ Combat begins"),
      ]);
    } else if (isCombatEnd(was, inCombat)) {
      setDividers((d) => [
        ...d,
        makeSceneDividerEntry("combat-end", "⚔ Combat ended"),
      ]);
    }
  }, [inCombat]);

  return dividers;
}
