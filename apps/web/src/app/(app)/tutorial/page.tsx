"use client";

/**
 * Tutorial splash (TUT-1, M6) — the entry point to "The Lantern's Last Flicker".
 *
 * Offers Play / Continue / Replay / Skip / Browse. Continue resumes an in-progress
 * run; Replay truncates engine + progress (coachmarks stay seen, #178).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { trpc } from "@/lib/trpc/client";

export default function TutorialSplashPage() {
  const router = useRouter();
  const progress = trpc.tutorial.get.useQuery();

  const start = trpc.tutorial.start.useMutation({
    onSuccess: () => router.push("/tutorial/play"),
  });
  const replay = trpc.tutorial.replay.useMutation({
    onSuccess: () => router.push("/tutorial/play?replay=1"),
  });
  const skip = trpc.tutorial.skip.useMutation({
    onSettled: () => router.push("/"),
  });

  const busy = start.isPending || replay.isPending || skip.isPending;
  const status = progress.data?.status;
  const hasCampaign = Boolean(progress.data?.campaignId);
  const inProgress = status === "in_progress" && hasCampaign;
  const showReplay = status === "completed" || status === "in_progress";

  function continueRun() {
    router.push("/tutorial/play");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-lore-muted">
        Tutorial Adventure
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        The Lantern&apos;s Last Flicker
      </h1>
      <p className="mt-4 max-w-prose text-lore-muted">
        A 30-minute guided adventure. Play as Mira Thornwood, a ranger arriving
        at a shadowed village whose great lantern has gone dark — and learn how
        to play along the way. The dice are real; the guide is patient.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {inProgress ? (
          <button
            type="button"
            onClick={continueRun}
            disabled={busy}
            className="rounded-lg border border-lore-accent bg-lore-accent-dim px-5 py-2.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
          >
            Continue from save
          </button>
        ) : (
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={busy}
            className="rounded-lg border border-lore-accent bg-lore-accent-dim px-5 py-2.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
          >
            {start.isPending ? "Lighting the lantern…" : "Begin the adventure"}
          </button>
        )}
        {showReplay && (
          <button
            type="button"
            onClick={() => replay.mutate()}
            disabled={busy}
            className="rounded-lg border border-lore-border px-5 py-2.5 text-sm text-lore-muted transition-colors hover:text-lore-text disabled:opacity-50"
          >
            {replay.isPending ? "Resetting…" : "Replay from start"}
          </button>
        )}
        <button
          type="button"
          onClick={() => skip.mutate()}
          disabled={busy}
          className="rounded-lg border border-lore-border px-5 py-2.5 text-sm text-lore-muted transition-colors hover:text-lore-text disabled:opacity-50"
        >
          Skip for now
        </button>
        <Link
          href="/codex"
          className="rounded-lg px-5 py-2.5 text-sm text-lore-muted transition-colors hover:text-lore-text"
        >
          Browse first
        </Link>
      </div>

      {(start.isError || replay.isError) && (
        <p className="mt-4 text-sm text-red-400">
          Couldn&apos;t start the tutorial. Please try again.
        </p>
      )}
    </div>
  );
}
