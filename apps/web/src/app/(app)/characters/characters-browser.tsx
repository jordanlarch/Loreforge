"use client";

import Link from "next/link";
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
            <li>Use the ⋯ menu on a card to duplicate, export, or share.</li>
            <li>Play Now jumps straight into live play when a character is in a campaign.</li>
            <li>XP bars show progress toward the next level (DMG thresholds).</li>
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
  const utils = trpc.useUtils();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const remove = trpc.characters.delete.useMutation({
    onSuccess: async () => {
      setConfirming(false);
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
    const url = `${window.location.origin}/characters/${character.id}`;
    await navigator.clipboard.writeText(url);
    setToast("Link copied to clipboard");
    setMenuOpen(false);
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <li
      className={`relative flex h-full flex-col rounded-lg border border-lore-border bg-lore-surface transition-colors hover:border-lore-accent ${
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
            <Link
              href={`/characters/${character.id}`}
              className="font-display text-xl hover:text-lore-accent"
            >
              {sheet.name}
            </Link>
            <p className="mt-0.5 text-xs text-lore-muted">
              Updated {lastUpdated}
            </p>
          </div>
          <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
            Lvl {sheet.level}
          </span>
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
                className="rounded-full border border-lore-accent/50 bg-lore-accent-dim px-2.5 py-0.5 text-xs text-lore-text hover:border-lore-accent"
              >
                Play · {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="relative border-t border-lore-border px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((o) => !o);
              setConfirming(false);
            }}
            aria-label="Character actions"
            className="rounded px-2 py-1 text-sm text-lore-muted hover:bg-lore-bg hover:text-lore-text"
          >
            ⋯
          </button>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-lore-muted">Delete permanently?</span>
              <button
                type="button"
                onClick={() => remove.mutate({ id: character.id })}
                disabled={remove.isPending}
                className="rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40"
              >
                {remove.isPending ? "Deleting…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={remove.isPending}
                className="text-xs text-lore-muted transition-colors hover:text-lore-text"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Link
              href={`/characters/${character.id}`}
              className="text-xs text-lore-accent hover:underline"
            >
              Open sheet
            </Link>
          )}
        </div>

        {menuOpen && (
          <div className="absolute bottom-full left-5 z-20 mb-1 min-w-[160px] rounded-lg border border-lore-border bg-lore-bg py-1 shadow-xl">
            <MenuButton
              label="Duplicate"
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate({ id: character.id })}
            />
            <MenuButton label="Export JSON" onClick={exportJson} />
            <MenuButton label="Copy share link" onClick={() => void shareLink()} />
            <MenuButton
              label="Delete…"
              danger
              onClick={() => {
                setMenuOpen(false);
                setConfirming(true);
              }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function MenuButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-lore-surface disabled:opacity-40 ${
        danger ? "text-red-300" : "text-lore-text"
      }`}
    >
      {label}
    </button>
  );
}
