"use client";

import type { ReactNode } from "react";

/**
 * Viewport-fit shell for live play: map (+ optional sidebar controls) on top,
 * narrative chat spanning the full width of the lower pane so combat HUD rows
 * cannot squeeze the log to a few lines.
 */
export function PlaySurfaceLayout({
  header,
  partyRail,
  map,
  mapFooter,
  sidebar,
  chat,
}: {
  header: ReactNode;
  partyRail?: ReactNode;
  map: ReactNode;
  mapFooter?: ReactNode;
  sidebar: ReactNode;
  chat: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] max-w-6xl flex-col overflow-hidden px-4 py-2">
      <div className="shrink-0">{header}</div>
      {partyRail ? <div className="mb-2 shrink-0">{partyRail}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-[1.05] flex-col gap-3 lg:min-h-0 lg:flex-row lg:gap-4">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{map}</div>
            {mapFooter ? <div className="mt-1 shrink-0">{mapFooter}</div> : null}
          </section>
          <aside className="flex min-h-0 max-h-[38vh] min-w-0 shrink-0 flex-col gap-2 overflow-y-auto lg:max-h-none lg:w-80">
            {sidebar}
          </aside>
        </div>
        <div className="flex min-h-0 min-h-[34vh] flex-1 flex-col lg:min-h-[30vh]">
          {chat}
        </div>
      </div>
    </div>
  );
}
