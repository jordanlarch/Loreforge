"use client";

/**
 * Live Play top bar (PLAY-5, #101) — the ① zone of the play surface. Carries the
 * breadcrumb back to the workspace, the campaign + current-scene label, the
 * Live/Async presence chip, a scene breadcrumb (location · round · turn ·
 * movement), a live-ticking real-time session clock with a Pause toggle, the
 * turn actions (End turn lives in the combat turn bar during encounters),
 *
 * Driven by props the play surface derives from the synced `WorldState`. The
 * in-game clock, server-side pause *freeze*, named connection roster, and the
 * TTS/Memory/Inventory tool panels are deferred follow-ups (see
 * docs/deferrals.md PLAY-5 / PLAY-10 and the P5 memory tier).
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { turnTimerTone, type PacingPrefs } from "@/lib/live-pacing";

import { PacingControls } from "./pacing-controls";

/** Format a duration in seconds as `m:ss` (or `h:mm:ss` past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** A monotonic, pausable real-time session clock (seconds elapsed while live). */
function useSessionClock(paused: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const last = useRef<number>(Date.now());

  useEffect(() => {
    last.current = Date.now();
    if (paused) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed((e) => e + (now - last.current) / 1000);
      last.current = now;
    }, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  return elapsed;
}

/** The still-placeholder tools (Pacing is now real, handled separately). */
const PLACEHOLDER_TOOLS: { key: string; label: string; note: string }[] = [
  { key: "tts", label: "🔊 TTS", note: "Text-to-speech — coming in a later slice." },
  { key: "memory", label: "🧠 Memory", note: "AI memory panel — coming in a later slice." },
  { key: "inventory", label: "📋 Inventory", note: "Party inventory drawer — coming in a later slice." },
];

export type PacingBundle = {
  prefs: PacingPrefs;
  onUpdate: (patch: Partial<PacingPrefs>) => void;
  holding: boolean;
  onToggleHold: () => void;
  onContinue: () => void;
  onSkip: (duration: string) => void;
  /** Seconds elapsed on the current combat turn, when in combat. */
  turnElapsedSec?: number;
  /** Disable Continue/Skip (e.g. while a command is in flight or paused). */
  disabled: boolean;
};

export function LivePlayTopBar({
  title,
  sceneName,
  sceneEnvironmentalEffects,
  sceneFearStressEffects,
  peers,
  round,
  activeName,
  movementLeft,
  movementTotal,
  backHref,
  paused,
  onTogglePause,
  isBusy,
  showTurnActions,
  onEndTurn,
  onReset,
  onEndSession,
  endingSession,
  rejected,
  pacing,
}: {
  title: string;
  sceneName?: string;
  /** Ambient environmental effect labels for the current scene (Q5). */
  sceneEnvironmentalEffects?: string[];
  /** Scene-attached fear/stress labels (GRILL-LIVE-FEAR Q5). */
  sceneFearStressEffects?: string[];
  peers: number;
  round?: number;
  activeName?: string;
  movementLeft?: number;
  movementTotal?: number;
  backHref?: string;
  paused: boolean;
  onTogglePause: () => void;
  isBusy: boolean;
  showTurnActions: boolean;
  onEndTurn: () => void;
  onReset: () => void;
  /** End the play session: record it + generate a recap, then leave (PLAY-12).
   * Absent for the sandbox (no campaign to record against). */
  onEndSession?: () => void;
  /** Whether the end-session request is in flight. */
  endingSession?: boolean;
  rejected: boolean;
  pacing?: PacingBundle;
}) {
  const elapsed = useSessionClock(paused);
  const live = peers >= 2;
  const [pacingOpen, setPacingOpen] = useState(false);

  const showTurnTimer =
    pacing !== undefined &&
    pacing.prefs.turnLimitSec > 0 &&
    pacing.turnElapsedSec !== undefined;
  const turnTone = showTurnTimer
    ? turnTimerTone(pacing.turnElapsedSec ?? 0, pacing.prefs.turnLimitSec)
    : "ok";

  return (
    <header className="mb-4 rounded-lg border border-lore-border bg-lore-surface">
      {/* Row 1: breadcrumb · title · presence */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lore-border px-3 py-2">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="text-sm text-lore-muted transition-colors hover:text-lore-text"
              title="Back to campaign prep (session keeps running)"
            >
              ← Prep
            </Link>
          )}
          <h1 className="font-display text-xl leading-tight">{title}</h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            live
              ? "border-lore-accent bg-lore-accent-dim text-lore-accent"
              : "border-lore-border text-lore-muted"
          }`}
          title="Connected clients in this live session"
        >
          {live ? `⚡ Live · ${peers} connected` : "◐ Async · You only"}
        </span>
      </div>

      {/* Row 2: scene breadcrumb · clock · turn actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-lore-muted">
          <span className="text-lore-text">📍 {sceneName ?? "Unknown location"}</span>
          {sceneEnvironmentalEffects?.map((label) => (
            <span
              key={label}
              className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200"
            >
              {label}
            </span>
          ))}
          {sceneFearStressEffects?.map((label) => (
            <span
              key={label}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200"
            >
              {label}
            </span>
          ))}
          {round !== undefined && (
            <span className="rounded bg-lore-accent-dim px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-lore-accent">
              Round {round}
            </span>
          )}
          {activeName && <span>{activeName}&apos;s turn</span>}
          {movementLeft !== undefined && movementTotal !== undefined && (
            <span>
              {movementLeft}/{movementTotal} ft
            </span>
          )}
          {showTurnTimer && pacing && (
            <span
              className={`rounded px-2 py-0.5 text-xs tabular-nums ${
                turnTone === "over"
                  ? "bg-lore-accent-dim text-lore-accent"
                  : turnTone === "warn"
                    ? "text-lore-accent"
                    : "text-lore-muted"
              }`}
              title="Soft round timer (this turn)"
            >
              ⏳ {formatDuration(pacing.turnElapsedSec ?? 0)} /{" "}
              {formatDuration(pacing.prefs.turnLimitSec)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rejected && (
            <span className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs text-lore-muted">
              Illegal move — out of range, blocked, or occupied.
            </span>
          )}
          <span
            className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs tabular-nums text-lore-muted"
            title="Real-time session duration"
          >
            ⏱ {formatDuration(elapsed)}
          </span>
          <button
            type="button"
            onClick={onTogglePause}
            className={`rounded border px-3 py-1.5 text-sm transition-colors ${
              paused
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border hover:border-lore-accent"
            }`}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          {showTurnActions && (
            <button
              type="button"
              onClick={onEndTurn}
              disabled={isBusy || paused}
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
            >
              End turn
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy}
            className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Reset
          </button>
          {onEndSession && (
            <button
              type="button"
              onClick={onEndSession}
              disabled={endingSession}
              title="Record this session and generate a recap, then return to the workspace"
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-40"
            >
              {endingSession ? "Ending…" : "End session"}
            </button>
          )}
        </div>
      </div>

      {/* Row 3: tools — Pacing is live; the rest are placeholders. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-lore-border px-3 py-2">
        <span className="mr-1 text-[10px] uppercase tracking-widest text-lore-muted">
          Tools
        </span>
        {pacing ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPacingOpen((o) => !o)}
              className={`rounded border px-2 py-1 text-xs transition-colors ${
                pacingOpen || pacing.holding
                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                  : "border-lore-border text-lore-muted hover:text-lore-text"
              }`}
            >
              🎚 Pacing{pacing.holding ? " · Hold" : ""}
            </button>
            {pacingOpen && (
              <PacingControls
                prefs={pacing.prefs}
                onUpdate={pacing.onUpdate}
                holding={pacing.holding}
                onToggleHold={pacing.onToggleHold}
                onContinue={pacing.onContinue}
                onSkip={pacing.onSkip}
                disabled={pacing.disabled}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled
            title="Pacing controls — coming in a later slice."
            className="cursor-not-allowed rounded border border-lore-border px-2 py-1 text-xs text-lore-muted opacity-60"
          >
            🎚 Pacing
          </button>
        )}
        {PLACEHOLDER_TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            disabled
            title={tool.note}
            className="cursor-not-allowed rounded border border-lore-border px-2 py-1 text-xs text-lore-muted opacity-60"
          >
            {tool.label}
          </button>
        ))}
      </div>
    </header>
  );
}
