import {
  getEnvironmentalEffectDefinition,
  type ActiveEnvironmentalEffectInstance,
} from "@app/engine";

export function environmentalEffectLabel(slug: string): string {
  return getEnvironmentalEffectDefinition(slug)?.name ?? slug;
}

/** Comma-separated ambient labels for scene subtitle / top-bar chips (Q5). */
export function formatSceneEnvironmentalEffects(
  slugs?: readonly string[],
): string | undefined {
  if (!slugs?.length) return undefined;
  return slugs.map(environmentalEffectLabel).join(", ");
}

/** HUD label for an active environmental effect instance on the party rail. */
export function activeEnvironmentalEffectHudLabel(
  instance: ActiveEnvironmentalEffectInstance,
): string {
  const name = environmentalEffectLabel(instance.effectSlug);
  return instance.pendingRepeat ? `Exposed — ${name}` : name;
}
