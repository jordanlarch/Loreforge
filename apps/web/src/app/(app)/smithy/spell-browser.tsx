"use client";

import Link from "next/link";
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
  type AreaShape,
  type CastingTimeUnit,
  type DamageType,
  type DurationUnit,
  type RangeType,
  type SaveOutcome,
  type SpellSchool,
  type TargetingType,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function levelLabel(level: number): string {
  return level === 0 ? "Cantrip" : `Level ${level}`;
}

export function SpellBrowser() {
  const [levelFilter, setLevelFilter] = useState<number | undefined>();
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | undefined>();
  const [inscribing, setInscribing] = useState(false);

  const list = trpc.smithy.listSpells.useQuery({
    level: levelFilter,
    school: schoolFilter,
  });

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
            Level
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={levelFilter === undefined}
              onClick={() => setLevelFilter(undefined)}
            >
              All
            </FilterChip>
            {SPELL_LEVELS.map((l) => (
              <FilterChip
                key={l}
                active={levelFilter === l}
                onClick={() => setLevelFilter(l)}
              >
                {l === 0 ? "C" : l}
              </FilterChip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
            School
          </div>
          <div className="space-y-1.5">
            <FilterChip
              active={schoolFilter === undefined}
              onClick={() => setSchoolFilter(undefined)}
              block
            >
              All
            </FilterChip>
            {SPELL_SCHOOLS.map((s) => (
              <FilterChip
                key={s}
                active={schoolFilter === s}
                onClick={() => setSchoolFilter(s)}
                block
              >
                <span className="capitalize">{s}</span>
              </FilterChip>
            ))}
          </div>
        </div>
      </aside>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${list.data?.length ?? 0} spell${
                  list.data?.length === 1 ? "" : "s"
                }`}
          </span>
          <button
            onClick={() => setInscribing((f) => !f)}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            {inscribing ? "Cancel" : "+ Inscribe New"}
          </button>
        </div>

        {inscribing && (
          <InscribeSpellForm onInscribed={() => setInscribing(false)} />
        )}

        {!list.isLoading && (list.data?.length ?? 0) === 0 && !inscribing ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No homebrew spells yet — inscribe your first into the grimoire.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((spell) => (
              <li key={spell.id}>
                <Link
                  href={`/smithy/spells/${spell.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg leading-tight">
                      {spell.name}
                    </span>
                    {spell.source === "codex" && (
                      <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
                        Copied
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-lore-muted">
                    {levelLabel(spell.level)} ·{" "}
                    <span className="capitalize">{spell.school}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

type Resolution = "none" | "save" | "attack";

function InscribeSpellForm({ onInscribed }: { onInscribed: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.smithy.createSpell.useMutation({
    onSuccess: async () => {
      await utils.smithy.listSpells.invalidate();
      onInscribed();
    },
  });

  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState<SpellSchool>("evocation");
  const [classesText, setClassesText] = useState("");
  const [castUnit, setCastUnit] = useState<CastingTimeUnit>("action");
  const [castAmount, setCastAmount] = useState(1);
  const [rangeType, setRangeType] = useState<RangeType>("feet");
  const [rangeAmount, setRangeAmount] = useState(60);
  const [hasArea, setHasArea] = useState(false);
  const [areaShape, setAreaShape] = useState<AreaShape>("sphere");
  const [areaSize, setAreaSize] = useState(20);
  const [verbal, setVerbal] = useState(true);
  const [somatic, setSomatic] = useState(true);
  const [material, setMaterial] = useState("");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("instantaneous");
  const [durationAmount, setDurationAmount] = useState(1);
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [targeting, setTargeting] = useState<TargetingType>("single");
  const [resolution, setResolution] = useState<Resolution>("none");
  const [saveAbility, setSaveAbility] = useState<Ability>("dex");
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome>("half_damage");
  const [attackType, setAttackType] = useState<"melee" | "ranged">("ranged");
  const [damages, setDamages] = useState<{ dice: string; type: DamageType }[]>([
    { dice: "", type: "fire" },
  ]);
  const [healingDice, setHealingDice] = useState("");
  const [upcastDice, setUpcastDice] = useState("");
  const [upcastApplies, setUpcastApplies] = useState<"damage" | "healing">(
    "damage",
  );
  const [description, setDescription] = useState("");

  const timedDuration = (
    ["round", "minute", "hour", "day"] as DurationUnit[]
  ).includes(durationUnit);
  const rangedDistance = rangeType === "feet" || rangeType === "miles";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      name: name.trim(),
      level,
      school,
      classes: classesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      castingTime: { unit: castUnit, amount: castAmount },
      range: {
        type: rangeType,
        amount: rangedDistance ? rangeAmount : undefined,
        area: hasArea ? { shape: areaShape, size: areaSize } : undefined,
      },
      components: {
        verbal,
        somatic,
        material: material.trim() || undefined,
      },
      duration: {
        unit: durationUnit,
        amount: timedDuration ? durationAmount : undefined,
      },
      concentration,
      ritual,
      targeting,
      saveAgainst:
        resolution === "save"
          ? { ability: saveAbility, dc: "spellsave", onSuccess: saveOutcome }
          : undefined,
      attackAgainst: resolution === "attack" ? { type: attackType } : undefined,
      damage: (() => {
        const rows = damages
          .map((d) => ({ dice: d.dice.trim(), type: d.type }))
          .filter((d) => d.dice);
        return rows.length > 0 ? rows : undefined;
      })(),
      healing: healingDice.trim() ? { dice: healingDice.trim() } : undefined,
      upcastScaling: upcastDice.trim()
        ? { perSlotDice: upcastDice.trim(), appliesTo: upcastApplies }
        : undefined,
      description: description.trim(),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Level">
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
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
            value={school}
            onChange={(e) => setSchool(e.target.value as SpellSchool)}
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
          value={classesText}
          onChange={(e) => setClassesText(e.target.value)}
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
              value={castAmount}
              onChange={(e) => setCastAmount(Number(e.target.value))}
              className={`${inputClass} w-16`}
            />
            <select
              value={castUnit}
              onChange={(e) => setCastUnit(e.target.value as CastingTimeUnit)}
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
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value as RangeType)}
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
                value={rangeAmount}
                onChange={(e) => setRangeAmount(Number(e.target.value))}
                className={`${inputClass} w-20`}
              />
            )}
          </div>
        </Field>
        <Field label="Targeting">
          <select
            value={targeting}
            onChange={(e) => setTargeting(e.target.value as TargetingType)}
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
            checked={hasArea}
            onChange={(e) => setHasArea(e.target.checked)}
            className="accent-lore-accent"
          />
          Area of effect
        </label>
        {hasArea && (
          <div className="mt-3 flex gap-2">
            <select
              value={areaShape}
              onChange={(e) => setAreaShape(e.target.value as AreaShape)}
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
              value={areaSize}
              onChange={(e) => setAreaSize(Number(e.target.value))}
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
            <Check label="Verbal" checked={verbal} onChange={setVerbal} />
            <Check label="Somatic" checked={somatic} onChange={setSomatic} />
          </div>
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Material (e.g. a pinch of sulfur)"
            className={`${inputClass} mt-2`}
          />
        </Field>
        <Field label="Duration">
          <div className="flex gap-2">
            <select
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
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
                value={durationAmount}
                onChange={(e) => setDurationAmount(Number(e.target.value))}
                className={`${inputClass} w-20`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Check
              label="Concentration"
              checked={concentration}
              onChange={setConcentration}
            />
            <Check label="Ritual" checked={ritual} onChange={setRitual} />
          </div>
        </Field>
      </div>

      <Field label="Resolution">
        <div className="flex flex-wrap items-center gap-4 pt-1.5">
          {(["none", "save", "attack"] as Resolution[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="radio"
                name="resolution"
                checked={resolution === r}
                onChange={() => setResolution(r)}
                className="accent-lore-accent"
              />
              {r === "none" ? "No roll" : r}
            </label>
          ))}
        </div>
        {resolution === "save" && (
          <div className="mt-3 flex gap-2">
            <select
              value={saveAbility}
              onChange={(e) => setSaveAbility(e.target.value as Ability)}
              className={`${inputClass} uppercase`}
            >
              {ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={saveOutcome}
              onChange={(e) => setSaveOutcome(e.target.value as SaveOutcome)}
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
        {resolution === "attack" && (
          <select
            value={attackType}
            onChange={(e) => setAttackType(e.target.value as "melee" | "ranged")}
            className={`${inputClass} mt-3 sm:w-48`}
          >
            <option value="ranged">Ranged spell attack</option>
            <option value="melee">Melee spell attack</option>
          </select>
        )}
      </Field>

      <Field label="Damage components">
        <div className="space-y-2">
          {damages.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={d.dice}
                onChange={(e) =>
                  setDamages((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, dice: e.target.value } : row,
                    ),
                  )
                }
                placeholder="8d6"
                aria-label={`Damage component ${i + 1} dice`}
                className={`${inputClass} sm:w-32`}
              />
              <select
                value={d.type}
                onChange={(e) =>
                  setDamages((prev) =>
                    prev.map((row, j) =>
                      j === i
                        ? { ...row, type: e.target.value as DamageType }
                        : row,
                    ),
                  )
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
              {damages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setDamages((prev) => prev.filter((_, j) => j !== i))
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
        {damages.length < 6 && (
          <button
            type="button"
            onClick={() =>
              setDamages((prev) => [...prev, { dice: "", type: "fire" }])
            }
            className="mt-2 text-xs text-lore-accent hover:underline"
          >
            + Add damage component
          </button>
        )}
      </Field>

      <Field label="Healing dice">
        <input
          value={healingDice}
          onChange={(e) => setHealingDice(e.target.value)}
          placeholder="1d8"
          className={`${inputClass} sm:w-48`}
        />
      </Field>

      <Field label="Upcast scaling (per slot above base)">
        <div className="flex gap-2">
          <input
            value={upcastDice}
            onChange={(e) => setUpcastDice(e.target.value)}
            placeholder="1d6"
            className={`${inputClass} sm:w-32`}
          />
          <select
            value={upcastApplies}
            onChange={(e) =>
              setUpcastApplies(e.target.value as "damage" | "healing")
            }
            className={inputClass}
            disabled={!upcastDice.trim()}
          >
            <option value="damage">to damage</option>
            <option value="healing">to healing</option>
          </select>
        </div>
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A bright streak flashes from your pointing finger…"
          className={inputClass}
        />
      </Field>

      {create.error && (
        <p className="text-sm text-red-400">{create.error.message}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {create.isPending ? "Inscribing…" : "Inscribe spell"}
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

function FilterChip({
  active,
  onClick,
  block = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  block?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-sm transition-colors ${
        block ? "block w-full text-left" : ""
      } ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
