"use client";

import Link from "next/link";
import { useState } from "react";

import type { CampaignTabSlug } from "@/lib/campaign-workspace";
import { trpc } from "@/lib/trpc/client";

type CampaignData = {
  id: string;
  name: string;
  description: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Overview tab (#55): the campaign "you are here" hub. Shows the hero (name +
 * pitch with inline edit), the entry points into Live Play, a party summary from
 * the membership link, and lightweight world/session stat cards. Widgets that
 * depend on later slices (hooks, sessions, activity feed) are shown as stubs.
 */
export function OverviewTab({
  campaignId,
  campaign,
  onOpenTab,
}: {
  campaignId: string;
  campaign: CampaignData;
  onOpenTab: (slug: CampaignTabSlug) => void;
}) {
  const utils = trpc.useUtils();
  const party = trpc.campaigns.party.useQuery({ campaignId });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);

  const update = trpc.campaigns.update.useMutation({
    onSuccess: async () => {
      await utils.campaigns.get.invalidate({ id: campaignId });
      setEditing(false);
    },
  });

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    update.mutate({ id: campaignId, name: trimmed, description });
  }

  const partyCount = party.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* —— Hero —— */}
      <section className="rounded-lg border border-lore-border bg-lore-surface p-6">
        {editing ? (
          <form onSubmit={onSave} className="flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Campaign name"
              className="rounded border border-lore-border bg-lore-bg px-3 py-2 font-display text-2xl outline-none focus:border-lore-accent"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="A one-line pitch for this campaign…"
              className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={update.isPending || name.trim().length === 0}
                className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                {update.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(campaign.name);
                  setDescription(campaign.description);
                  setEditing(false);
                }}
                className="rounded border border-lore-border px-3 py-1.5 text-sm hover:border-lore-accent"
              >
                Cancel
              </button>
              {update.error && (
                <span className="text-sm text-red-400">
                  {update.error.message}
                </span>
              )}
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-2xl">{campaign.name}</h2>
              <p className="mt-1 text-sm text-lore-muted">
                {campaign.description || "No pitch yet — add one to set the tone."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded border border-lore-border px-3 py-1.5 text-sm hover:border-lore-accent"
            >
              Edit
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/campaigns/${campaignId}/play`}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent"
          >
            ▶ Start Live Session
          </Link>
          <Link
            href={`/campaigns/${campaignId}/play`}
            className="rounded border border-lore-border px-4 py-2 text-sm transition-colors hover:border-lore-accent"
          >
            📖 Continue last session →
          </Link>
        </div>
      </section>

      {/* —— Party —— */}
      <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-widest text-lore-muted">
            Party
          </h3>
          <button
            type="button"
            onClick={() => onOpenTab("party")}
            className="text-sm text-lore-accent hover:underline"
          >
            Open Party →
          </button>
        </div>
        {party.isLoading ? (
          <p className="mt-3 text-sm text-lore-muted">Loading…</p>
        ) : partyCount === 0 ? (
          <p className="mt-3 text-sm text-lore-muted">
            No characters in the party yet. Add some from the Party tab.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {party.data!.map((member) => (
              <li
                key={member.membershipId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-lore-text">{member.name}</span>
                <span className="text-xs text-lore-muted">
                  {member.species || "—"}
                  {member.status === "bench" ? " · benched" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* —— Stat cards —— */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Party"
          value={partyCount}
          hint={partyCount === 1 ? "character" : "characters"}
          onClick={() => onOpenTab("party")}
        />
        <StatCard label="World" value="—" hint="coming soon" onClick={() => onOpenTab("world")} />
        <StatCard label="Hooks" value="—" hint="coming soon" onClick={() => onOpenTab("hooks")} />
        <StatCard label="Sessions" value="—" hint="coming soon" onClick={() => onOpenTab("sessions")} />
      </section>

      {/* —— Metadata —— */}
      <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
        <h3 className="text-xs uppercase tracking-widest text-lore-muted">
          Details
        </h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-lore-muted">Created</dt>
            <dd>{formatDate(campaign.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-lore-muted">Last updated</dt>
            <dd>{formatDate(campaign.updatedAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
    >
      <span className="text-xs uppercase tracking-widest text-lore-muted">
        {label}
      </span>
      <span className="mt-1 font-display text-2xl text-lore-text">{value}</span>
      <span className="text-xs text-lore-muted">{hint}</span>
    </button>
  );
}
