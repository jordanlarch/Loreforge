"use client";

import { useMemo, useState } from "react";

import { createEntityState, totalLevel, type ClassLevel } from "@app/engine";

import {
  SheetSearchBar,
  SheetSection,
  SheetTableHeader,
  ResourceBoxes,
  StubBanner,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
import { deriveWeaponAttacks } from "@/lib/sheet-loadout";
import type { EquipmentItem } from "@/lib/character";
import type { ActiveEffect, CharacterSheetMeta } from "@/lib/character-sheet-storage";

type CombatInput = {
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

const STANDARD_ACTIONS =
  "Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize";

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function CombatTab({
  character,
  meta,
  onPatchMeta,
}: {
  character: CombatInput;
  meta: CharacterSheetMeta;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
}) {
  const [search, setSearch] = useState("");
  const entity = useMemo(
    () =>
      createEntityState({
        id: character.id,
        kind: "character",
        name: character.name,
        abilityScores: character.abilityScores,
        maxHp: character.maxHp,
        baseAc: character.baseAc,
        speed: character.speed,
        classes: character.classes,
      }),
    [character],
  );
  const attacks = deriveWeaponAttacks(entity, character.equipment);
  const filteredAttacks = useSheetSearch(attacks, search, (a) => a.label);

  const deathSaves = meta.deathSaves ?? { successes: 0, failures: 0 };
  const effects = meta.activeEffects ?? [];

  function toggleDeathSave(field: "successes" | "failures", index: number) {
    const current = deathSaves[field];
    const next = current === index ? index - 1 : index + 1;
    onPatchMeta({
      deathSaves: { ...deathSaves, [field]: Math.max(0, Math.min(3, next)) },
    });
  }

  function toggleEffect(id: string) {
    onPatchMeta({
      activeEffects: effects.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e,
      ),
    });
  }

  function addEffect() {
    const id = `fx-${Date.now()}`;
    onPatchMeta({
      activeEffects: [
        ...effects,
        { id, name: "New effect", mod: "", affects: "", enabled: true },
      ],
    });
  }

  return (
    <div>
      <SheetSearchBar value={search} onChange={setSearch} />

      <SheetSection title="Attacks">
        <SheetTableHeader
          columns={[
            { label: "Name", className: "col-span-3" },
            { label: "Range" },
            { label: "Hit / DC" },
            { label: "Damage" },
          ]}
        />
        {filteredAttacks.length === 0 ? (
          <p className="text-sm text-lore-muted">No weapon attacks derived.</p>
        ) : (
          <ul className="divide-y divide-lore-border">
            {filteredAttacks.map((a) => (
              <li
                key={a.id}
                className="grid grid-cols-6 items-center gap-2 py-2 text-sm"
              >
                <span className="col-span-3 font-medium">{a.label.split(" · ")[0]}</span>
                <span className="text-lore-muted">{a.rangeFt} ft</span>
                <span className="text-lore-accent">{fmtMod(a.attackBonus)}</span>
                <span className="text-red-300">{a.damage.notation}</span>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      <div className="mt-4">
        <SheetSection title="Weapon Mastery">
          <p className="text-sm text-lore-muted">No masteries</p>
          <StubBanner>2024 weapon mastery properties ship with full SRD item ingest.</StubBanner>
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Effects" onAdd={addEffect}>
          {effects.length === 0 ? (
            <p className="text-sm text-lore-muted">No active effects.</p>
          ) : (
            <ul className="space-y-2">
              {effects.map((e) => (
                <EffectRow key={e.id} effect={e} onToggle={() => toggleEffect(e.id)} />
              ))}
            </ul>
          )}
        </SheetSection>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SheetSection title="Actions">
          <p className="text-sm text-lore-muted">{STANDARD_ACTIONS}</p>
        </SheetSection>
        <SheetSection title="Reactions">
          <p className="text-sm text-lore-muted">Opportunity Attack</p>
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Bonus Actions">
          <StubBanner>
            Class bonus actions (Second Wind, etc.) appear under Features with use
            trackers. Short/long rest buttons on the HP panel refresh resources.
          </StubBanner>
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Death Saves">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <div className="mb-1 text-lore-muted">Successes</div>
              <DeathSaveDots
                count={deathSaves.successes}
                onClick={(i) => toggleDeathSave("successes", i)}
              />
            </div>
            <div>
              <div className="mb-1 text-lore-muted">Failures</div>
              <DeathSaveDots
                count={deathSaves.failures}
                onClick={(i) => toggleDeathSave("failures", i)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-lore-muted">
            Click dots to track manual death saves out of combat. Live Play uses
            the engine tracker.
          </p>
        </SheetSection>
      </div>
    </div>
  );
}

function EffectRow({
  effect,
  onToggle,
}: {
  effect: ActiveEffect;
  onToggle: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-lore-border px-3 py-2 text-sm">
      <input type="checkbox" checked={effect.enabled} onChange={onToggle} />
      <span className="font-medium">{effect.name}</span>
      {effect.mod && <span className="text-lore-accent">{effect.mod}</span>}
      {effect.affects && (
        <span className="text-lore-muted">{effect.affects}</span>
      )}
    </li>
  );
}

function DeathSaveDots({
  count,
  onClick,
}: {
  count: number;
  onClick: (index: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onClick(i)}
          className={`h-4 w-4 rounded-full border ${
            i < count
              ? "border-emerald-500 bg-emerald-500/80"
              : "border-lore-muted bg-transparent"
          }`}
          aria-label={`Death save ${i + 1}`}
        />
      ))}
    </div>
  );
}
