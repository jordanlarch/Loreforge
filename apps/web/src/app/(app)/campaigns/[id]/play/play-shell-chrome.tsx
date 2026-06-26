"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import type { WorldState } from "@app/engine";

import {
  playNavLightboxTitle,
  readRailCollapsed,
  writeRailCollapsed,
  type PlayMapTab,
  type PlayNavId,
} from "@/lib/play-shell";
import type { CampaignAccessRole } from "@/lib/campaign-access";
import type { PartyRosterRow } from "@/lib/live-party";
import { trpc } from "@/lib/trpc/client";

import { WorldMapCanvas } from "../world-map-canvas";
import { PlayLightbox } from "./play-lightbox";
import { PlayMapZone } from "./play-map-zone";
import { PlayNavRail } from "./play-nav-rail";
import { PlayPanelContent } from "./play-panel-content";
import { PlayRightRail } from "./play-right-rail";
import { PlaySurfaceLayout } from "./play-surface-layout";

type PlayShellChromeProps = {
  campaignId?: string;
  header: ReactNode;
  state: WorldState;
  partyRoster?: readonly PartyRosterRow[];
  companionExpected?: boolean;
  pcCharacterId?: string;
  onViewSheet?: (characterId: string) => void;
  onEnterLocation?: (entityId: string) => void;
  onOpenCharacterSheet?: () => void;
  playerHudExtra?: ReactNode;
  tutorialControls?: ReactNode;
  combatStrip?: ReactNode;
  mapCurrent: ReactNode;
  mapFooter?: ReactNode;
  actionBar?: ReactNode;
  chat: ReactNode;
};

/**
 * Play shell chrome (CAMP-UX UX-1): left nav, Current|World map tabs, lightboxes,
 * unified collapsible party rail on the right.
 */
export function PlayShellChrome({
  campaignId,
  header,
  state,
  partyRoster,
  companionExpected,
  pcCharacterId,
  onViewSheet,
  onEnterLocation,
  onOpenCharacterSheet,
  playerHudExtra,
  tutorialControls,
  combatStrip,
  mapCurrent,
  mapFooter,
  actionBar,
  chat,
}: PlayShellChromeProps) {
  const [mapTab, setMapTab] = useState<PlayMapTab>("current");
  const [lightbox, setLightbox] = useState<PlayNavId | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const access = trpc.campaigns.access.useQuery(
    { campaignId: campaignId ?? "" },
    { enabled: Boolean(campaignId) },
  );
  const accessRole = access.data?.role as CampaignAccessRole | null | undefined;

  useEffect(() => {
    setRailCollapsed(readRailCollapsed(campaignId));
  }, [campaignId]);

  function toggleRail() {
    setRailCollapsed((prev) => {
      const next = !prev;
      writeRailCollapsed(campaignId, next);
      return next;
    });
  }

  function handleNav(id: PlayNavId) {
    if (id === "play") {
      setLightbox(null);
      setMapTab("current");
      return;
    }
    if (id === "character") {
      setLightbox(null);
      onOpenCharacterSheet?.();
      return;
    }
    setLightbox(id);
  }

  function handleEnterLocation(entityId: string) {
    onEnterLocation?.(entityId);
    setMapTab("current");
    setLightbox(null);
  }

  const lightboxTitle = lightbox ? playNavLightboxTitle(lightbox) : null;

  return (
    <>
      <PlaySurfaceLayout
        header={header}
        leftNav={
          <PlayNavRail
            active={lightbox}
            campaignId={campaignId}
            role={accessRole}
            onSelect={handleNav}
          />
        }
        combatStrip={combatStrip}
        mapZone={
          <PlayMapZone
            mapTab={mapTab}
            onMapTabChange={setMapTab}
            currentMap={mapCurrent}
            worldMap={
              campaignId ? (
                <WorldMapCanvas
                  campaignId={campaignId}
                  fill
                  onEnterLocation={handleEnterLocation}
                />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-lore-muted">
                  World map is available in campaign play.
                </p>
              )
            }
          />
        }
        mapFooter={mapFooter}
        actionBar={actionBar}
        chat={chat}
        characterRail={
          <div data-coachmark="tut-party">
            <PlayRightRail
              state={state}
              roster={partyRoster}
              pcCharacterId={pcCharacterId}
              companionExpected={companionExpected}
              onViewSheet={onViewSheet}
              onOpenCharacterSheet={onOpenCharacterSheet}
              playerHudExtra={playerHudExtra}
              tutorialControls={tutorialControls}
              collapsed={railCollapsed}
              onToggle={toggleRail}
            />
          </div>
        }
      />

      {lightbox && lightboxTitle && campaignId ? (
        <PlayLightbox
          title={lightboxTitle}
          open
          onClose={() => setLightbox(null)}
          footer={
            accessRole === "owner" ? (
              <Link
                href={`/campaigns/${campaignId}`}
                className="text-sm text-lore-accent underline"
              >
                Back to prep
              </Link>
            ) : (
              <Link
                href="/campaigns"
                className="text-sm text-lore-accent underline"
              >
                Back to campaigns
              </Link>
            )
          }
        >
          <PlayPanelContent
            panel={lightbox}
            campaignId={campaignId}
            onEnterLocation={handleEnterLocation}
            onClose={() => setLightbox(null)}
          />
        </PlayLightbox>
      ) : null}
    </>
  );
}
