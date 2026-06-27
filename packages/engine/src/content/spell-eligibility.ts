/**
 * Character spellbook eligibility — which Codex spells a PC may learn based on
 * class list and effective caster level (CHAR-SPELL-GATE).
 */
import type { ClassLevel } from "../entities/types";
import { CLASS_SPELLCASTING_ABILITY } from "../entities/character-build";
import {
  sheetSlotPoolsFromClasses,
  multiclassCasterLevel,
} from "./multiclass-spell-slots";
import { warlockLevelFromClasses, warlockPactMagic } from "./warlock-pact-slots";

/** Classes on the sheet that contribute spellcasting (level > 0). */
export function spellcastingClasses(
  classes: readonly { class: string; level: number }[],
): string[] {
  return classes
    .filter(
      (c) =>
        c.level > 0 &&
        (c.class === "Warlock" || CLASS_SPELLCASTING_ABILITY[c.class] != null),
    )
    .map((c) => c.class);
}

/** Highest leveled spell slot the character can expend (0 = cantrips only). */
export function maxCastableSpellLevel(
  classes: readonly { class: string; level: number; subclass?: string }[],
): number {
  const list = [...classes];
  let max = 0;
  for (const [level, pool] of Object.entries(sheetSlotPoolsFromClasses(list))) {
    if (pool.max > 0) max = Math.max(max, parseInt(level, 10));
  }
  const wl = warlockLevelFromClasses(list);
  if (wl > 0) {
    const pact = warlockPactMagic(wl);
    if (pact) max = Math.max(max, pact.slotLevel);
  }
  return max;
}

function parseSpellLevel(level: string | number | null | undefined): number {
  if (level == null) return 0;
  const n = typeof level === "string" ? parseInt(level, 10) : level;
  return Number.isNaN(n) ? 0 : n;
}

/** Whether a Codex spell row may be added to this character's spellbook. */
export function isSpellEligibleForCharacter(
  spell: {
    level: string | number | null | undefined;
    classes?: readonly string[] | null;
  },
  characterClasses: readonly ClassLevel[],
): boolean {
  const casters = spellcastingClasses(characterClasses);
  if (casters.length === 0) return false;

  const spellClasses = spell.classes ?? [];
  if (spellClasses.length > 0) {
    const match = spellClasses.some((sc) =>
      casters.some((cc) => cc.toLowerCase() === sc.toLowerCase()),
    );
    if (!match) return false;
  }

  const spellLevel = parseSpellLevel(spell.level);
  const classList = [...characterClasses];
  if (spellLevel === 0) {
    return (
      multiclassCasterLevel(classList) > 0 ||
      warlockLevelFromClasses(classList) > 0
    );
  }

  return spellLevel <= maxCastableSpellLevel(classList);
}
