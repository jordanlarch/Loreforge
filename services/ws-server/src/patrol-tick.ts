/**
 * DUN-6 — server-side patrol waypoint timer for dungeon exploration.
 */
import { DEFAULT_PATROL_INTERVAL_MS } from "@app/engine";

import type { CampaignRoom } from "./room.js";

const patrolTimers = new Map<string, ReturnType<typeof setInterval>>();

export function clearPatrolTimer(documentName: string): void {
  const timer = patrolTimers.get(documentName);
  if (timer) {
    clearInterval(timer);
    patrolTimers.delete(documentName);
  }
}

export function startPatrolTimer(
  documentName: string,
  room: CampaignRoom,
  onTick: () => Promise<void>,
  intervalMs = DEFAULT_PATROL_INTERVAL_MS,
): void {
  clearPatrolTimer(documentName);
  patrolTimers.set(
    documentName,
    setInterval(() => {
      void onTick();
    }, intervalMs),
  );
}

export async function resetPatrolsIfNeeded(room: CampaignRoom): Promise<void> {
  await room.resetPatrolsOnLoad();
}
