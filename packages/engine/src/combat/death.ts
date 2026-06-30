/**
 * Pure helpers for dying, death saves, and concentration (architecture.md §6.4).
 *
 * No state, no randomness: the d20 / damage values are drawn upstream; these
 * helpers just interpret them per the SRD.
 */

export type DeathSaveTally = { successes: number; failures: number };

export type DeathSaveResolution = {
  successes: number;
  failures: number;
  /** Three successes — stabilized at 0 HP. */
  stable: boolean;
  /** Three failures — dead. */
  dead: boolean;
  /** Natural 20 — regain 1 HP and stand back up. */
  revived: boolean;
};

/**
 * Resolve a death saving throw from the natural d20 face and the current tally.
 * SRD: 10+ succeeds, <10 fails, a natural 1 counts as two failures, a natural 20
 * regains 1 HP. Three successes stabilize; three failures kill.
 */
export function resolveDeathSave(
  natural: number,
  current: DeathSaveTally,
): DeathSaveResolution {
  if (natural === 20) {
    return { successes: 0, failures: 0, stable: false, dead: false, revived: true };
  }

  let successes = current.successes;
  let failures = current.failures;
  if (natural === 1) failures += 2;
  else if (natural >= 10) successes += 1;
  else failures += 1;

  const dead = failures >= 3;
  const stable = !dead && successes >= 3;
  return {
    successes: Math.min(3, successes),
    failures: Math.min(3, failures),
    stable,
    dead,
    revived: false,
  };
}

/** Concentration save DC from incoming damage: max(10, floor(damage / 2)). */
export function concentrationDC(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/**
 * Death-save failures from damage taken while at 0 HP (SRD p.17).
 * A critical hit inflicts two failures; otherwise one.
 */
export function failuresFromDamageAtZeroHp(critical: boolean): number {
  return critical ? 2 : 1;
}

/**
 * Instant death when a single effect drops a creature to 0 HP and overflow
 * damage equals or exceeds its HP maximum (SRD p.17).
 */
export function overflowDamageWhenDropped(
  amount: number,
  hpBefore: number,
  tempHp: number,
): number {
  const fromTemp = Math.min(tempHp, amount);
  const toCurrent = amount - fromTemp;
  return Math.max(0, toCurrent - hpBefore);
}

export function isInstantDeathFromDamage(
  amount: number,
  maxHp: number,
  hpBefore: number,
  tempHp: number,
  hpAfter: number,
): boolean {
  if (hpBefore === 0 || hpAfter > 0) return false;
  return overflowDamageWhenDropped(amount, hpBefore, tempHp) >= maxHp;
}
