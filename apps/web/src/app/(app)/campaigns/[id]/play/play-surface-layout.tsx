"use client";

import type { ReactNode } from "react";

/**
 * Viewport-fit shell for live play: map on the left, scrollable sidebar controls
 * above a narrative chat panel pinned to the bottom of the right column.
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <section className="flex min-h-0 min-w-0 flex-[1.15] flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{map}</div>
          {mapFooter ? <div className="mt-1 shrink-0">{mapFooter}</div> : null}
        </section>
        <aside className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:max-w-md">
          <div className="min-h-0 shrink space-y-2 overflow-y-auto">{sidebar}</div>
          <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
        </aside>
      </div>
    </div>
  );
}
