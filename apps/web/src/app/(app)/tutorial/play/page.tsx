"use client";

/**
 * Tutorial play route (TUT-1, M6). Resolves the current user's seeded tutorial
 * campaign (via `tutorial.get`) and mounts the shared Live Play surface against
 * it. If the user hasn't started yet, it points them back to the splash.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { TutorialPlaySurface } from "@/app/(app)/campaigns/[id]/play/play-surface";
import { trpc } from "@/lib/trpc/client";

export default function TutorialPlayPage() {
  const progress = trpc.tutorial.get.useQuery();
  const searchParams = useSearchParams();
  const replayFromStart = searchParams.get("replay") === "1";

  if (progress.isLoading) {
    return (
      <p className="px-4 py-16 text-center text-lore-muted">
        Loading your adventure…
      </p>
    );
  }

  const campaignId = progress.data?.campaignId;
  const skipped = progress.data?.status === "skipped";
  if (!campaignId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">
          {skipped ? "Tutorial skipped" : "The lantern isn&apos;t lit yet"}
        </h1>
        <p className="mt-4 text-lore-muted">
          {skipped
            ? "You skipped the guided adventure. Mira is on your Characters list if you kept her — or begin the tutorial from the splash anytime."
            : "You haven&apos;t started the tutorial. Begin it from the splash."}
        </p>
        <p className="mt-6 text-sm">
          <Link className="text-lore-accent underline" href="/tutorial">
            Go to the tutorial
          </Link>
        </p>
      </div>
    );
  }

  return (
    <TutorialPlaySurface
      campaignId={campaignId}
      replayFromStart={replayFromStart}
    />
  );
}
