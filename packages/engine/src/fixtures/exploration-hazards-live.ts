/**
 * Exploration hazard Live Play hooks (GRILL-EXPLORATION Slice 3).
 * Scene chips + optional enter-time burning when location metadata requests it.
 */
import { BURNING_SLUG } from "../content/srd-exploration-hazard-seeds";
import type { Command } from "../commands/types";
import type { EntityRef } from "../entities/types";
import type { CampaignStartingLocation } from "./exploration";

/** Scene subtitle / top-bar chip when dungeon metadata is absent (Q8-style demo). */
export const DEMO_DUNGEON_EXPLORATION_HAZARD_SCENE_SLUGS = [
  BURNING_SLUG,
] as const;

function slugsFromEntityData(
  entityData: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const raw = entityData?.[key];
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Ambient hazard labels for scene UI (metadata → dungeon demo chip). */
export function resolveLocationExplorationHazardSlugs(
  location: CampaignStartingLocation,
  entityData?: Record<string, unknown>,
): string[] {
  const fromData = slugsFromEntityData(entityData, "explorationHazardSlugs");
  if (fromData?.length) return fromData;
  if (location.type === "dungeon") {
    return [...DEMO_DUNGEON_EXPLORATION_HAZARD_SCENE_SLUGS];
  }
  return [];
}

/** Burning slugs that auto-apply on enter (explicit metadata only — not the demo chip). */
export function resolveLocationExplorationBurningSlugs(
  entityData?: Record<string, unknown>,
): string[] {
  return slugsFromEntityData(entityData, "explorationBurningSlugs") ?? [];
}

/** Auto-apply burning exposure for party PCs on enter (when metadata requests it). */
export function buildExplorationBurningEnterCommands(
  partyIds: readonly EntityRef[],
  slugs: readonly string[],
): Command[] {
  if (slugs.length === 0 || partyIds.length === 0) return [];
  const commands: Command[] = [];
  for (const target of partyIds) {
    for (const burningSlug of slugs) {
      if (burningSlug !== BURNING_SLUG) continue;
      commands.push({ type: "apply_burning", target, burningSlug });
    }
  }
  return commands;
}
