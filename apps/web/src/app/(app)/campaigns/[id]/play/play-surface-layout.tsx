"use client";

import type { ReactNode } from "react";

/**
 * Viewport-fit play shell (CAMP-UX UX-1): left nav · center (map above chat) ·
 * collapsible right character rail.
 */
export function PlaySurfaceLayout({
  header,
  leftNav,
  combatStrip,
  mapZone,
  mapFooter,
  actionBar,
  chat,
  characterRail,
}: {
  header: ReactNode;
  leftNav: ReactNode;
  /** Initiative strip — full width above map in center column. */
  combatStrip?: ReactNode;
  /** Map zone includes Current | World tabs and map body. */
  mapZone: ReactNode;
  mapFooter?: ReactNode;
  actionBar?: ReactNode;
  chat: ReactNode;
  characterRail: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-5.25rem)] w-full max-w-[100rem] flex-col overflow-hidden px-1 py-1 sm:px-2">
      <div className="shrink-0">{header}</div>
      <div className="flex min-h-0 flex-1 gap-0">
        {leftNav}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 px-1 sm:px-2">
          {combatStrip ? <div className="shrink-0">{combatStrip}</div> : null}
          <div className="flex min-h-0 flex-[1.05] flex-col">{mapZone}</div>
          {mapFooter ? <div className="shrink-0">{mapFooter}</div> : null}
          {actionBar ? <div className="shrink-0">{actionBar}</div> : null}
          <div className="flex min-h-0 min-h-[28vh] flex-1 flex-col">{chat}</div>
        </div>
        {characterRail}
      </div>
    </div>
  );
}
