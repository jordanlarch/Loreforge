/**
 * Resolve a character-sheet spell name to the live-play cast registry entry.
 */
import {
  CASTABLE_SPELLS,
  type CastableSpell,
} from "./live-combat";

/** Match a spellbook row to an engine-castable spell (case-insensitive). */
export function resolveCastableSpell(name: string): CastableSpell | undefined {
  const norm = name.trim().toLowerCase();
  if (!norm) return undefined;
  return CASTABLE_SPELLS.find((s) => s.name.toLowerCase() === norm);
}

/** Whether a spell row can be cast (cantrip, prepared, or always-prepared). */
export function spellRowIsCastable(spell: {
  level: number;
  prepared: boolean;
  alwaysPrepared?: boolean;
}): boolean {
  return spell.level === 0 || spell.prepared || Boolean(spell.alwaysPrepared);
}
