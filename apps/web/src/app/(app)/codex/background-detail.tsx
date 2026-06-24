"use client";

import { useEffect } from "react";

import { backgroundBenefits } from "@/lib/codex-background-feat-display";
import { trpc } from "@/lib/trpc/client";

export function BackgroundDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const background = trpc.codex.getBackground.useQuery({ slug });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (background.data?.raw ?? {}) as Record<string, unknown>;
  const benefits = backgroundBenefits(raw);

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
                          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-lore-muted">
                            {benefit.desc}
                          </p>
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
