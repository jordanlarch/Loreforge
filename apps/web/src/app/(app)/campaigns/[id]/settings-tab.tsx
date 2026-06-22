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
 * art-style lock (Q16) — plus a danger zone to delete the campaign. Members /
 * invites, memory export, and per-NPC TTS voices are deferred (see deferrals).
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

      <DangerZone campaignId={campaignId} name={campaign.data.name} />
    </div>
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
  const [confirming, setConfirming] = useState(false);
  const remove = trpc.campaigns.delete.useMutation({
    onSuccess: () => router.push("/campaigns"),
  });

  return (
    <section className="rounded-lg border border-red-500/40 bg-red-500/5 p-5">
      <h3 className="font-display text-lg text-red-300">Danger Zone</h3>
      <p className="mt-1 text-sm text-lore-muted">
        Permanently delete <strong className="text-lore-text">{name}</strong> and
        all its play data — encounters, plot hooks, chat log, and combat state.
        Your characters and Realms entities are kept. This cannot be undone.
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
