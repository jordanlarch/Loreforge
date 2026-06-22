"use client";

/**
 * Live Play pacing controls (PLAY-9 remainder, #104).
 *
 * Pure helpers + small hooks behind the top bar's 🎚 Pacing panel: a persisted
 * per-campaign pacing style + a soft combat **round timer** that tracks how long
 * the current turn has run. Ready ("hold an action") already ships via the engine
 * `ready_action` path; initiative *delay* (re-slotting yourself later in the
 * order) needs engine support and stays deferred, as does wiring the pacing
 * style into the AI orchestrator's narration density.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const PACING_STYLES = ["cinematic", "balanced", "reactive"] as const;
export type PacingStyle = (typeof PACING_STYLES)[number];

/** Soft per-turn time limits offered in the panel; 0 = off. */
export const TURN_LIMIT_OPTIONS = [0, 30, 60, 90] as const;

export type PacingPrefs = { style: PacingStyle; turnLimitSec: number };

export const DEFAULT_PACING: PacingPrefs = { style: "balanced", turnLimitSec: 0 };

/** Per-campaign localStorage key (sandbox shares one bucket). */
export function pacingStorageKey(campaignId: string | undefined): string {
  return `loreforge:pacing:${campaignId ?? "sandbox"}`;
}

/** Parse stored prefs defensively, falling back to defaults on any bad field. */
export function parsePacingPrefs(raw: string | null): PacingPrefs {
  if (!raw) return DEFAULT_PACING;
  try {
    const v = JSON.parse(raw) as Partial<PacingPrefs>;
    const style = PACING_STYLES.includes(v.style as PacingStyle)
      ? (v.style as PacingStyle)
      : DEFAULT_PACING.style;
    const turnLimitSec = (
      TURN_LIMIT_OPTIONS as readonly number[]
    ).includes(v.turnLimitSec as number)
      ? (v.turnLimitSec as number)
      : DEFAULT_PACING.turnLimitSec;
    return { style, turnLimitSec };
  } catch {
    return DEFAULT_PACING;
  }
}

/** Timer urgency for coloring: ok < 75% of limit, warn ≥ 75%, over ≥ limit. */
export function turnTimerTone(
  elapsedSec: number,
  limitSec: number,
): "ok" | "warn" | "over" {
  if (limitSec <= 0) return "ok";
  if (elapsedSec >= limitSec) return "over";
  if (elapsedSec >= limitSec * 0.75) return "warn";
  return "ok";
}

/** Persisted pacing prefs for a campaign, with a localStorage-backed updater. */
export function usePacingPrefs(campaignId: string | undefined): {
  prefs: PacingPrefs;
  update: (patch: Partial<PacingPrefs>) => void;
} {
  const key = pacingStorageKey(campaignId);
  const [prefs, setPrefs] = useState<PacingPrefs>(DEFAULT_PACING);

  useEffect(() => {
    setPrefs(parsePacingPrefs(localStorage.getItem(key)));
  }, [key]);

  const update = useCallback(
    (patch: Partial<PacingPrefs>) => {
      setPrefs((p) => {
        const next = { ...p, ...patch };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // storage unavailable (private mode); keep the in-memory value
        }
        return next;
      });
    },
    [key],
  );

  return { prefs, update };
}

/**
 * Seconds elapsed on the current turn. Resets whenever `turnKey` changes (a new
 * combatant's turn) and pauses while `paused` is set.
 */
export function useTurnTimer(
  turnKey: string | undefined,
  paused: boolean,
): number {
  const [elapsed, setElapsed] = useState(0);
  const last = useRef<number>(Date.now());

  useEffect(() => {
    setElapsed(0);
    last.current = Date.now();
  }, [turnKey]);

  useEffect(() => {
    if (paused || turnKey === undefined) return;
    last.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed((e) => e + (now - last.current) / 1000);
      last.current = now;
    }, 1000);
    return () => clearInterval(timer);
  }, [turnKey, paused]);

  return elapsed;
}
