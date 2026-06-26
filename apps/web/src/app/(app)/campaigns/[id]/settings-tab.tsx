"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";

type PlayMode = "async" | "live";

/** Art-style lock presets (Q16). Empty = no lock. */
const ART_STYLES = [
  "",
  "Painterly",
  "Comic / Ink",
  "Realistic",
  "Watercolor",
  "Dark Fantasy",
  "Storybook",
  "Pixel Art",
] as const;

/**
 * Settings tab (#117, CAMP-10): campaign-level configuration — the AI-GM persona
 * that steers narration voice, the default play tempo (Q19c hybrid), and the
 * art-style lock (Q16) — plus memory export, multiplayer invites (CAMP-14),
 * reputation display (REP-1), and a danger zone to delete the campaign.
 */
export function SettingsTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const campaign = trpc.campaigns.get.useQuery({ id: campaignId });

  const [gmPersona, setGmPersona] = useState("");
  const [playMode, setPlayMode] = useState<PlayMode>("async");
  const [artStyle, setArtStyle] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Seed local state once the campaign loads (and after a refetch).
  const loaded = campaign.data;
  useEffect(() => {
    if (!loaded) return;
    setGmPersona(loaded.gmPersona ?? "");
    setPlayMode((loaded.playMode as PlayMode) ?? "async");
    setArtStyle(loaded.artStyle ?? "");
  }, [loaded]);

  const update = trpc.campaigns.update.useMutation({
    onSuccess: async () => {
      await utils.campaigns.get.invalidate({ id: campaignId });
      setSavedAt(Date.now());
    },
  });

  if (campaign.isLoading) {
    return <p className="text-sm text-lore-muted">Loading settings…</p>;
  }
  if (!campaign.data) {
    return <p className="text-sm text-lore-muted">Campaign not found.</p>;
  }

  const dirty =
    gmPersona !== (campaign.data.gmPersona ?? "") ||
    playMode !== ((campaign.data.playMode as PlayMode) ?? "async") ||
    artStyle !== (campaign.data.artStyle ?? "");

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    update.mutate({ id: campaignId, gmPersona, playMode, artStyle });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <form onSubmit={onSave} className="flex flex-col gap-5">
        <h2 className="font-display text-2xl">Settings</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-lore-text">GM Persona</span>
          <span className="text-xs text-lore-muted">
            Steers the AI-GM&apos;s narration voice and tone.
          </span>
          <textarea
            value={gmPersona}
            onChange={(e) => setGmPersona(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. A wry, theatrical narrator who favors vivid sensory detail and dry wit."
            className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-lore-text">
            Default Play Mode
          </span>
          <span className="text-xs text-lore-muted">
            How sessions start. Combat always routes to Live regardless.
          </span>
          <select
            value={playMode}
            onChange={(e) => setPlayMode(e.target.value as PlayMode)}
            className="w-56 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
          >
            <option value="async">Async (play-by-post)</option>
            <option value="live">Live by default</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-lore-text">
            Art-Style Lock
          </span>
          <span className="text-xs text-lore-muted">
            A consistent visual style for this campaign&apos;s art.
          </span>
          <select
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value)}
            className="w-56 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
          >
            {ART_STYLES.map((style) => (
              <option key={style} value={style}>
                {style === "" ? "No lock" : style}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending || !dirty}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {update.isPending ? "Saving…" : "Save settings"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-lore-muted">Saved.</span>
          )}
        </div>
      </form>

      <InvitesSection campaignId={campaignId} />
      <AiUsageSection campaignId={campaignId} />
      <ReputationSection campaignId={campaignId} />

      <MemorySection campaignId={campaignId} name={campaign.data.name} />

      <DangerZone campaignId={campaignId} name={campaign.data.name} />
    </div>
  );
}

