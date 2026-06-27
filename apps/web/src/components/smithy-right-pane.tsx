"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CodexCopyPicker } from "@/app/(app)/smithy/codex-spell-copy";
import {
  readRecentlyViewed,
  RECENT_UPDATE_EVENT,
  recentEntryHref,
  type RecentSmithyEntry,
} from "@/lib/codex-recently-viewed";
import { trpc } from "@/lib/trpc/client";

const QUICK_COPY_NAMES = [
  "Fireball",
  "Longsword",
  "Cure Wounds",
  "Chain Mail",
  "Shield",
] as const;

/** Smithy desktop right pane — Recently Forged, Quick Copy, Your Characters (SMITH-8). */
export function SmithyRightPane() {
  const [recent, setRecent] = useState<RecentSmithyEntry[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);

  const refresh = useCallback(() => {
    setRecent(
      readRecentlyViewed().filter(
        (entry): entry is RecentSmithyEntry => entry.source === "smithy",
      ),
    );
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
    <>
      <aside className="hidden space-y-6 xl:block">
        <PaneSection title="Recently Forged">
          {recent.length === 0 ? (
            <p className="text-xs text-lore-muted">
              Open or edit homebrew to see recent entries here.
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.slice(0, 8).map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  <Link
                    href={recentEntryHref(entry)}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-lore-surface"
                  >
                    <span className="truncate">{entry.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-lore-muted">
                      {entry.kind}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PaneSection>

        <PaneSection title="Quick Copy from Codex">
          <QuickCopyRows />
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            className="mt-3 w-full rounded border border-lore-accent/60 bg-lore-accent-dim px-3 py-1.5 text-xs text-lore-text transition-colors hover:border-lore-accent"
          >
            Browse Codex to copy…
          </button>
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
      </aside>

      {copyOpen ? <CodexCopyPicker onClose={() => setCopyOpen(false)} /> : null}
    </>
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

function QuickCopyRows() {
  return (
    <div className="space-y-1">
      {QUICK_COPY_NAMES.map((name) => (
        <QuickCopyRow key={name} searchName={name} />
      ))}
    </div>
  );
}

function QuickCopyRow({ searchName }: { searchName: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [note, setNote] = useState<string | null>(null);

  const spells = trpc.codex.listSpells.useQuery(
    { search: searchName, limit: 1, offset: 0 },
    { staleTime: 300_000 },
  );
  const items = trpc.codex.listItems.useQuery(
    { search: searchName, limit: 1, offset: 0 },
    { staleTime: 300_000, enabled: !spells.data?.spells[0] },
  );

  const copy = trpc.smithy.copyFromCodex.useMutation({
    onSuccess: async (result) => {
      await utils.smithy.listLibrary.invalidate();
      setNote(`Copied ${searchName}`);
      if (result.kind === "spell") {
        router.push(`/smithy/spells/${result.id}`);
      } else {
        router.push(`/smithy/${result.id}`);
      }
    },
    onError: (err) => setNote(err.message),
  });

  const spell = spells.data?.spells[0];
  const item = items.data?.items[0];
  const slug = spell?.slug ?? item?.slug;
  const category = spell ? ("Spells" as const) : item ? ("Items" as const) : null;

  return (
    <div className="rounded px-2 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-lore-muted">{searchName}</span>
        <button
          type="button"
          disabled={!slug || !category || copy.isPending}
          onClick={() => slug && category && copy.mutate({ category, slug })}
          className="shrink-0 rounded border border-lore-accent/60 bg-lore-accent-dim px-2 py-0.5 text-[10px] uppercase tracking-wide text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {copy.isPending ? "…" : "Copy"}
        </button>
      </div>
      {note ? <p className="pt-0.5 text-xs text-lore-muted">{note}</p> : null}
    </div>
  );
}
