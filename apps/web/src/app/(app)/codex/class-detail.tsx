"use client";

import Link from "next/link";
import { useEffect } from "react";

import type { Ability } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";
import { CodexDetailActions } from "@/components/codex-detail-actions";
import { ABILITY_LABELS } from "@/lib/codex-display";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function ClassDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const cls = trpc.codex.getClass.useQuery({ slug });

  useRecordCodexView("Classes", slug, cls.data?.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <DetailModal title={cls.data?.name ?? "Class"} onClose={onClose}>
      {cls.isLoading ? (
        <p className="text-sm text-lore-muted">Loading…</p>
      ) : !cls.data ? (
        <p className="text-sm text-red-400">Class not found.</p>
      ) : (
        <>
          <CodexDetailActions
            category="Classes"
            slug={slug}
            name={cls.data.name}
            raw={cls.data.raw as Record<string, unknown>}
          />
          <p className="text-sm text-lore-muted">
            Hit Die d{cls.data.hitDie} · SRD core class
          </p>

          {cls.data.description ? (
            <p className="mt-4 text-sm leading-relaxed text-lore-text">
              {cls.data.description}
            </p>
          ) : null}

          <section className="mt-6">
            <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
              Saving Throw Proficiencies
            </h3>
            <p className="flex flex-wrap gap-x-1 text-sm">
              {cls.data.savingThrows.map((s: Ability, i: number) => (
                <span key={s}>
                  {i > 0 && ", "}
                  <SrdHint kind="ability" ability={s} label={ABILITY_LABELS[s]} />
                </span>
              ))}
            </p>
          </section>

          <section className="mt-6">
            <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
              Skill Proficiencies
            </h3>
            <p className="text-sm text-lore-muted">
              Choose {cls.data.skillChoice.choose} from:
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {cls.data.skillChoice.from.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-lore-border px-2.5 py-0.5 text-xs text-lore-text"
                >
                  <SrdHint kind="skill" skill={skill} label={skill} />
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-8 flex flex-wrap gap-2 border-t border-lore-border pt-4">
            <Link
              href="/characters/new"
              className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              Create character
            </Link>
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
      aria-labelledby="codex-class-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <h2 id="codex-class-detail-title" className="font-display text-2xl">
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
