/**
 * Class-feature resource tracking — spend uses and refresh on rest.
 * Sheet meta stores `resourceUses[featureKey]` as boolean[] (true = spent).
 */
import {
  focusPointMaximum,
  layOnHandsMaximum,
  sorceryPointMaximum,
  classLevel,
} from "../combat/class-feature-mechanics";
import type { ClassFeature } from "./class-features";
import { classFeaturesForLevel } from "./class-features";
import type { ClassLevel } from "./types";
import type { EntityState } from "./types";

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
  const slots = normalizeUseSlots(used, total);
  return slots.filter((s) => !s).length;
}

/** Normalize a slot array to the expected pool size. */
export function normalizeUseSlots(
  used: boolean[] | undefined,
  total: number,
): boolean[] {
  const slots = [...(used ?? [])];
  while (slots.length < total) slots.push(false);
  if (slots.length > total) return slots.slice(0, total);
  return slots;
}

/** Dynamic pool size for Focus Points / Sorcery Points; falls back to catalog `uses`. */
export function featurePoolSize(
  featureKey: string,
  classes: ClassLevel[],
): number | undefined {
  const parsed = parseFeatureResourceKey(featureKey);
  if (!parsed) return undefined;
  if (parsed.featureId === "monk-s-focus") {
    return focusPointMaximum(classLevel(classes, "Monk"));
  }
  if (parsed.featureId === "font-of-magic") {
    return sorceryPointMaximum(classLevel(classes, "Sorcerer"));
  }
  if (parsed.featureId === "lay-on-hands") {
    return layOnHandsMaximum(classLevel(classes, "Paladin"));
  }
  return undefined;
}

export function effectiveFeaturePoolSize(
  featureKey: string,
  classes: ClassLevel[],
  catalogUses: number | undefined,
): number {
  return featurePoolSize(featureKey, classes) ?? catalogUses ?? 0;
}

/** Spend one use from an entity's feature pool; returns updated resourceUses map. */
export function spendEntityFeaturePool(
  entity: EntityState,
  featureKey: string,
  catalogUses: number,
): { ok: true; resourceUses: Record<string, boolean[]> } | { ok: false; message: string } {
  const poolSize = effectiveFeaturePoolSize(
    featureKey,
    entity.classes,
    catalogUses,
  );
  const remaining = remainingFeatureUses(
    entity.resourceUses?.[featureKey],
    poolSize,
  );
  if (remaining <= 0) {
    return { ok: false, message: "No uses remaining." };
  }
  const spent = spendFeatureUse(entity.resourceUses?.[featureKey], poolSize);
  if (!spent) {
    return { ok: false, message: "No uses remaining." };
  }
  return {
    ok: true,
    resourceUses: {
      ...(entity.resourceUses ?? {}),
      [featureKey]: spent,
    },
  };
}

/**
 * Spend multiple pool points (Lay on Hands HP, etc.). Returns updated slots or null.
 */
export function spendFeaturePoolPoints(
  used: boolean[] | undefined,
  poolSize: number,
  points: number,
): boolean[] | null {
  if (points <= 0) return null;
  const slots = normalizeUseSlots(used, poolSize);
  const remaining = slots.filter((s) => !s).length;
  if (points > remaining) return null;
  let spent = 0;
  for (let i = 0; i < slots.length && spent < points; i++) {
    if (!slots[i]) {
      slots[i] = true;
      spent += 1;
    }
  }
  return spent === points ? slots : null;
}

/**
 * Spend one use. Returns the updated slot array, or null when all uses are spent.
 */
export function spendFeatureUse(
  used: boolean[] | undefined,
  total: number,
): boolean[] | null {
  const slots = normalizeUseSlots(used, total);
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
