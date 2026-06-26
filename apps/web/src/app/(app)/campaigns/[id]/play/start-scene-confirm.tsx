"use client";

import Link from "next/link";

/**
 * First-play confirmation lightbox (CAMP-UX UX-5): shown when gates pass but the
 * engine log is still empty. Confirms the authored start scene before WS seed.
 */
export function StartSceneConfirm({
  campaignId,
  locationName,
  onBegin,
}: {
  campaignId: string;
  locationName: string;
  onBegin: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh]"
      role="dialog"
      aria-labelledby="start-scene-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-lore-accent bg-lore-surface p-6 shadow-xl">
        <h2 id="start-scene-title" className="font-display text-2xl">
          Begin the campaign
        </h2>
        <p className="mt-3 text-sm text-lore-muted">
          Your party will open at{" "}
          <strong className="text-lore-text">{locationName}</strong>. The
          Game Master will greet you there — combat and travel unfold on the map
          above chat.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBegin}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm font-medium text-lore-text hover:border-lore-accent"
          >
            Begin at {locationName}
          </button>
          <Link
            href={`/campaigns/${campaignId}?tab=settings`}
            className="rounded border border-lore-border px-4 py-2 text-sm hover:border-lore-accent"
          >
            Change start location
          </Link>
        </div>
      </div>
    </div>
  );
}
