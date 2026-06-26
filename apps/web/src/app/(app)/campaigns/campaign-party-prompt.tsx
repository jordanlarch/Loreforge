"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

type Mode = "choose" | "select";

/**
 * Post-creation party prompt (CAMP-11 extension): after any forge path lands a
 * new campaign, offer create / select / skip before entering the workspace.
 */
export function CampaignPartyPrompt({
  campaignId,
  campaignName,
  onClose,
}: {
  campaignId: string;
  campaignName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("choose");
  const [selectedId, setSelectedId] = useState("");

  const party = trpc.campaigns.party.useQuery({ campaignId });
  const allCharacters = trpc.characters.list.useQuery();

  const add = trpc.characters.addToCampaign.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaigns.party.invalidate({ campaignId }),
        utils.campaigns.get.invalidate({ id: campaignId }),
      ]);
      router.push(`/campaigns/${campaignId}?tab=party`);
      onClose();
    },
  });

  const memberIds = new Set((party.data ?? []).map((m) => m.id));
  const available = (allCharacters.data ?? []).filter(
    (c) => !memberIds.has(c.id),
  );

  function enterWorkspace() {
    router.push(`/campaigns/${campaignId}`);
    onClose();
  }

  function createNew() {
    router.push(`/characters/new?campaignId=${campaignId}`);
    onClose();
  }

  function confirmSelect() {
    if (!selectedId) return;
    add.mutate({ characterId: selectedId, campaignId, role: "pc" });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="party-prompt-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-lore-border bg-lore-surface p-6 shadow-xl">
        <h2 id="party-prompt-title" className="font-display text-2xl">
          Add your character
        </h2>
        <p className="mt-2 text-sm text-lore-muted">
          {campaignName ? (
            <>
              <span className="text-lore-text">{campaignName}</span> is ready.
              Add a player character to the party so quest rewards and Live Play
              have someone to attach to.
            </>
          ) : (
            <>
              Your campaign is ready. Add a player character so quest rewards
              and Live Play have someone to attach to.
            </>
          )}
        </p>

        {mode === "choose" ? (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={createNew}
              className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-3 text-left text-sm transition-colors hover:border-lore-accent"
            >
              <span className="font-medium text-lore-text">
                Create new character
              </span>
              <span className="mt-1 block text-lore-muted">
                Open the creation wizard — you&apos;ll land back in this
                campaign when done.
              </span>
            </button>

            {available.length > 0 ? (
              <button
                type="button"
                onClick={() => setMode("select")}
                className="rounded-lg border border-lore-border bg-lore-bg px-4 py-3 text-left text-sm transition-colors hover:border-lore-accent"
              >
                <span className="font-medium text-lore-text">
                  Select existing character
                </span>
                <span className="mt-1 block text-lore-muted">
                  Pick from {available.length} character
                  {available.length === 1 ? "" : "s"} in your library.
                </span>
              </button>
            ) : (
              <p className="rounded-lg border border-dashed border-lore-border px-4 py-3 text-sm text-lore-muted">
                No library characters yet — create one above, or add characters
                from the{" "}
                <Link href="/characters" className="text-lore-accent hover:underline">
                  Characters
                </Link>{" "}
                tab first.
              </p>
            )}

            <button
              type="button"
              onClick={enterWorkspace}
              className="mt-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
            >
              Skip for now
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <label className="block text-xs uppercase tracking-widest text-lore-muted">
              Character
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 block w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
              >
                <option value="">Choose a character…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.species ? ` · ${c.species}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {add.error && (
              <p className="text-sm text-red-400">{add.error.message}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("choose");
                  setSelectedId("");
                }}
                disabled={add.isPending}
                className="text-sm text-lore-muted transition-colors hover:text-lore-text disabled:opacity-40"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={confirmSelect}
                disabled={!selectedId || add.isPending}
                className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                {add.isPending ? "Adding…" : "Add to party"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
