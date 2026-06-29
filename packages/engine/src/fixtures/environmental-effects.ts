/**
 * Environmental effect enter hooks (GRILL-LIVE-ENV-EFFECT Q4/Q6/Q8).
 * WS reads location metadata → sets scene slugs → auto-applies for party PCs.
 */
import type { Command } from "../commands/types";
import type { EntityRef, SceneId } from "../entities/types";
import type { CampaignStartingLocation } from "./exploration";

/** Demo dungeon ambient pair when location metadata is absent (Q8). */
export const DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS = [
  "srd-2024_extreme-cold",
  "srd-2024_slippery-ice",
] as const;

function slugsFromEntityData(
  entityData?: Record<string, unknown>,
): string[] | undefined {
  const raw = entityData?.toolboxEnvironmentalEffectSlugs;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Resolve ambient effect slugs for a location enter (metadata → dungeon demo). */
export function resolveLocationEnvironmentalEffectSlugs(
  location: CampaignStartingLocation,
  entityData?: Record<string, unknown>,
): string[] {
  const fromData = slugsFromEntityData(entityData);
  if (fromData?.length) return fromData;
  if (location.type === "dungeon") {
    return [...DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS];
  }
  return [];
}

/** Set scene ambient slugs and apply each slug to every party PC on enter. */
export function buildEnvironmentalEffectEnterCommands(
  sceneId: SceneId,
  slugs: readonly string[],
  partyIds: readonly EntityRef[],
): Command[] {
  if (slugs.length === 0 || partyIds.length === 0) return [];
  const commands: Command[] = [
    { type: "set_scene_environmental_effects", sceneId, slugs: [...slugs] },
  ];
  for (const target of partyIds) {
    for (const effectSlug of slugs) {
      commands.push({ type: "apply_environmental_effect", target, effectSlug });
    }
  }
  return commands;
}
