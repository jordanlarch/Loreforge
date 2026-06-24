"use client";

import { useEffect } from "react";

import { BackgroundBenefitText } from "@/components/background-benefit-text";
import { CodexDetailActions } from "@/components/codex-detail-actions";
import { backgroundBenefits } from "@/lib/codex-background-feat-display";
import type { CodexCategory } from "@/lib/codex-categories";
import { trpc } from "@/lib/trpc/client";

export function BackgroundDetail({
  slug,
  onClose,
  onNavigateRef,
}: {
  slug: string;
  onClose: () => void;
  onNavigateRef?: (category: CodexCategory, slug: string) => void;
}) {
  const background = trpc.codex.getBackground.useQuery({ slug });
  const linkIndex = trpc.codex.linkIndex.useQuery(undefined, {
    staleTime: 60_000,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (background.data?.raw ?? {}) as Record<string, unknown>;
  const benefits = backgroundBenefits(raw);
  const index = linkIndex.data ?? { feats: [], items: [] };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="background-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <h2 id="background-detail-title" className="font-display text-2xl">
            {background.data?.name ?? "Background"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {background.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !background.data ? (
            <p className="text-sm text-lore-muted">Background not found.</p>
          ) : (
            <>
              <CodexDetailActions
                category="Backgrounds"
                slug={slug}
                name={background.data.name}
                raw={raw}
              />
              {background.data.description && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {background.data.description}
                </p>
              )}

              {benefits.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Benefits
                  </h3>
                  <ul className="space-y-3">
                    {benefits.map((benefit) => (
                      <li
                        key={`${benefit.name}-${benefit.type}`}
                        className="rounded-lg border border-lore-border bg-lore-surface p-3"
                      >
                        <div className="text-sm font-medium text-lore-text">
                          {benefit.name}
                        </div>
                        {benefit.desc ? (
                          <BackgroundBenefitText
                            desc={benefit.desc}
                            benefitType={benefit.type}
                            linkIndex={index}
                            onNavigateRef={onNavigateRef}
                          />
                        ) : null}
                      </li>
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
