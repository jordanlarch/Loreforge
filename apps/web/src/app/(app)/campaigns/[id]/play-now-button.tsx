"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CampaignTabSlug } from "@/lib/campaign-workspace";
import { derivePlayReadiness } from "@/lib/play-readiness";
import { trpc } from "@/lib/trpc/client";

/**
 * Prep-shell Play Now / Continue control (CAMP-UX UX-5). Gates first play on
 * `startingSceneId` + ≥1 active PC; mid-session campaigns skip re-check.
 */
export function PlayNowButton({
  campaignId,
  className,
  onOpenTab,
}: {
  campaignId: string;
  className?: string;
  onOpenTab?: (slug: CampaignTabSlug) => void;
}) {
  const router = useRouter();
  const readiness = trpc.campaigns.playReadiness.useQuery({ campaignId });
  const [showBlockers, setShowBlockers] = useState(false);

  const derived = readiness.data
    ? derivePlayReadiness(readiness.data)
    : null;

  const label = derived?.canContinue ? "Continue ▶" : "▶ Play Now";
  const href = `/campaigns/${campaignId}/play`;

  function onClick(event: React.MouseEvent) {
    if (!derived) return;
    if (derived.canContinue || derived.canFirstPlay) return;
    event.preventDefault();
    setShowBlockers(true);
  }

  function openTab(slug: CampaignTabSlug) {
    setShowBlockers(false);
    if (onOpenTab) onOpenTab(slug);
    else router.push(`/campaigns/${campaignId}?tab=${slug}`);
  }

  return (
    <>
      <Link
        href={href}
        onClick={onClick}
        className={
          className ??
          "shrink-0 rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent"
        }
      >
        {readiness.isLoading ? "Loading…" : label}
      </Link>
      {showBlockers && derived && derived.blockers.length > 0 ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[12vh]"
          role="dialog"
          aria-labelledby="play-gate-title"
        >
          <div className="w-full max-w-md rounded-lg border border-lore-border bg-lore-surface p-5 shadow-xl">
            <h3 id="play-gate-title" className="font-display text-lg">
              Before you play
            </h3>
            <p className="mt-2 text-sm text-lore-muted">
              Set up your campaign start, then add at least one player character
              to the party.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {derived.blockers.includes("starting_scene") ? (
                <li className="flex items-center justify-between gap-3 rounded border border-lore-border px-3 py-2">
                  <span>Choose a starting location</span>
                  <button
                    type="button"
                    onClick={() => openTab("settings")}
                    className="text-lore-accent underline"
                  >
                    Settings
                  </button>
                </li>
              ) : null}
              {derived.blockers.includes("party") ? (
                <li className="flex items-center justify-between gap-3 rounded border border-lore-border px-3 py-2">
                  <span>Add a player character</span>
                  <button
                    type="button"
                    onClick={() => openTab("party")}
                    className="text-lore-accent underline"
                  >
                    Party
                  </button>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => setShowBlockers(false)}
              className="mt-4 w-full rounded border border-lore-border px-3 py-2 text-sm hover:border-lore-accent"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
