"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  buildCharacterSheet,
  MAX_CHARACTER_LEVEL,
  xpProgress,
} from "@app/engine";
import type { characters } from "@app/db";

import { trpc } from "@/lib/trpc/client";

type CharacterRow = typeof characters.$inferSelect;

type CampaignLink = {
  campaignId: string;
  name: string;
  role: string;
  status: string;
  joinedAt: Date;
};

export function CharactersBrowser() {
  const list = trpc.characters.listDashboard.useQuery();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "level" | "updated">("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [groupByCampaign, setGroupByCampaign] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = list.data ?? [];
    if (q) {
      rows = rows.filter(({ character: c }) => {
        const sheet = buildCharacterSheet(c);
        return (
          sheet.name.toLowerCase().includes(q) ||
          sheet.species.toLowerCase().includes(q) ||
          (c.classes as { class: string }[]).some((cl) =>
            cl.class.toLowerCase().includes(q),
          ) ||
          c.background.toLowerCase().includes(q)
        );
      });
    }
    return [...rows].sort((a, b) => {
      const sa = buildCharacterSheet(a.character);
      const sb = buildCharacterSheet(b.character);
      if (sort === "level") {
        return sb.level - sa.level || sa.name.localeCompare(sb.name);
      }
      if (sort === "updated") {
        return (
          b.character.updatedAt.getTime() - a.character.updatedAt.getTime() ||
          sa.name.localeCompare(sb.name)
        );
      }
      return sa.name.localeCompare(sb.name);
    });
  }, [list.data, search, sort]);

  const grouped = useMemo(() => {
    if (!groupByCampaign) return null;
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      if (row.campaigns.length === 0) {
        const key = "No campaign";
        const bucket = map.get(key) ?? [];
        bucket.push(row);
        map.set(key, bucket);
        continue;
      }
      for (const camp of row.campaigns) {
        const bucket = map.get(camp.name) ?? [];
        bucket.push(row);
        map.set(camp.name, bucket);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupByCampaign]);

  const count = filtered.length;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-8">
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${count} character${count === 1 ? "" : "s"}`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters…"
              className="rounded border border-lore-border bg-lore-surface px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
            />
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "name" | "level" | "updated")
              }
              className="rounded border border-lore-border bg-lore-surface px-2 py-1.5 text-sm"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
              <option value="level">Level (high first)</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-lore-muted">
              <input
                type="checkbox"
                checked={groupByCampaign}
                onChange={(e) => setGroupByCampaign(e.target.checked)}
                className="rounded border-lore-border"
              />
              Group by campaign
            </label>
            <div className="flex rounded border border-lore-border text-xs">
              <button
                type="button"
                onClick={() => setLayout("grid")}
                className={`px-2 py-1.5 ${layout === "grid" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted"}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setLayout("list")}
                className={`px-2 py-1.5 ${layout === "list" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted"}`}
              >
                List
              </button>
            </div>
            <Link
              href="/characters/new"
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              New character
            </Link>
          </div>
        </div>

        {!list.isLoading && count === 0 ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No characters yet.{" "}
            <Link
              href="/characters/new"
              className="text-lore-accent hover:underline"
            >
              Create your first one
            </Link>{" "}
            to get started.
          </div>
        ) : grouped ? (
          <div className="space-y-8">
            {grouped.map(([campaignName, rows]) => (
              <section key={campaignName}>
                <h2 className="mb-3 font-display text-lg text-lore-text">
                  {campaignName}
                </h2>
                <CharacterList rows={rows} layout={layout} />
              </section>
            ))}
          </div>
        ) : (
          <CharacterList rows={filtered} layout={layout} />
        )}
      </div>

      <aside className="mt-8 hidden lg:block">
        <div className="sticky top-6 rounded-lg border border-lore-border bg-lore-surface p-4 text-sm">
          <h2 className="font-display text-base">Quick tips</h2>
          <ul className="mt-3 space-y-2 text-xs text-lore-muted">
            <li>Click a card to open the character sheet.</li>
            <li>Use the ⋯ menu to duplicate, export, or share.</li>
            <li>Play Now jumps straight into live play when a character is in a campaign.</li>
          </ul>
          <Link
            href="/characters/new"
            className="mt-4 block rounded border border-lore-accent bg-lore-accent-dim px-3 py-2 text-center text-sm text-lore-text hover:border-lore-accent"
          >
            Create character
          </Link>
        </div>
      </aside>
    </div>
  );
}

function CharacterList({
  rows,
  layout,
}: {
  rows: { character: CharacterRow; campaigns: CampaignLink[] }[];
  layout: "grid" | "list";
}) {
  return (
    <ul
      className={
        layout === "grid"
          ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-2"
          : "flex flex-col gap-3"
      }
    >
      {rows.map(({ character, campaigns }) => (
        <CharacterCard
          key={character.id}
          character={character}
          campaigns={campaigns}
          layout={layout}
        />
      ))}
    </ul>
  );
}