function inviteUrl(token: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/campaigns/join/${token}`;
}

/** Multiplayer invite links (CAMP-14). */
function InvitesSection({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const invites = trpc.campaigns.listInvites.useQuery({ campaignId });
  const create = trpc.campaigns.createInvite.useMutation({
    onSuccess: () => {
      setError(null);
      void utils.campaigns.listInvites.invalidate({ campaignId });
    },
    onError: (err) => setError(err.message),
  });
  const revoke = trpc.campaigns.revokeInvite.useMutation({
    onSuccess: () => utils.campaigns.listInvites.invalidate({ campaignId }),
    onError: (err) => setError(err.message),
  });

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="font-display text-lg">Players & invites</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Share a link so another player can join Live Play. Invited players can
        connect to the campaign room; per-entity command ownership is still
        owner-wide until seat auth deepens.
      </p>
      <button
        type="button"
        onClick={() => {
          setError(null);
          create.mutate({ campaignId, label: "Player" });
        }}
        disabled={create.isPending}
        className="mt-4 rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {create.isPending ? "Creating…" : "Create invite link"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <ul className="mt-4 space-y-2 text-sm">
        {(invites.data ?? []).map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-lore-border px-3 py-2"
          >
            <div>
              <span className="font-medium">{inv.label}</span>
              {inv.redeemedByUserId ? (
                <span className="ml-2 text-xs text-lore-muted">Redeemed</span>
              ) : (
                <code className="ml-2 break-all text-xs text-lore-accent">
                  {inviteUrl(inv.token)}
                </code>
              )}
            </div>
            {!inv.redeemedByUserId ? (
              <button
                type="button"
                onClick={() =>
                  revoke.mutate({ campaignId, inviteId: inv.id })
                }
                className="text-xs text-lore-muted hover:text-red-300"
              >
                Revoke
              </button>
            ) : null}
          </li>
        ))}
        {invites.data?.length === 0 ? (
          <li className="text-lore-muted">No invites yet.</li>
        ) : null}
      </ul>
    </section>
  );
}

/** Estimated LLM spend for this campaign (play + account-wide generation). */
function AiUsageSection({ campaignId }: { campaignId: string }) {
  const usage = trpc.llm.usageSummary.useQuery({ campaignId, days: 30 });

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="font-display text-lg">AI usage (30 days)</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Estimated token spend for Live Play on this campaign plus Realms
        generation on your account. Costs are approximate from published model
        rates.
      </p>
      {usage.isLoading ? (
        <p className="mt-4 text-sm text-lore-muted">Loading usage…</p>
      ) : usage.data ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded border border-lore-border px-3 py-2">
            <dt className="text-lore-muted">This campaign (play)</dt>
            <dd className="mt-1 font-medium">
              ${usage.data.playCostUsd.toFixed(4)} · {usage.data.playCalls} calls
            </dd>
          </div>
          <div className="rounded border border-lore-border px-3 py-2">
            <dt className="text-lore-muted">Generation (account)</dt>
            <dd className="mt-1 font-medium">
              ${usage.data.generationCostUsd.toFixed(4)} ·{" "}
              {usage.data.generationCalls} runs
            </dd>
          </div>
          <div className="rounded border border-lore-border px-3 py-2">
            <dt className="text-lore-muted">Combined estimate</dt>
            <dd className="mt-1 font-medium text-lore-accent">
              ${usage.data.totalCostUsd.toFixed(4)}
            </dd>
          </div>
        </dl>
      ) : null}
      {usage.data && usage.data.bySurface.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-lore-muted">
          {usage.data.bySurface.map((row) => (
            <li key={row.surface} className="flex justify-between gap-4">
              <span className="capitalize">{row.surface.replace(/_/g, " ")}</span>
              <span>
                {row.calls} · ${row.costUsd.toFixed(4)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Campaign reputation standings (REP-1). */
function ReputationSection({ campaignId }: { campaignId: string }) {
  const rep = trpc.campaigns.reputation.useQuery({ campaignId });
  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="font-display text-lg">Reputation</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Faction and settlement standing tracked for this campaign.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {(rep.data ?? []).map((row) => (
          <li
            key={row.subjectKey}
            className="flex items-center justify-between rounded border border-lore-border px-3 py-2"
          >
            <span>{row.subjectName}</span>
            <span className="capitalize text-lore-accent">{row.standing}</span>
          </li>
        ))}
        {rep.data?.length === 0 ? (
          <li className="text-lore-muted">No reputation recorded yet.</li>
        ) : null}
      </ul>
    </section>
  );
}

/** Filesystem-safe slug for the export filename. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "campaign"
  );
}

/**
 * Memory export (CAMP-10): download everything the memory tier holds for this
 * campaign — the rolling summary (MEM-3), session recaps (MEM-4), and pinned
 * memories (MEM-8) — as a portable JSON file. Read-only; lazily fetched on click.
 */
function MemorySection({
  campaignId,
  name,
}: {
  campaignId: string;
  name: string;
}) {
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setExporting(true);
    setError(null);
    try {
      const data = await utils.memory.exportCampaign.fetch({ campaignId });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loreforge-${slugify(name)}-memory-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="font-display text-lg">Memory</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Export this campaign&apos;s accumulated memory — the rolling summary,
        session recaps, and pinned memories — as a portable JSON file.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Export memory (JSON)"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </section>
  );
}

function DangerZone({
  campaignId,
  name,
}: {
  campaignId: string;
  name: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const remove = trpc.campaigns.delete.useMutation({
    onSuccess: async () => {
      await utils.realms.list.invalidate();
      router.push("/campaigns");
    },
  });

  return (
    <section className="rounded-lg border border-red-500/40 bg-red-500/5 p-5">
      <h3 className="font-display text-lg text-red-300">Danger Zone</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Permanently delete <strong className="text-lore-text">{name}</strong> and
        all its play data — encounters, plot hooks, chat log, and combat state.
        Realms entities that exist only on this campaign&apos;s world are removed;
        entities shared with other campaigns are kept. Your characters are kept.
        This cannot be undone.
      </p>
      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-lore-text">Are you sure?</span>
          <button
            type="button"
            onClick={() => remove.mutate({ id: campaignId })}
            disabled={remove.isPending}
            className="rounded border border-red-500 bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-40"
          >
            {remove.isPending ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={remove.isPending}
            className="text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded border border-red-500/60 px-3 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-500/10"
        >
          Delete campaign
        </button>
      )}
    </section>
  );
}
