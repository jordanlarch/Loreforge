"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

import { CampaignCreateModal } from "./campaign-create-modal";

export function CampaignsBrowser() {
  const list = trpc.campaigns.list.useQuery();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {creating && (
        <CampaignCreateModal onClose={() => setCreating(false)} />
      )}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-lore-muted">
          Forge a world, run a guided setup, or start from an empty workspace.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          + New Campaign
        </button>
      </div>

      <div className="mb-4 text-sm text-lore-muted">
        {list.isLoading
          ? "Loading…"
          : `${list.data?.length ?? 0} campaign${
              list.data?.length === 1 ? "" : "s"
            }`}
      </div>

      {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No campaigns yet.{" "}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-lore-accent hover:underline"
          >
            Begin a new campaign
          </button>
          , or{" "}
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
