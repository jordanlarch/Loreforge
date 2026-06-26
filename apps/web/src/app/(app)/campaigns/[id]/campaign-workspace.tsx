"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  CAMPAIGN_WORKSPACE_TABS,
  resolveCampaignTab,
  type CampaignTabSlug,
} from "@/lib/campaign-workspace";
import { trpc } from "@/lib/trpc/client";

import { HooksTab } from "./hooks-tab";
import { NotesTab } from "./notes-tab";
import { OverviewTab } from "./overview-tab";
import { PartyTab } from "./party-tab";
import { SettingsTab } from "./settings-tab";
import { WorldMapTab } from "./world-map-tab";
import { WorldTab } from "./world-tab";
import { PlayNowButton } from "./play-now-button";

/**
 * The campaign workspace shell (#55, CAMP-UX UX-2): fixed header (back link, live
 * indicator, title bar, seven-tab bar, pinned Start Live Session), and a tab body.
 * The active tab is reflected in `?tab=<slug>` so tabs are deep-linkable (CAMP-15).
 * Legacy nine-tab slugs redirect via {@link resolveCampaignTab}.
 */
export function CampaignWorkspace({ campaignId }: { campaignId: string }) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <WorkspaceInner campaignId={campaignId} />
    </Suspense>
  );
}

function WorkspaceFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-lore-muted">Loading…</div>
  );
}

function WorkspaceInner({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = resolveCampaignTab(searchParams.get("tab"));

  const campaign = trpc.campaigns.get.useQuery({ id: campaignId });

  function selectTab(slug: CampaignTabSlug) {
    const query = slug === "overview" ? "" : `?tab=${slug}`;
    router.replace(`${pathname}${query}`, { scroll: false });
  }

  if (campaign.isLoading) return <WorkspaceFallback />;

  if (!campaign.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">
          Campaign not found
        </h1>
        <p className="mt-2 text-lore-muted">
          It may have been deleted, or you don&apos;t have access.
        </p>
        <Link className="mt-6 inline-block text-lore-accent underline" href="/campaigns">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  const data = campaign.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* —— Fixed header —— */}
      <header className="border-b border-lore-border pb-3">
        <div className="flex items-center justify-between">
          <Link
            href="/campaigns"
            className="text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            ← Back to Campaigns
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lore-border px-2.5 py-1 text-xs text-lore-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-lore-muted" />
            Live: Off
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl leading-tight">{data.name}</h1>
          <PlayNowButton campaignId={campaignId} onOpenTab={selectTab} />
        </div>

        {/* —— Tab bar —— */}
        <div
          role="tablist"
          aria-label="Campaign workspace"
          className="mt-4 flex flex-wrap gap-1 border-b border-lore-border"
        >
          {CAMPAIGN_WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={tab.slug === active}
              onClick={() => selectTab(tab.slug)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                tab.slug === active
                  ? "border-lore-accent text-lore-text"
                  : "border-transparent text-lore-muted hover:text-lore-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* —— Tab body —— */}
      <div className="py-6">
        {active === "overview" ? (
          <OverviewTab
            campaignId={campaignId}
            campaign={data}
            onOpenTab={selectTab}
          />
        ) : active === "party" ? (
          <PartyTab campaignId={campaignId} />
        ) : active === "locations" ? (
          <WorldTab campaignId={campaignId} />
        ) : active === "quests" ? (
          <HooksTab campaignId={campaignId} />
        ) : active === "map" ? (
          <WorldMapTab campaignId={campaignId} />
        ) : active === "notes" ? (
          <NotesTab campaignId={campaignId} />
        ) : active === "settings" ? (
          <SettingsTab campaignId={campaignId} />
        ) : (
          <StubTab
            label={
              CAMPAIGN_WORKSPACE_TABS.find((t) => t.slug === active)?.label ??
              "Tab"
            }
          />
        )}
      </div>
    </div>
  );
}

function StubTab({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-lore-border p-12 text-center">
      <p className="font-display text-xl text-lore-text">{label}</p>
      <p className="mt-2 text-sm text-lore-muted">
        This tab is coming in a later slice.
      </p>
    </div>
  );
}
