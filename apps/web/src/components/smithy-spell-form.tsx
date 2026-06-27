"use client";

import { useState } from "react";

import {
  AREA_SHAPES,
  CASTING_TIME_UNITS,
  DAMAGE_TYPES,
  DURATION_UNITS,
  RANGE_TYPES,
  SAVE_OUTCOMES,
  SPELL_LEVELS,
  SPELL_SCHOOLS,
  TARGETING_TYPES,
  type ItemSource,
  type SpellDefinition,
  type SpellSchool,
} from "@app/engine";

import {
  emptySpellFormState,
  spellDefinitionToFormState,
  spellFormStateToPayload,
  type SmithySpellFormState,
} from "@/lib/smithy-spell-form-state";
import { trpc } from "@/lib/trpc/client";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function levelLabel(level: number): string {
  return level === 0 ? "Cantrip" : `Level ${level}`;
}

export function SmithySpellForm({
  mode,
  spellId,
  initial,
  onDone,
  onCancel,
  className,
}: {
  mode: "create" | "edit";
  spellId?: string;
  initial?: {
    definition: SpellDefinition;
    source: ItemSource;
    copiedFromSlug?: string | null;
  };
  onDone: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const create = trpc.smithy.createSpell.useMutation({
    onSuccess: async () => {
      await utils.smithy.listSpells.invalidate();
      onDone();
    },
  });
  const update = trpc.smithy.updateSpell.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.smithy.listSpells.invalidate(),
        utils.smithy.getSpell.invalidate({ id: row.id }),
      ]);
      onDone();
    },
  });

  const [form, setForm] = useState<SmithySpellFormState>(() =>
    initial?.definition
      ? spellDefinitionToFormState(initial.definition)
      : emptySpellFormState(),
  );
  const set = (patch: Partial<SmithySpellFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const timedDuration = (
    ["round", "minute", "hour", "day"] as const
  ).includes(form.durationUnit as "round" | "minute" | "hour" | "day");
  const rangedDistance =
    form.rangeType === "feet" || form.rangeType === "miles";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = spellFormStateToPayload(form);
    if (mode === "edit" && spellId) {
      update.mutate({
        id: spellId,
        ...payload,
        source: initial?.source ?? "original",
        copiedFromSlug: initial?.copiedFromSlug ?? undefined,
      });
      return;
    }
    create.mutate(payload);
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6 ${className ?? ""}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Level">
          <select
            value={form.level}
            onChange={(e) => set({ level: Number(e.target.value) })}
            className={inputClass}
          >
            {SPELL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="School">
          <select
            value={form.school}
            onChange={(e) => set({ school: e.target.value as SpellSchool })}
            className={`${inputClass} capitalize`}
          >
            {SPELL_SCHOOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Classes (comma-separated)">
        <input
          value={form.classesText}
          onChange={(e) => set({ classesText: e.target.value })}
          placeholder="sorcerer, wizard"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Casting time">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={form.castAmount}
              onChange={(e) => set({ castAmount: Number(e.target.value) })}
              className={`${inputClass} w-16`}
            />
            <select
              value={form.castUnit}
              onChange={(e) =>
                set({ castUnit: e.target.value as SmithySpellFormState["castUnit"] })
              }
              className={inputClass}
            >
              {CASTING_TIME_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Range">
          <div className="flex gap-2">
            <select
              value={form.rangeType}
              onChange={(e) =>
                set({ rangeType: e.target.value as SmithySpellFormState["rangeType"] })
              }
              className={inputClass}
            >
              {RANGE_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {rangedDistance && (
              <input
                type="number"
                min={0}
                value={form.rangeAmount}
                onChange={(e) => set({ rangeAmount: Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
            )}
          </div>
        </Field>
        <Field label="Targeting">
          <select
            value={form.targeting}
            onChange={(e) =>
              set({ targeting: e.target.value as SmithySpellFormState["targeting"] })
            }
            className={inputClass}
          >
            {TARGETING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded border border-lore-border/60 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.hasArea}
            onChange={(e) => set({ hasArea: e.target.checked })}
            className="accent-lore-accent"
          />
          Area of effect
        </label>
        {form.hasArea && (
          <div className="mt-3 flex gap-2">
            <select
              value={form.areaShape}
              onChange={(e) =>
                set({ areaShape: e.target.value as SmithySpellFormState["areaShape"] })
              }
              className={inputClass}
            >
              {AREA_SHAPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={form.areaSize}
              onChange={(e) => set({ areaSize: Number(e.target.value) })}
              className={`${inputClass} w-24`}
              aria-label="Area size in feet"
            />
            <span className="self-center text-xs text-lore-muted">ft</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Components">
          <div className="flex flex-wrap items-center gap-4 pt-1.5">
            <Check
              label="Verbal"
              checked={form.verbal}
              onChange={(verbal) => set({ verbal })}
            />
            <Check
              label="Somatic"
              checked={form.somatic}
              onChange={(somatic) => set({ somatic })}
            />
          </div>
          <input
            value={form.material}
            onChange={(e) => set({ material: e.target.value })}
            placeholder="Material (e.g. a pinch of sulfur)"
            className={`${inputClass} mt-2`}
          />
        </Field>
        <Field label="Duration">
          <div className="flex gap-2">
            <select
              value={form.durationUnit}
              onChange={(e) =>
                set({
                  durationUnit: e.target.value as SmithySpellFormState["durationUnit"],
                })
              }
              className={inputClass}
            >
              {DURATION_UNITS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {timedDuration && (
              <input
                type="number"
                min={1}
                value={form.durationAmount}
                onChange={(e) => set({ durationAmount: Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Check
              label="Concentration"
              checked={form.concentration}
              onChange={(concentration) => set({ concentration })}
            />
            <Check
              label="Ritual"
              checked={form.ritual}
              onChange={(ritual) => set({ ritual })}
            />
          </div>
        </Field>
      </div>

      <Field label="Resolution">
        <div className="flex flex-wrap items-center gap-4 pt-1.5">
          {(["none", "save", "attack"] as const).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="radio"
                name={`resolution-${spellId ?? "new"}`}
                checked={form.resolution === r}
                onChange={() => set({ resolution: r })}
                className="accent-lore-accent"
              />
              {r === "none" ? "No roll" : r}
            </label>
          ))}
        </div>
        {form.resolution === "save" && (
          <div className="mt-3 flex gap-2">
            <select
              value={form.saveAbility}
              onChange={(e) =>
                set({ saveAbility: e.target.value as SmithySpellFormState["saveAbility"] })
              }
              className={`${inputClass} uppercase`}
            >
              {ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={form.saveOutcome}
              onChange={(e) =>
                set({
                  saveOutcome: e.target.value as SmithySpellFormState["saveOutcome"],
                })
              }
              className={inputClass}
            >
              {SAVE_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="self-center whitespace-nowrap text-xs text-lore-muted">
              vs spell save DC
            </span>
          </div>
        )}
        {form.resolution === "attack" && (
          <select
            value={form.attackType}
            onChange={(e) =>
              set({
                attackType: e.target.value as SmithySpellFormState["attackType"],
              })
            }
            className={`${inputClass} mt-3 sm:w-48`}
          >
            <option value="ranged">Ranged spell attack</option>
            <option value="melee">Melee spell attack</option>
          </select>
        )}
      </Field>

      <Field label="Damage components">
        <div className="space-y-2">
          {form.damages.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={d.dice}
                onChange={(e) =>
                  set({
                    damages: form.damages.map((row, j) =>
                      j === i ? { ...row, dice: e.target.value } : row,
                    ),
                  })
                }
                placeholder="8d6"
                aria-label={`Damage component ${i + 1} dice`}
                className={`${inputClass} sm:w-32`}
              />
              <select
                value={d.type}
                onChange={(e) =>
                  set({
                    damages: form.damages.map((row, j) =>
                      j === i
                        ? {
                            ...row,
                            type: e.target.value as SmithySpellFormState["damages"][number]["type"],
                          }
                        : row,
                    ),
                  })
                }
                aria-label={`Damage component ${i + 1} type`}
                className={`${inputClass} capitalize`}
              >
                {DAMAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {form.damages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    set({
                      damages: form.damages.filter((_, j) => j !== i),
                    })
                  }
                  aria-label={`Remove damage component ${i + 1}`}
                  className="shrink-0 rounded border border-lore-border px-3 text-lore-muted transition-colors hover:text-lore-text"
                >
                  −
                </button>
              )}
            </div>
          ))}
        </div>
        {form.damages.length < 6 && (
          <button
            type="button"
            onClick={() =>
              set({
                damages: [...form.damages, { dice: "", type: "fire" }],
              })
            }
            className="mt-2 text-xs text-lore-accent hover:underline"
          >
            + Add damage component
          </button>
        )}
      </Field>

      <Field label="Healing dice">
        <input
          value={form.healingDice}
          onChange={(e) => set({ healingDice: e.target.value })}
          placeholder="1d8"
          className={`${inputClass} sm:w-48`}
        />
      </Field>

      <Field label="Upcast scaling (per slot above base)">
        <div className="flex gap-2">
          <input
            value={form.upcastDice}
            onChange={(e) => set({ upcastDice: e.target.value })}
            placeholder="1d6"
            className={`${inputClass} sm:w-32`}
          />
          <select
            value={form.upcastApplies}
            onChange={(e) =>
              set({
                upcastApplies: e.target.value as SmithySpellFormState["upcastApplies"],
              })
            }
            className={inputClass}
            disabled={!form.upcastDice.trim()}
          >
            <option value="damage">to damage</option>
            <option value="healing">to healing</option>
          </select>
        </div>
      </Field>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={4}
          placeholder="A bright streak flashes from your pointing finger…"
          className={inputClass}
        />
      </Field>

      {error ? <p className="text-sm text-red-400">{error.message}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted hover:text-lore-text"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {pending
            ? mode === "edit"
              ? "Saving…"
              : "Inscribing…"
            : mode === "edit"
              ? "Save changes"
              : "Inscribe spell"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-lore-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-lore-accent"
      />
      {label}
    </label>
  );
}
