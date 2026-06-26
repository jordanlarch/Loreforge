/**
 * Route sheet Cast actions to the live engine when possible, else arm targeting.
 */
import type { CastableSpell } from "./live-combat";

export type SheetCastSession = {
  castSpell: (
    casterId: string,
    spellId: string,
    level: number,
    targetIds: string[],
  ) => void;
  sendChat: (text: string, intent?: string) => void;
};

/** Resolve a prepared spell cast from the character sheet overlay. */
export function handleSheetSpellCast(
  spell: CastableSpell,
  casterEntityId: string,
  session: SheetCastSession,
  armForTargeting: (spell: CastableSpell) => void,
): void {
  const selfOnly =
    spell.targetKind === "self" && !spell.area && spell.rangeFt === 0;

  if (selfOnly || (spell.reaction && spell.targetKind === "self")) {
    session.castSpell(casterEntityId, spell.id, spell.level, [
      casterEntityId,
    ]);
    return;
  }

  if (spell.area) {
    armForTargeting(spell);
    return;
  }

  armForTargeting(spell);
}
