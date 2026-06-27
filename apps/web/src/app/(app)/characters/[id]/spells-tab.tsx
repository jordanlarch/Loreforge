"use client";

/**
 * Spells tab (#56 schema → CHAR-7). Edits the unified `spells` loadout (known/
 * prepared list + per-level slot pools) as a local draft, committed via
 * `characters.update`. The deterministic engine still owns cast resolution; this
 * is the character's spellbook of record.
 */
import { useMemo, useState } from "react";

import type { CharacterSheet } from "@app/engine";
import {
  multiclassCasterLevel,
  sheetSlotPoolsFromClasses,
  spellcastingAbilityForClasses,
  warlockLevelFromClasses,
  warlockPactMagic,
} from "@app/engine";

import {
  CodexSpellAddPicker,
  SmithySpellAddPicker,
} from "@/components/character-library-pickers";
import {
  SheetSearchBar,
  SheetSection,
  SheetTag,
} from "@/components/character-sheet/sheet-ui";
import {
  blankSpell,
  groupSpellsByLevel,
  spellLevelLabel,
  SPELL_LEVELS,
  type CharacterSpell,
  type SpellLoadout,
} from "@/lib/character";
import {
  resolveCastableSpell,
  spellRowIsCastable,
} from "@/lib/spell-cast-sheet";
import type { CastableSpell } from "@/lib/live-combat";
import type { PactMagicPool } from "@/lib/character-sheet-storage";

