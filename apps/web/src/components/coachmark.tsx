"use client";

/**
 * Anchored coachmark / first-time-tooltip primitive (TUT-1, D5).
 *
 * `CoachmarkHost` renders at most one coachmark at a time, pointing at a real UI
 * element marked with `data-coachmark="<anchor>"`. It dims the page with a
 * spotlight cut-out around the target, shows a screen-reader-friendly popover
 * (`role="dialog"` + `aria-describedby`), and persists dismissal once-per-user
 * via `tutorial.markSeen` so a tooltip never re-fires. Sequencing + trigger
 * evaluation are the pure helpers in `@/lib/coachmark`.
 *
 * Shared infra: any surface can drop a `<CoachmarkHost defs={…} />` and tag its
 * anchors; the tutorial is just the first consumer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  mergeSeen,
  readyTriggerIds,
  remainingCount,
  selectActiveCoachmark,
  type CoachmarkDef,
} from "@/lib/coachmark";
import { trpc } from "@/lib/trpc/client";

type Rect = { top: number; left: number; width: number; height: number };

const POPOVER_WIDTH = 320;
const GAP = 10;

function selector(anchor: string): string {
  return `[data-coachmark="${CSS.escape(anchor)}"]`;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function CoachmarkHost({
  defs,
  firedActions,
  enabled = true,
}: {
  defs: readonly CoachmarkDef[];
  /** Action names that have fired (drives `on_action` triggers). */
  firedActions?: readonly string[];
  /** Gate the whole host (e.g. only inside the tutorial). */
  enabled?: boolean;
}) {
  const seenQuery = trpc.tutorial.seenFeatures.useQuery(undefined, { enabled });
  const utils = trpc.useUtils();
  const markSeen = trpc.tutorial.markSeen.useMutation();

  const [localSeen, setLocalSeen] = useState<string[]>([]);
  const [anchorsPresent, setAnchorsPresent] = useState<Set<string>>(new Set());
  const [elapsedDelayIds, setElapsedDelayIds] = useState<Set<string>>(
    new Set(),
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const sentRef = useRef<Set<string>>(new Set());

  // Track which anchors are mounted (poll briefly + on resize) so `first_seen`
  // only fires once the target has actually rendered.
  useEffect(() => {
    if (!enabled) return;
    function scan() {
      const present = new Set<string>();
      for (const def of defs) {
        if (document.querySelector(selector(def.anchor))) {
          present.add(def.anchor);
        }
      }
      setAnchorsPresent((prev) => {
        if (prev.size === present.size && [...present].every((a) => prev.has(a))) {
          return prev;
        }
        return present;
      });
    }
    scan();
    const id = window.setInterval(scan, 500);
    window.addEventListener("resize", scan);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", scan);
    };
  }, [defs, enabled]);

  // `after_delay_ms` timers.
  useEffect(() => {
    if (!enabled) return;
    const timers: number[] = [];
    for (const def of defs) {
      if (def.trigger.kind === "after_delay_ms") {
        timers.push(
          window.setTimeout(() => {
            setElapsedDelayIds((prev) => new Set(prev).add(def.id));
          }, def.trigger.ms),
        );
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [defs, enabled]);

  const seen = useMemo(
    () => mergeSeen(seenQuery.data ?? [], localSeen),
    [seenQuery.data, localSeen],
  );
  const firedSet = useMemo(
    () => new Set(firedActions ?? []),
    [firedActions],
  );
  const triggered = useMemo(
    () =>
      readyTriggerIds(defs, {
        anchorsPresent,
        firedActions: firedSet,
        elapsedDelayIds,
      }),
    [defs, anchorsPresent, firedSet, elapsedDelayIds],
  );
  const active = useMemo(
    () => (enabled ? selectActiveCoachmark(defs, seen, triggered) : null),
    [enabled, defs, seen, triggered],
  );

  // Keep the spotlight aligned to the active anchor across scroll/resize.
  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    function update() {
      const el = document.querySelector(selector(active!.anchor));
      setRect(el ? rectOf(el) : null);
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  const dismiss = useCallback(() => {
    if (!active) return;
    setLocalSeen((prev) =>
      prev.includes(active.id) ? prev : [...prev, active.id],
    );
    if (!sentRef.current.has(active.id)) {
      sentRef.current.add(active.id);
      markSeen.mutate(
        { featureId: active.id },
        { onSettled: () => void utils.tutorial.seenFeatures.invalidate() },
      );
    }
  }, [active, markSeen, utils]);

  // Escape dismisses, matching dialog conventions.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dismiss]);

  if (!active || !rect) return null;

  const remaining = remainingCount(defs, seen);
  const label = remaining > 1 ? "Next" : "Got it";
  const titleId = `coachmark-title-${active.id}`;
  const bodyId = `coachmark-body-${active.id}`;

  // Place the popover below the anchor when there's room, otherwise above.
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const below = rect.top + rect.height + GAP;
  const placeAbove = below > viewportH - 160;
  const popTop = placeAbove
    ? Math.max(GAP, rect.top - GAP)
    : below;
  const popLeft = clamp(rect.left, GAP, viewportW - POPOVER_WIDTH - GAP);

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Spotlight: dim everything but the anchor via a giant ring shadow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-md ring-2 ring-lore-accent"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
      />

      {/* Popover */}
      <div
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="pointer-events-auto absolute w-80 rounded-lg border border-lore-accent bg-lore-surface p-4 shadow-xl"
        style={{
          top: popTop,
          left: popLeft,
          transform: placeAbove ? "translateY(-100%)" : undefined,
        }}
      >
        <div id={titleId} className="font-display text-sm font-semibold text-lore-text">
          {active.title}
        </div>
        <p id={bodyId} className="mt-1.5 text-sm text-lore-muted">
          {active.body}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-lore-muted">
            Tip
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-xs text-lore-text transition-colors hover:border-lore-accent"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
