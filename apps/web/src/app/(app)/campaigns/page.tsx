import Link from "next/link";

import { CampaignsBrowser } from "./campaigns-browser";

export default function CampaignsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Campaigns
          </h1>
          <p className="mt-2 text-lore-muted">
            Each campaign is persisted and event-sourced. Open one to play its
            live battle map — it syncs in real time across tabs.
          </p>
        </div>
        <Link
          href="/campaigns/sandbox/play"
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Sandbox demo →
        </Link>
      </header>

      <CampaignsBrowser />
    </div>
  );
}
