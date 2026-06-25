"use client";

/**
 * Combat tab (CHAR-7 tracer) — weapon attacks derived from equipped gear and
 * a death-save rules reference for out-of-combat sheet review.
 */
import { createEntityState, totalLevel, type ClassLevel } from "@app/engine";

import { deriveWeaponAttacks } from "@/lib/sheet-loadout";
import type { EquipmentItem } from "@/lib/character";

type CharacterCombatInput = {
  id: string;
  name: string;
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  maxHp: number;
  baseAc: number;
  speed: number;
  classes: ClassLevel[];
  equipment: EquipmentItem[];
};

const CASTER_ABILITY: Record<string, "int" | "wis" | "cha"> = {
  Bard: "cha",
  Cleric: "wis",
  Druid: "wis",
  Paladin: "cha",
  Ranger: "wis",
  Sorcerer: "cha",
  Warlock: "cha",
  Wizard: "int",
};

function combatEntity(character: CharacterCombatInput) {
  const level = totalLevel(character.classes);
  const primary = character.classes[0]?.class ?? "";
  const ability = CASTER_ABILITY[primary];
  return createEntityState({
    id: character.id,
    kind: "character",
    name: character.name,
    abilityScores: character.abilityScores,
    maxHp: character.maxHp,
    baseAc: character.baseAc,
    speed: character.speed,
    classes: character.classes,
    ...(ability
      ? { spellcasting: { ability, casterLevel: level } }
      : {}),
  });
}

export function CombatTab({
  character,
}: {
  character: CharacterCombatInput;
}) {
  const entity = combatEntity(character);
  const attacks = deriveWeaponAttacks(entity, character.equipment);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Weapon attacks
        </h2>
        <p className="mb-4 text-sm text-lore-muted">
          Derived from equipped weapons using the same catalog as Live Play. Proficiency
          is assumed for equipped weapons at this tracer depth.
        </p>
        <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
          {attacks.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="font-medium">{a.label}</span>
              <span className="text-lore-muted">{a.rangeFt} ft reach</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Death saves
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded border border-lore-border px-3 py-2">
            <dt className="text-lore-muted">At 0 HP</dt>
            <dd className="mt-1">
              Roll a d20 at the start of each of your turns: 10+ is a success, 9
              or lower is a failure. Three successes stabilize; three failures
              mean death.
            </dd>
          </div>
          <div className="rounded border border-lore-border px-3 py-2">
            <dt className="text-lore-muted">Natural 20 / 1</dt>
            <dd className="mt-1">
              A natural 20 regains 1 HP and ends the dying state. A natural 1
              counts as two failures.
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-lore-muted">
          Full SRD death-save depth (massive damage, stabilize action, crit-at-0)
          is tracked in deferrals ENG-8; the engine rolls saves in Live Play today.
        </p>
      </section>
    </div>
  );
}
