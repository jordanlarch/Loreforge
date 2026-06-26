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
import type { PartyRosterRow } from "@/lib/live-party";

import { WorldMapCanvas } from "../world-map-canvas";
import { CharacterRail } from "./character-rail";
import { PlayLightbox } from "./play-lightbox";
import { PlayMapZone } from "./play-map-zone";
import { PlayNavRail } from "./play-nav-rail";
import { PlayPanelContent } from "./play-panel-content";
import { PlaySurfaceLayout } from "./play-surface-layout";
import { PartyRail } from "./party-rail";

type PlayShellChromeProps = {
  campaignId?: string;
  header: ReactNode;
  state: WorldState;
  partyRoster?: readonly PartyRosterRow[];
  companionExpected?: boolean;
  onViewSheet?: (characterId: string) => void;
  onEnterLocation?: (entityId: string) => void;
  onOpenCharacterSheet?: () => void;
  combatStrip?: ReactNode;
  mapCurrent: ReactNode;
  mapFooter?: ReactNode;
  actionBar?: ReactNode;
  chat: ReactNode;
  characterRail: ReactNode;
};

/**
 * Play shell chrome (CAMP-UX UX-1): left nav, Current|World map tabs, lightboxes,
 * collapsible character rail wrapper.
 */
export function PlayShellChrome({
  campaignId,
  header,
  state,
  partyRoster,
  companionExpected,
  onViewSheet,
  onEnterLocation,
  onOpenCharacterSheet,
  combatStrip,
  mapCurrent,
  mapFooter,
  actionBar,
  chat,
  characterRail,
}: PlayShellChromeProps) {
  const [mapTab, setMapTab] = useState<PlayMapTab>("current");
  const [lightbox, setLightbox] = useState<PlayNavId | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);

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
            onSelect={handleNav}
          />
        }
        combatStrip={combatStrip}
        mapZone={
          <PlayMapZone
            mapTab={mapTab}
            onMapTabChange={setMapTab}
            partyChips={
              <div data-coachmark="tut-party">
                <PartyRail
                  state={state}
                  roster={partyRoster}
                  layout="row"
                  companionExpected={companionExpected}
                  onViewSheet={onViewSheet}
                />
              </div>
            }
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
          <CharacterRail collapsed={railCollapsed} onToggle={toggleRail}>
            {characterRail}
          </CharacterRail>
        }
      />

      {lightbox && lightboxTitle && campaignId ? (
        <PlayLightbox
          title={lightboxTitle}
          open
          onClose={() => setLightbox(null)}
          footer={
            <Link
              href={`/campaigns/${campaignId}`}
              className="text-sm text-lore-accent underline"
            >
              Back to prep
            </Link>
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
