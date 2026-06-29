/**
 * Fear/stress enter hooks (GRILL-LIVE-FEAR Q4/Q6/Q8).
 * WS reads location metadata → auto-applies for party PCs with scene binding.
 */
import type { Command } from "../commands/types";
import type { EntityRef, SceneId } from "../entities/types";
import type { CampaignStartingLocation } from "./exploration";

/** Demo dungeon fear slug when location metadata is absent (Q8). */
export const DEMO_DUNGEON_FEAR_STRESS_SLUGS = [
  "srd-2024_sarcophagus-apparition",
] as const;

function slugsFromEntityData(
  entityData?: Record<string, unknown>,
): string[] | undefined {
  const raw = entityData?.toolboxFearStressSlugs;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Resolve fear/stress slugs for a location enter (metadata → dungeon demo). */
export function resolveLocationFearStressSlugs(
  location: CampaignStartingLocation,
  entityData?: Record<string, unknown>,
): string[] {
  const fromData = slugsFromEntityData(entityData);
  if (fromData?.length) return fromData;
  if (location.type === "dungeon") {
    return [...DEMO_DUNGEON_FEAR_STRESS_SLUGS];
  }
  return [];
}

/** Auto-apply each slug to every party PC on enter (bound to scene for leave cleanup). */
export function buildFearStressEnterCommands(
  sceneId: SceneId,
  slugs: readonly string[],
  partyIds: readonly EntityRef[],
): Command[] {
  if (slugs.length === 0 || partyIds.length === 0) return [];
  const commands: Command[] = [];
  for (const target of partyIds) {
    for (const fearStressSlug of slugs) {
      commands.push({
        type: "apply_fear_stress",
        target,
        fearStressSlug,
        boundSceneId: sceneId,
      });
    }
  }
  return commands;
}
