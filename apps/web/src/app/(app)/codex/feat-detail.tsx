"use client";

import { useEffect } from "react";

import {
  featBenefits,
  formatFeatType,
} from "@/lib/codex-background-feat-display";
import { CodexDetailActions } from "@/components/codex-detail-actions";
import { trpc } from "@/lib/trpc/client";

export function FeatDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const feat = trpc.codex.getFeat.useQuery({ slug });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (feat.data?.raw ?? {}) as Record<string, unknown>;
  const benefits = featBenefits(raw);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feat-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="feat-detail-title" className="font-display text-2xl">
              {feat.data?.name ?? "Feat"}
            </h2>
            {feat.data && (
              <p className="mt-1 text-sm capitalize text-lore-muted">
                {[
                  formatFeatType(feat.data.featType),
                  feat.data.prerequisite || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {feat.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !feat.data ? (
            <p className="text-sm text-lore-muted">Feat not found.</p>
          ) : (
            <>
              <CodexDetailActions
                category="Feats"
                slug={slug}
                name={feat.data.name}
                raw={raw}
              />
              {feat.data.description && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {feat.data.description}
                </p>
              )}

              {benefits.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Benefits
                  </h3>
                  <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-lore-muted">
                    {benefits.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