export function SpellsTab({
  spells,
  sheet,
  classes,
  pactMagic,
  onPatchPactMagic,
  saving,
  onSave,
  onCastSpell,
}: {
  spells: SpellLoadout;
  sheet?: CharacterSheet;
  classes?: { class: string; level: number }[];
  pactMagic?: PactMagicPool | null;
  onPatchPactMagic?: (pool: PactMagicPool | null) => void;
  saving: boolean;
  onSave: (spells: SpellLoadout) => void;
  /** Live Play: post spell cast intent to campaign chat. */
  onCastSpell?: (spell: CastableSpell) => void;
}) {
  const [draft, setDraft] = useState<SpellLoadout>(spells);
  const [codexOpen, setCodexOpen] = useState(false);
  const [smithyOpen, setSmithyOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(spells);

  function addSpell(spell: CharacterSpell) {
    setDraft((d) => ({ ...d, spells: [...d.spells, spell] }));
  }

  function patchSpell(index: number, fields: Partial<CharacterSpell>) {
    setDraft((d) => ({
      ...d,
      spells: d.spells.map((s, i) => (i === index ? { ...s, ...fields } : s)),
    }));
  }

  function setSlot(level: number, field: "max" | "used", value: number) {
    setDraft((d) => {
      const key = String(level);
      const current = d.slots[key] ?? { max: 0, used: 0 };
      return {
        ...d,
        slots: { ...d.slots, [key]: { ...current, [field]: Math.max(0, value) } },
      };
    });
  }

  function clean(loadout: SpellLoadout): SpellLoadout {
    const slots: SpellLoadout["slots"] = {};
    for (const [key, slot] of Object.entries(loadout.slots)) {
      if (slot.max > 0) slots[key] = { max: slot.max, used: Math.min(slot.used, slot.max) };
    }
    return {
      spells: loadout.spells
        .filter((s) => s.name.trim().length > 0)
        .map((s) => ({
          ...s,
          name: s.name.trim(),
          source: s.source?.trim() || undefined,
        })),
      slots,
    };
  }

  const grouped = groupSpellsByLevel(draft.spells);
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        spells: g.spells.filter((s) => s.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.spells.length > 0);
  }, [grouped, search]);

  const castingAbility = classes
    ? spellcastingAbilityForClasses(classes)
    : null;
  const spellMod =
    sheet && castingAbility
      ? {
          ability: castingAbility.toUpperCase(),
          mod: sheet.abilityModifiers[castingAbility],
        }
      : sheet
        ? sheet.abilityModifiers.int >= sheet.abilityModifiers.wis
          ? sheet.abilityModifiers.int >= sheet.abilityModifiers.cha
            ? { ability: "INT", mod: sheet.abilityModifiers.int }
            : { ability: "CHA", mod: sheet.abilityModifiers.cha }
          : { ability: "WIS", mod: sheet.abilityModifiers.wis }
        : null;
  const saveDc = spellMod ? 8 + sheet!.proficiencyBonus + spellMod.mod : null;
  const casterLevel = classes ? multiclassCasterLevel(classes) : 0;
  const warlockLevel = classes ? warlockLevelFromClasses(classes) : 0;
  const suggestedPact =
    warlockLevel > 0 ? warlockPactMagic(warlockLevel) : null;

  function applySuggestedSlots() {
    if (!classes?.length) return;
    const suggested = sheetSlotPoolsFromClasses(classes);
    setDraft((d) => {
      const slots = { ...d.slots };
      for (const [level, pool] of Object.entries(suggested)) {
        const prev = slots[level] ?? { max: 0, used: 0 };
        slots[level] = { max: pool.max, used: Math.min(prev.used, pool.max) };
      }
      return { ...d, slots };
    });
    if (suggestedPact && onPatchPactMagic) {
      onPatchPactMagic({
        max: suggestedPact.max,
        used: pactMagic?.used ?? 0,
        slotLevel: suggestedPact.slotLevel,
      });
    }
  }

  return (
    <div>
      {sheet && spellMod && (
        <div className="mb-4 flex flex-wrap justify-end gap-4 text-sm">
          <span>
            Spell Save DC{" "}
            <strong className="text-lore-accent">{saveDc}</strong>
          </span>
          <span>
            {spellMod.ability}{" "}
            <strong>{spellMod.mod >= 0 ? `+${spellMod.mod}` : spellMod.mod}</strong>
          </span>
        </div>
      )}

      <SheetSearchBar value={search} onChange={setSearch} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-lore-muted">
          {draft.spells.length} spell{draft.spells.length === 1 ? "" : "s"} known
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(spells)}
              className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:text-lore-text"
            >
              Revert
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(clean(draft))}
            disabled={!dirty || saving}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      {/* Spell slot pools */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs uppercase tracking-widest text-lore-muted">
            Spell Slots
          </h3>
          {classes && casterLevel > 0 && (
            <button
              type="button"
              onClick={applySuggestedSlots}
              className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
            >
              Apply PHB slots (Lv {casterLevel})
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {SPELL_LEVELS.map((level) => {
            const slot = draft.slots[String(level)] ?? { max: 0, used: 0 };
            return (
              <div
                key={level}
                className={`rounded-lg border p-2 text-center ${
                  slot.max > 0
                    ? "border-lore-border bg-lore-surface"
                    : "border-dashed border-lore-border opacity-60"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest text-lore-muted">
                  Lvl {level}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    aria-label={`Level ${level} slots used`}
                    value={slot.used}
                    onChange={(e) =>
                      setSlot(level, "used", Number(e.target.value) || 0)
                    }
                    className={`${INPUT} w-12 text-center`}
                  />
                  <span className="text-lore-muted">/</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    aria-label={`Level ${level} slots max`}
                    value={slot.max}
                    onChange={(e) =>
                      setSlot(level, "max", Number(e.target.value) || 0)
                    }
                    className={`${INPUT} w-12 text-center`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-lore-muted">Used / Max per spell level.</p>
      </section>

      {suggestedPact && (
        <section className="mb-6 rounded-lg border border-lore-accent/30 bg-lore-accent-dim/20 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs uppercase tracking-widest text-lore-muted">
              Pact Magic (Warlock {warlockLevel})
            </h3>
            {!pactMagic && onPatchPactMagic && (
              <button
                type="button"
                onClick={() => onPatchPactMagic(suggestedPact)}
                className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent"
              >
                Apply pact slots
              </button>
            )}
          </div>
          <p className="text-sm">
            {pactMagic?.max ?? suggestedPact.max} slot
            {(pactMagic?.max ?? suggestedPact.max) === 1 ? "" : "s"} · cast
            at level {pactMagic?.slotLevel ?? suggestedPact.slotLevel}
          </p>
          {pactMagic && onPatchPactMagic && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-lore-muted">Used</span>
              <input
                type="number"
                min={0}
                max={pactMagic.max}
                value={pactMagic.used}
                onChange={(e) =>
                  onPatchPactMagic({
                    ...pactMagic,
                    used: Math.min(
                      pactMagic.max,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
                className={`${INPUT} w-12 text-center`}
              />
              <span className="text-lore-muted">/ {pactMagic.max}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-lore-muted">
            Pact slots refresh on short rest and are separate from pooled
            multiclass slots.
          </p>
        </section>
      )}

      {/* Known / prepared spells, grouped by level */}
      {draft.spells.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted">
          No spells yet.
        </p>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map((group) => (
            <SheetSection
              key={group.level}
              title={spellLevelLabel(group.level)}
            >
              <ul className="space-y-2">
                {group.spells.map((spell) => {
                  const index = draft.spells.indexOf(spell);
                  const castable =
                    onCastSpell &&
                    spellRowIsCastable(spell) &&
                    resolveCastableSpell(spell.name);
                  return (
                    <li
                      key={index}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-lore-border bg-lore-surface p-3"
                    >
                      <input
                        value={spell.name}
                        onChange={(e) =>
                          patchSpell(index, { name: e.target.value })
                        }
                        placeholder="Spell name"
                        className={`${INPUT} min-w-[160px] flex-1`}
                      />
                      {(spell.concentration || spell.ritual) && (
                        <span className="flex gap-1">
                          {spell.concentration && (
                            <SheetTag label="C" title="Concentration" />
                          )}
                          {spell.ritual && (
                            <SheetTag label="R" title="Ritual" />
                          )}
                        </span>
                      )}
                      <select
                        aria-label="Spell level"
                        value={spell.level}
                        onChange={(e) =>
                          patchSpell(index, { level: Number(e.target.value) })
                        }
                        className={INPUT}
                      >
                        <option value={0}>Cantrip</option>
                        {SPELL_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            Level {l}
                          </option>
                        ))}
                      </select>
                      <input
                        value={spell.source ?? ""}
                        onChange={(e) =>
                          patchSpell(index, { source: e.target.value })
                        }
                        placeholder="Source"
                        className={`${INPUT} w-28`}
                      />
                      <label className="flex items-center gap-1.5 text-sm text-lore-muted">
                        <input
                          type="checkbox"
                          checked={spell.prepared}
                          onChange={(e) =>
                            patchSpell(index, { prepared: e.target.checked })
                          }
                        />
                        Prepared
                      </label>
                      {castable && (
                        <button
                          type="button"
                          onClick={() => onCastSpell!(castable)}
                          className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-1 text-xs text-lore-text"
                        >
                          Cast
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            spells: d.spells.filter((_, j) => j !== index),
                          }))
                        }
                        aria-label={`Remove ${spell.name || "spell"}`}
                        className="rounded px-2 py-1 text-lore-muted transition-colors hover:text-red-400"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ ...d, spells: [...d.spells, blankSpell(0)] }))
          }
          className="rounded border border-dashed border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          + Add spell
        </button>
        <button
          type="button"
          onClick={() => setCodexOpen(true)}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Add from Codex
        </button>
        <button
          type="button"
          onClick={() => setSmithyOpen(true)}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Add from Smithy
        </button>
      </div>

      {codexOpen && (
        <CodexSpellAddPicker
          existing={draft.spells}
          characterClasses={classes}
          onAdd={addSpell}
          onClose={() => setCodexOpen(false)}
        />
      )}
      {smithyOpen && (
        <SmithySpellAddPicker
          existing={draft.spells}
          onAdd={addSpell}
          onClose={() => setSmithyOpen(false)}
        />
      )}
    </div>
  );
}

const INPUT =
  "rounded border border-lore-border bg-lore-bg px-2 py-1.5 text-sm text-lore-text outline-none focus:border-lore-accent";