function CharacterCard({
  character,
  campaigns,
  layout = "grid",
}: {
  character: CharacterRow;
  campaigns: CampaignLink[];
  layout?: "grid" | "list";
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const remove = trpc.characters.delete.useMutation({
    onSuccess: async () => {
      setConfirmingDelete(false);
      await utils.characters.listDashboard.invalidate();
      await utils.characters.list.invalidate();
    },
  });

  const duplicate = trpc.characters.duplicate.useMutation({
    onSuccess: async (row) => {
      setMenuOpen(false);
      await utils.characters.listDashboard.invalidate();
      await utils.characters.list.invalidate();
      if (row) {
        setToast(`Duplicated as “${row.name}”`);
        window.setTimeout(() => setToast(null), 2500);
      }
    },
  });

  const sheet = buildCharacterSheet(character);
  const progress = xpProgress(character.xp, sheet.level);
  const atCap = sheet.level >= MAX_CHARACTER_LEVEL;
  const lastUpdated = character.updatedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sheetHref = `/characters/${character.id}`;

  function exportJson() {
    const blob = new Blob([JSON.stringify(character, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }

  async function shareLink() {
    const url = `${window.location.origin}${sheetHref}`;
    await navigator.clipboard.writeText(url);
    setToast("Link copied to clipboard");
    setMenuOpen(false);
    window.setTimeout(() => setToast(null), 2500);
  }

  function openSheet() {
    router.push(sheetHref);
  }

  function onCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,select,label")) return;
    openSheet();
  }

  function onCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSheet();
    }
  }

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      className={`relative flex h-full cursor-pointer flex-col rounded-lg border border-lore-border bg-lore-surface transition-colors hover:border-lore-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lore-accent ${
        layout === "list" ? "sm:flex-row sm:items-stretch" : ""
      }`}
    >
      {toast && (
        <div className="absolute right-3 top-3 z-10 rounded border border-lore-accent bg-lore-bg px-2 py-1 text-xs text-lore-text shadow-lg">
          {toast}
        </div>
      )}

      <div
        className={`flex flex-1 flex-col gap-3 p-5 ${layout === "list" ? "sm:flex-row sm:items-center sm:gap-6" : ""}`}
      >
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-xl text-lore-text">{sheet.name}</p>
            <p className="mt-0.5 text-xs text-lore-muted">
              Updated {lastUpdated}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {confirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove.mutate({ id: character.id });
                  }}
                  disabled={remove.isPending}
                  className="rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                >
                  {remove.isPending ? "…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingDelete(false);
                  }}
                  disabled={remove.isPending}
                  className="rounded px-1.5 py-1 text-xs text-lore-muted hover:text-lore-text"
                  aria-label="Cancel delete"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                  setMenuOpen(false);
                }}
                aria-label={`Delete ${sheet.name}`}
                className="rounded p-1.5 text-lore-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <TrashIcon />
              </button>
            )}
            <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
              Lvl {sheet.level}
            </span>
          </div>
        </div>
        <span className="text-sm text-lore-muted">
          {[sheet.species, sheet.classLine, character.background]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <div className="max-w-xs">
          <div className="mb-1 flex items-center justify-between text-xs text-lore-muted">
            <span>
              XP {character.xp.toLocaleString()}
              {atCap ? " · Max" : progress.ceiling ? ` / ${progress.ceiling.toLocaleString()}` : ""}
            </span>
            {!atCap && progress.nextLevel && (
              <span>→ Lvl {progress.nextLevel}</span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-lore-bg">
            <div
              className="h-full rounded-full bg-lore-accent transition-all"
              style={{
                width: `${Math.round(progress.fraction * 100)}%`,
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-lore-muted">
          <span>AC {sheet.ac}</span>
          <span>
            HP {sheet.hp.current}/{sheet.hp.max}
          </span>
          <span>Speed {sheet.speed}</span>
        </div>
        {campaigns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {campaigns.map((c) => (
              <Link
                key={c.campaignId}
                href={`/campaigns/${c.campaignId}/play`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-lore-accent/50 bg-lore-accent-dim px-2.5 py-0.5 text-xs text-lore-text hover:border-lore-accent"
              >
                Play · {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div
        className="relative border-t border-lore-border px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setMenuOpen((o) => !o);
            setConfirmingDelete(false);
          }}
          aria-label="Character actions"
          aria-expanded={menuOpen}
          className="rounded px-2 py-1 text-sm text-lore-muted hover:bg-lore-bg hover:text-lore-text"
        >
          ⋯
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-5 z-20 mb-1 min-w-[160px] rounded-lg border border-lore-border bg-lore-bg py-1 shadow-xl">
            <MenuButton
              label="Duplicate"
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate({ id: character.id })}
            />
            <MenuButton label="Export JSON" onClick={exportJson} />
            <MenuButton label="Copy share link" onClick={() => void shareLink()} />
          </div>
        )}
      </div>
    </li>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 9.24A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-9.24.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 8.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MenuButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-3 py-2 text-left text-sm text-lore-text transition-colors hover:bg-lore-surface disabled:opacity-40"
    >
      {label}
    </button>
  );
}
