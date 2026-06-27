/**
 * Class-feature resource tracking — spend uses and refresh on rest.
 * Sheet meta stores `resourceUses[featureKey]` as boolean[] (true = spent).
 */
import type { ClassFeature } from "./class-features";
import { classFeaturesForLevel } from "./class-features";
import type { ClassLevel } from "./types";

/** Stable key for a class feature row on the character sheet. */
export function featureResourceKey(
  className: string,
  level: number,
  featureId: string,
): string {
  return `${className}-${level}-${featureId}`;
}

/** Parse {@link featureResourceKey} back into parts. */
export function parseFeatureResourceKey(key: string): {
  className: string;
  level: number;
  featureId: string;
} | null {
  const match = key.match(/^(.+)-(\d+)-(.+)$/);
  if (!match) return null;
  return {
    className: match[1]!,
    level: parseInt(match[2]!, 10),
    featureId: match[3]!,
  };
}

/** Map feature resource keys → recharge cadence for a character's classes. */
export function featureRechargeMap(
  classes: ClassLevel[],
): Record<string, ClassFeature["recharge"]> {
  const map: Record<string, ClassFeature["recharge"]> = {};
  for (const cl of classes) {
    for (let level = 1; level <= cl.level; level++) {
      for (const f of classFeaturesForLevel(cl.class, level)) {
        if (f.uses != null && f.uses > 0 && f.recharge) {
          map[featureResourceKey(cl.class, level, f.id)] = f.recharge;
        }
      }
    }
  }
  return map;
}

/** How many uses remain (unspent slots). */
export function remainingFeatureUses(
  used: boolean[] | undefined,
  total: number,
): number {
  const slots = used ?? Array.from({ length: total }, () => false);
  return slots.filter((s) => !s).length;
}

/**
 * Spend one use. Returns the updated slot array, or null when all uses are spent.
 */
export function spendFeatureUse(
  used: boolean[] | undefined,
  total: number,
): boolean[] | null {
  const slots = [...(used ?? Array.from({ length: total }, () => false))];
  const idx = slots.findIndex((s) => !s);
  if (idx < 0) return null;
  slots[idx] = true;
  return slots;
}

type RestKind = "short_rest" | "long_rest";

/** Reset spent slots whose feature recharges on this rest kind. */
export function refreshResourceUsesOnRest(
  resourceUses: Record<string, boolean[]> | undefined,
  rechargeByKey: Record<string, ClassFeature["recharge"] | undefined>,
  rest: RestKind,
): Record<string, boolean[]> {
  const uses = resourceUses ?? {};
  const next: Record<string, boolean[]> = { ...uses };
  for (const [key, slots] of Object.entries(uses)) {
    const recharge = rechargeByKey[key];
    const shouldRefresh =
      rest === "long_rest" ||
      (rest === "short_rest" && recharge === "short_rest");
    if (!shouldRefresh) continue;
    next[key] = slots.map(() => false);
  }
  return next;
}
