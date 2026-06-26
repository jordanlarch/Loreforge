"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/client";
import type { PlayNavId } from "@/lib/play-shell";

import { HooksTab } from "../hooks-tab";
import { NotesTab } from "../notes-tab";
import { PartyTab } from "../party-tab";
import { SessionsTab } from "../sessions-tab";
import { SettingsTab } from "../settings-tab";
import { WorldMapCanvas } from "../world-map-canvas";
import { WorldTab } from "../world-tab";

/**
 * Lightbox bodies for play-shell nav items (CAMP-UX UX-1).
 */
export function PlayPanelContent({
  panel,
  campaignId,
  onEnterLocation,
  onClose,
}: {
  panel: PlayNavId;
  campaignId: string;
  onEnterLocation?: (entityId: string) => void;
  onClose: () => void;
}) {
  const access = trpc.campaigns.access.useQuery({ campaignId });

  switch (panel) {
    case "party":
      return <PartyTab campaignId={campaignId} />;
    case "quests":
      return <HooksTab campaignId={campaignId} />;
    case "world":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-lore-muted">
            Discovered locations in this campaign. Enter a site to travel there
            without leaving play.
          </p>
          <WorldTab
            campaignId={campaignId}
            variant="play"
            onEnterLocation={(id) => {
              onEnterLocation?.(id);
              onClose();
            }}
          />
          <div className="h-[min(40vh,20rem)]">
            <WorldMapCanvas
              campaignId={campaignId}
              fill
              onEnterLocation={(id) => {
                onEnterLocation?.(id);
                onClose();
              }}
            />
          </div>
        </div>
      );
    case "memories":
      return <PlayMemoriesPanel campaignId={campaignId} />;
    case "sessions":
      return <SessionsTab campaignId={campaignId} />;
    case "notes":
      return <NotesTab campaignId={campaignId} />;
    case "settings":
      return access.data?.role === "owner" ? (
        <SettingsTab campaignId={campaignId} />
      ) : (
        <p className="text-sm text-lore-muted">
          Campaign settings are available to the campaign owner in prep.
        </p>
      );
    default:
      return null;
  }
}

function PlayMemoriesPanel({ campaignId }: { campaignId: string }) {
  const pins = trpc.pins.list.useQuery({ campaignId });

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-sm font-medium text-lore-text">Pinned facts</h3>
        {pins.isLoading ? (
          <p className="mt-2 text-sm text-lore-muted">Loading…</p>
        ) : (pins.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-lore-muted">No pinned memories yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {(pins.data ?? []).map((pin) => (
              <li
                key={pin.id}
                className="rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
              >
                {pin.content}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        href={`/campaigns/${campaignId}?tab=settings`}
        className="text-sm text-lore-accent underline"
      >
        Export full memory in prep Settings →
      </Link>
    </div>
  );
}
