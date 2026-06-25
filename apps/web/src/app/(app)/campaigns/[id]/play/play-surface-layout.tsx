"use client";

import type { ReactNode } from "react";

/**
 * Viewport-fit shell for live play: party rail on the left, map centered in the
 * middle, tutorial/HUD controls on the right, and chat spanning the full lower
 * pane.
 */
export function PlaySurfaceLayout({
  header,
  combatStrip,
  partyRail,
  map,
  mapFooter,
  sidebar,
  actionBar,
  chat,
}: {
  header: ReactNode;
  /** Round + initiative tracker — full width above map / party row. */
  combatStrip?: ReactNode;
  partyRail?: ReactNode;
  map: ReactNode;
  mapFooter?: ReactNode;
  sidebar?: ReactNode;
  /** Attack / cast / economy / end turn — full width above chat. */
  actionBar?: ReactNode;
  chat: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-5.25rem)] w-full max-w-[96rem] flex-col overflow-hidden px-2 py-1 sm:px-3">
      <div className="shrink-0">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        {combatStrip ? <div className="shrink-0">{combatStrip}</div> : null}
        <div className="flex min-h-0 flex-[1.08] gap-2 lg:gap-3">
          {partyRail ? (
            <aside className="w-[8.25rem] shrink-0 sm:w-[9.5rem] lg:w-40">
              {partyRail}
            </aside>
          ) : null}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{map}</div>
            {mapFooter ? <div className="mt-0.5 shrink-0">{mapFooter}</div> : null}
          </section>
          {sidebar ? (
            <aside className="flex w-52 shrink-0 flex-col gap-1.5 overflow-y-auto lg:w-60">
              {sidebar}
            </aside>
          ) : null}
        </div>
        {actionBar ? <div className="shrink-0">{actionBar}</div> : null}
        <div className="flex min-h-0 min-h-[30vh] flex-1 flex-col">{chat}</div>
      </div>
    </div>
  );
}
