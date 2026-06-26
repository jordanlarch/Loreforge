"use client";

import Link from "next/link";
import { useState } from "react";

import type { CampaignTabSlug } from "@/lib/campaign-workspace";
import { resumeSummary } from "@/lib/live-presence";
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
 * the membership link, and lightweight world/hooks/sessions stat cards wired to
 * existing tRPC counts. Activity feed and AI next-step hints remain deferred
 * (CAMP-13).
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
  const world = trpc.campaigns.world.useQuery({ campaignId });
  const hooks = trpc.hooks.list.useQuery({ campaignId });
  const sessions = trpc.sessions.list.useQuery({ campaignId });
  const playState = trpc.engine.state.useQuery({ campaignId });
  const resume = resumeSummary(playState.data);

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

  const worldCount = world.data?.length ?? 0;
  const worldDiscovered =
    world.data?.filter((entity) => entity.discovered).length ?? 0;
  const worldHint = world.isLoading
    ? "loading…"
    : worldCount === 0
      ? "none added yet"
      : `${worldDiscovered} discovered`;

  const hookCount = hooks.data?.length ?? 0;
  const openHooks =
    hooks.data?.filter(
      (hook) => hook.status === "active" || hook.status === "open",
    ).length ?? 0;
  const hookHint = hooks.isLoading
    ? "loading…"
    : hookCount === 0
      ? "none yet"
      : openHooks > 0
        ? `${openHooks} open/active`
        : `${hookCount} total`;

  const sessionCount = sessions.data?.length ?? 0;
  const lastSession = sessions.data?.[0];
  const sessionHint = sessions.isLoading
    ? "loading…"
    : sessionCount === 0
      ? "none yet"
      : lastSession
        ? `last ${formatDate(lastSession.endedAt)}`
        : "";

  return (
    <div className="flex flex-col gap-6">
      {/* —— Resume banner (#105): mid-session pickup —— */}
      {resume && (
        <Link
          href={`/campaigns/${campaignId}/play`}
          className="flex items-center justify-between gap-4 rounded-lg border border-lore-accent bg-lore-accent-dim px-5 py-3 transition-colors hover:border-lore-accent"
        >
          <span className="text-sm text-lore-text">
            📖 You&apos;re mid-session
            {resume.sceneName ? ` at ${resume.sceneName}` : ""}
            {resume.inCombat
              ? ` — in combat${resume.round ? `, round ${resume.round}` : ""}`
              : ""}
            .
          </span>
          <span className="shrink-0 text-sm font-medium text-lore-accent">
            Continue ▶
          </span>
        </Link>
      )}

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

      {/* —— Pinned memory (#155) —— */}
      <PinnedMemorySection campaignId={campaignId} />

      {/* —— Stat cards —— */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Party"
          value={partyCount}
          hint={partyCount === 1 ? "character" : "characters"}
          onClick={() => onOpenTab("party")}
        />
        <StatCard
          label="Locations"
          value={world.isLoading ? "…" : worldCount}
          hint={worldHint}
          onClick={() => onOpenTab("locations")}
        />
        <StatCard
          label="Quests"
          value={hooks.isLoading ? "…" : hookCount}
          hint={hookHint}
          onClick={() => onOpenTab("quests")}
        />
        <StatCard
          label="Sessions"
          value={sessions.isLoading ? "…" : sessionCount}
          hint={sessionHint}
        />
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

/**
 * Pinned Memory (#155): durable DM-authored facts the AI-GM weights heavily
 * during live play. Pins are embedded as a `pinned_memory` RAG source and
 * surfaced (high-weighted) in the live-turn world-knowledge rerank.
 */
function PinnedMemorySection({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const pins = trpc.pins.list.useQuery({ campaignId });
  const [content, setContent] = useState("");

  async function refresh() {
    await utils.pins.list.invalidate({ campaignId });
  }

  const create = trpc.pins.create.useMutation({
    onSuccess: async () => {
      setContent("");
      await refresh();
    },
  });
  const remove = trpc.pins.remove.useMutation({ onSuccess: refresh });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    create.mutate({ campaignId, content: trimmed });
  }

  const list = pins.data ?? [];

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="text-xs uppercase tracking-widest text-lore-muted">
        Pinned Memory
      </h3>
      <p className="mt-1 text-sm text-lore-muted">
        Durable facts the AI-GM keeps in mind during play (e.g. &ldquo;the
        innkeeper is secretly a doppelganger&rdquo;).
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          placeholder="Pin a fact for the GM to remember…"
          className="min-w-0 flex-1 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        <button
          type="submit"
          disabled={create.isPending || content.trim().length === 0}
          className="shrink-0 rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {create.isPending ? "Pinning…" : "Pin"}
        </button>
      </form>
      {create.error && (
        <p className="mt-2 text-sm text-red-400">{create.error.message}</p>
      )}

      {pins.isLoading ? (
        <p className="mt-3 text-sm text-lore-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-lore-muted">
          No pinned memories yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {list.map((pin) => (
            <li
              key={pin.id}
              className="flex items-start justify-between gap-3 rounded border border-lore-border bg-lore-bg p-3"
            >
              <span className="min-w-0 text-sm text-lore-text">📌 {pin.content}</span>
              <button
                type="button"
                onClick={() => remove.mutate({ campaignId, pinId: pin.id })}
                disabled={remove.isPending}
                className="shrink-0 text-sm text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  onClick?: () => void;
}) {
  const className =
    "flex flex-col items-start rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors" +
    (onClick ? " hover:border-lore-accent" : "");

  const inner = (
    <>
      <span className="text-xs uppercase tracking-widest text-lore-muted">
        {label}
      </span>
      <span className="mt-1 font-display text-2xl text-lore-text">{value}</span>
      <span className="text-xs text-lore-muted">{hint}</span>
    </>
  );

  if (!onClick) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
