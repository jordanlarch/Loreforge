"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { CodexCategory } from "@/lib/codex-categories";
import { codexDetailPath } from "@/lib/codex-routes";
import {
  readRecentlyViewed,
  RECENT_UPDATE_EVENT,
  recentEntryHref,
  type RecentEntry,
} from "@/lib/codex-recently-viewed";
import { trpc } from "@/lib/trpc/client";

/** Popular SRD spells surfaced for one-click Smithy copy (CODEX-4). */
const QUICK_COPY_SPELLS = [
  "Fireball",
  "Cure Wounds",
  "Shield",
  "Misty Step",
  "Counterspell",
] as const;

function sourceBadge(entry: RecentEntry): string {
  if (entry.source === "smithy") return "Smithy";
  return "Codex";
}

export function CodexRightPane({ category }: { category: CodexCategory }) {
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const refresh = useCallback(() => {
    setRecent(readRecentlyViewed());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(RECENT_UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RECENT_UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const characters = trpc.characters.listDashboard.useQuery(undefined, {
    staleTime: 60_000,
  });

  return (
    <aside className="hidden space-y-6 xl:block">
      <PaneSection title="Recently Viewed">
        {recent.length === 0 ? (
          <p className="text-xs text-lore-muted">
            Open any Codex or Smithy entry to see it here.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.slice(0, 8).map((entry) => (
              <li key={`${entry.source}-${entry.source === "codex" ? entry.slug : entry.id}`}>
                <Link
                  href={recentEntryHref(entry)}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-lore-surface"
                >
                  <span className="truncate">{entry.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-lore-muted">
                    {sourceBadge(entry)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PaneSection>

      <PaneSection title="Quick Copy to Smithy">
        <QuickCopySpells />
      </PaneSection>

      <PaneSection title="Your Characters">
        {characters.isLoading ? (
          <p className="text-xs text-lore-muted">Loading…</p>
        ) : (characters.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-lore-muted">
            No characters yet.{" "}
            <Link href="/characters/new" className="text-lore-accent hover:underline">
              Create one
            </Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {characters.data!.slice(0, 5).map(({ character: c }) => (
              <li key={c.id}>
                <Link
                  href={`/characters/${c.id}`}
                  className="block truncate rounded px-2 py-1.5 text-sm transition-colors hover:bg-lore-surface"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(characters.data?.length ?? 0) > 5 ? (
          <Link
            href="/characters"
            className="mt-2 block text-xs text-lore-accent hover:underline"
          >
            View all characters →
          </Link>
        ) : null}
      </PaneSection>

      <p className="text-[10px] text-lore-muted">
        Browsing {category}. Right pane is desktop-only.
      </p>
    </aside>
  );
}

function PaneSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface/40 p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-lore-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuickCopySpells() {
  return (
    <div className="space-y-1">
      {QUICK_COPY_SPELLS.map((name) => (
        <QuickCopySpellRow key={name} searchName={name} />
      ))}
    </div>
  );
}

function QuickCopySpellRow({ searchName }: { searchName: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [note, setNote] = useState<string | null>(null);

  const list = trpc.codex.listSpells.useQuery(
    { search: searchName, limit: 1, offset: 0 },
    { staleTime: 300_000 },
  );

  const copy = trpc.smithy.copyFromCodex.useMutation({
    onSuccess: async (result) => {
      if (result.kind === "spell") {
        await utils.smithy.listSpells.invalidate();
        setNote(`Copied ${searchName}`);
        router.push(`/smithy/spells/${result.id}`);
        return;
      }
      await utils.smithy.list.invalidate();
      setNote(`Copied ${searchName}`);
      router.push(`/smithy/${result.id}`);
    },
    onError: (err) => setNote(err.message),
  });

  const spell = list.data?.spells[0];
  const slug = spell?.slug;

  return (
    <div className="rounded px-2 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        {slug ? (
          <Link
            href={codexDetailPath("Spells", slug)}
            className="truncate hover:text-lore-accent"
          >
            {spell.name}
          </Link>
        ) : (
          <span className="truncate text-lore-muted">{searchName}</span>
        )}
        <button
          type="button"
          disabled={!slug || copy.isPending}
          onClick={() => slug && copy.mutate({ category: "Spells", slug })}
          className="shrink-0 rounded border border-lore-accent/60 bg-lore-accent-dim px-2 py-0.5 text-[10px] uppercase tracking-wide text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {copy.isPending ? "…" : "Copy"}
        </button>
      </div>
      {note ? <p className="pt-0.5 text-xs text-lore-muted">{note}</p> : null}
    </div>
  );
}
