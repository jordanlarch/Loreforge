"use client";

import { useEffect } from "react";

import { traitDescription } from "@app/db/traits";
import { ABILITIES, type AbilityScores } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";
import { CodexDetailActions } from "@/components/codex-detail-actions";
import { abilityBonusLine, ABILITY_LABELS, signed } from "@/lib/codex-display";
import { trpc } from "@/lib/trpc/client";

export function SpeciesDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const species = trpc.codex.getSpecies.useQuery({ slug });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bonuses = (species.data?.abilityBonuses ?? {}) as Partial<AbilityScores>;

  return (
    <DetailModal title={species.data?.name ?? "Species"} onClose={onClose}>
      {species.isLoading ? (
        <p className="text-sm text-lore-muted">Loading…</p>
      ) : !species.data ? (
        <p className="text-sm text-red-400">Species not found.</p>
      ) : (
        <>
          <CodexDetailActions
            category="Species"
            slug={slug}
            name={species.data.name}
            raw={species.data.raw as Record<string, unknown>}
          />
          <p className="text-sm text-lore-muted">
            {species.data.size} · {species.data.speed} ft speed · SRD
          </p>

          {species.data.description ? (
            <p className="mt-4 text-sm leading-relaxed text-lore-text">
              {species.data.description}
            </p>
          ) : null}

          <section className="mt-6">
            <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
              Ability Score Increase
            </h3>
            <p className="text-sm">{abilityBonusLine(bonuses)}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ABILITIES.map((a) => (
                <div
                  key={a}
                  className="rounded border border-lore-border bg-lore-surface px-2 py-2 text-center"
                >
                  <dt className="text-[10px] uppercase tracking-widest text-lore-muted">
                    <SrdHint kind="ability" ability={a} label={ABILITY_LABELS[a]} />
                  </dt>
                  <dd className="mt-1 font-display text-lg">
                    {bonuses[a] ? signed(bonuses[a]!) : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-6">
            <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
              Traits
            </h3>
            <ul className="space-y-3">
              {species.data.traits.map((trait) => {
                const body = traitDescription(trait);
                return (
                  <li
                    key={trait}
                    className="rounded-lg border border-lore-border bg-lore-surface p-3"
                  >
                    <div className="text-sm font-medium text-lore-text">
                      {trait}
                    </div>
                    {body ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-lore-muted">
                        {body}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-lore-muted">
                        Full rules not yet catalogued.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <footer className="mt-8 flex flex-wrap gap-2 border-t border-lore-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted hover:text-lore-text"
            >
              Close
            </button>
          </footer>
        </>
      )}
    </DetailModal>
  );
}

function DetailModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <h2 id="codex-detail-title" className="font-display text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
