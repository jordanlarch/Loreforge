"use client";

/**
 * Tutorial entity side-drawer (TUT-1, #171) — "what your character knows".
 *
 * Opened by clicking an @Entity chip in narration. Slides in from the right with
 * the entity's pre-written blurb + disposition and, for speakable NPCs, a "Speak
 * to…" action that fires the scripted dialogue beat (the soft rail). Closes on
 * backdrop click or Escape. Tutorial-scoped for now; the general Realms entity
 * peek is a later concern.
 */
import { useEffect } from "react";

import {
  dispositionLabel,
  tutorialEntity,
  type EntityDisposition,
} from "@/lib/tutorial-entities";

const DISPOSITION_DOT: Record<EntityDisposition, string> = {
  friendly: "bg-emerald-400",
  neutral: "bg-lore-accent",
  hostile: "bg-red-400",
  unknown: "bg-lore-muted",
};

export function TutorialEntityDrawer({
  name,
  onClose,
  onSpeak,
}: {
  /** The entity name to show, or null when the drawer is closed. */
  name: string | null;
  onClose: () => void;
  /** Trigger a scripted dialogue beat for a speakable NPC. */
  onSpeak: (topic: "barnaby" | "lily") => void;
}) {
  useEffect(() => {
    if (!name) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [name, onClose]);

  if (!name) return null;
  const entity = tutorialEntity(name);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        role="dialog"
        aria-label={`About ${name}`}
        className="absolute right-0 top-0 flex h-full w-80 max-w-[90vw] flex-col gap-4 border-l border-lore-border bg-lore-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg leading-tight text-lore-text">
              {name}
            </div>
            {entity && (
              <div className="text-xs text-lore-muted">{entity.subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:text-lore-text"
          >
            Close
          </button>
        </div>

        {entity ? (
          <>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-lore-muted">
                What you know
              </div>
              <p className="mt-1 text-sm text-lore-text">{entity.known}</p>
            </div>

            {entity.disposition && (
              <div className="flex items-center gap-2 text-xs text-lore-muted">
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${DISPOSITION_DOT[entity.disposition]}`}
                />
                Disposition: {dispositionLabel(entity.disposition)}
              </div>
            )}

            {entity.speak ? (
              <SpeakButton
                topic={entity.speak}
                firstName={name.split(" ")[0] ?? name}
                onSpeak={onSpeak}
                onClose={onClose}
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-lore-muted">
            You don&apos;t know much about this yet.
          </p>
        )}
      </aside>
    </div>
  );
}

function SpeakButton({
  topic,
  firstName,
  onSpeak,
  onClose,
}: {
  topic: "barnaby" | "lily";
  firstName: string;
  onSpeak: (topic: "barnaby" | "lily") => void;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSpeak(topic);
        onClose();
      }}
      className="mt-auto rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent"
    >
      Speak to {firstName}
    </button>
  );
}
