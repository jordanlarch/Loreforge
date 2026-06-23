"use client";

/**
 * Tutorial graduation modal (TUT-1, #176) — the Scene 7 wrap.
 *
 * A full-screen overlay shown when the player finishes "The Lantern's Last
 * Flicker": the completion stamp, the two achievement badges, a *static* recap
 * of everything they used (D8 — no social-share generator in v1), and the
 * "what's next" funnel routing into each primary surface. Closes on backdrop
 * click / Escape so the player can glance back at the board before choosing.
 */
import Link from "next/link";
import { useEffect } from "react";

import { TUTORIAL_ACHIEVEMENTS, TUTORIAL_WRAP } from "@app/engine";

/** A "what's next" funnel destination (each guides into a primary surface). */
type NextStep = {
  href: string;
  icon: string;
  label: string;
  hint: string;
};

/** The onboarding funnel (TUT-1, §3 Scene 7) — one row per primary surface. */
const NEXT_STEPS: readonly NextStep[] = [
  {
    href: "/characters/new",
    icon: "▶",
    label: "Create my own character",
    hint: "Roll up a hero in the Creation Wizard",
  },
  {
    href: "/campaigns",
    icon: "⚒",
    label: "Forge a brand new campaign",
    hint: "Start your own adventure",
  },
  {
    href: "/codex",
    icon: "📚",
    label: "Browse the Codex",
    hint: "The 5E SRD reference",
  },
  {
    href: "/realms",
    icon: "🏔",
    label: "Explore my Realms library",
    hint: "Worlds, NPCs, and lore",
  },
  { href: "/", icon: "⌂", label: "Just take me to Home", hint: "" },
];

export function GraduationModal({
  open,
  unlockedAchievementIds,
  onClose,
}: {
  open: boolean;
  /** Achievement ids the user has unlocked (badges render lit vs. dimmed). */
  unlockedAchievementIds: readonly string[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const unlocked = new Set(unlockedAchievementIds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial complete"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col gap-6 overflow-y-auto rounded-2xl border border-lore-accent bg-lore-surface p-6 shadow-2xl sm:p-8"
      >
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-lore-accent">
            ✦ {TUTORIAL_WRAP.subtitle} ✦
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-lore-text">
            {TUTORIAL_WRAP.title}
          </h2>
        </header>

        {/* Achievement badges */}
        <div className="flex flex-wrap justify-center gap-3">
          {TUTORIAL_ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex w-full max-w-xs items-start gap-3 rounded-lg border p-3 sm:w-64 ${
                  isUnlocked
                    ? "border-lore-accent bg-lore-accent-dim"
                    : "border-lore-border bg-lore-bg opacity-50"
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {a.icon}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-lore-text">
                    {a.title}
                    {isUnlocked && (
                      <span className="text-lore-accent" aria-hidden>
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-lore-muted">
                    {a.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Static recap — everything the player used */}
        <section>
          <h3 className="text-sm font-semibold text-lore-text">
            In this session you used:
          </h3>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {TUTORIAL_WRAP.used.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs text-lore-muted"
              >
                <span className="text-lore-accent" aria-hidden>
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-lore-muted">{TUTORIAL_WRAP.closing}</p>
        </section>

        {/* "What's next" funnel */}
        <section className="rounded-lg border border-lore-border bg-lore-bg p-3">
          <div className="text-[10px] uppercase tracking-widest text-lore-muted">
            What&apos;s next?
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {NEXT_STEPS.map((step) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent hover:bg-lore-surface"
                >
                  <span className="w-4 text-center text-lore-accent" aria-hidden>
                    {step.icon}
                  </span>
                  <span className="font-medium">{step.label}</span>
                  {step.hint && (
                    <span className="ml-auto text-xs text-lore-muted">
                      {step.hint}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex items-center justify-between gap-3">
          <Link
            href="/tutorial"
            onClick={onClose}
            className="rounded-lg border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            ↻ Replay the tutorial
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
