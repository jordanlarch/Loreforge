"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

export function CampaignsBrowser() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const list = trpc.campaigns.list.useQuery();

  const [name, setName] = useState("");
  const create = trpc.campaigns.create.useMutation({
    onSuccess: async (campaign) => {
      if (!campaign) return;
      setName("");
      await utils.campaigns.list.invalidate();
      router.push(`/campaigns/${campaign.id}`);
    },
  });

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0 && !create.isPending;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    create.mutate({ name: trimmed });
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-lore-border bg-lore-surface p-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New campaign name"
          maxLength={120}
          className="min-w-0 flex-1 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        <button
          type="submit"
          disabled={!canCreate}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {create.isPending ? "Creating…" : "New campaign"}
        </button>
      </form>

      {create.error && (
        <p className="mb-4 text-sm text-red-400">
          Couldn&apos;t create the campaign. {create.error.message}
        </p>
      )}

      <div className="mb-4 text-sm text-lore-muted">
        {list.isLoading
          ? "Loading…"
          : `${list.data?.length ?? 0} campaign${
              list.data?.length === 1 ? "" : "s"
            }`}
      </div>

      {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No campaigns yet. Create one above to start a live battle, or{" "}
          <Link
            href="/campaigns/sandbox/play"
            className="text-lore-accent hover:underline"
          >
            try the sandbox demo
          </Link>
          .
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/campaigns/${campaign.id}`}
                className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
              >
                <span className="font-display text-xl">{campaign.name}</span>
                {campaign.description ? (
                  <span className="line-clamp-2 text-sm text-lore-muted">
                    {campaign.description}
                  </span>
                ) : (
                  <span className="text-sm text-lore-muted">
                    Open the campaign workspace →
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
