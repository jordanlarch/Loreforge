"use client";

/**
 * Scene transition banner (PLAY-8, #103) — the location pill that drops in over
 * the map zone when the scene advances. Mounts hidden, then slides/fades into
 * view so it reads as a "drop from the top" without needing a global keyframe.
 */
import { useEffect, useState } from "react";

import type { SceneBannerInfo } from "./use-scene-transition";

export function SceneBanner({ banner }: { banner: SceneBannerInfo | null }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!banner) {
      setShown(false);
      return;
    }
    // Next frame: flip to the visible state so the transition animates.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [banner]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
      <div
        className={`mt-3 rounded-full border border-lore-accent bg-lore-surface/95 px-4 py-1.5 text-center text-sm shadow-lg transition-all duration-500 ${
          shown ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
      >
        <span className="text-lore-text">📍 {banner.name}</span>
        {banner.subtitle && (
          <span className="text-lore-muted"> · {banner.subtitle}</span>
        )}
      </div>
    </div>
  );
}
