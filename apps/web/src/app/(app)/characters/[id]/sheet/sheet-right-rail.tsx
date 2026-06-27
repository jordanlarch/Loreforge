"use client";

import type { CharacterSheet } from "@app/engine";

import {
  SheetTag,
  StubBanner,
} from "@/components/character-sheet/sheet-ui";
import type {
  CharacterSheetMeta,
  Defenses,
  ProficiencyTags,
  Senses,
} from "@/lib/character-sheet-storage";

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function SheetRightRail({
  sheet,
  meta,
  inspiration,
  onPatchMeta,
  liveConditions,
  effectiveAc,
  effectiveInitiative,
  effectiveSpeed,
  passivePerceptionBonus = 0,
  passiveInvestigationBonus = 0,
}: {
  sheet: CharacterSheet;
  meta: CharacterSheetMeta;
  inspiration: boolean;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
  /** When set (Live Play), show engine-tracked conditions instead of the stub. */
  liveConditions?: { condition: string; level?: number }[];
  effectiveAc?: number;
  effectiveInitiative?: number;
  effectiveSpeed?: number;
  passivePerceptionBonus?: number;
  passiveInvestigationBonus?: number;
}) {
  const perception = sheet.skills.find((s) => s.skill === "Perception");
  const investigation = sheet.skills.find((s) => s.skill === "Investigation");
  const insight = sheet.skills.find((s) => s.skill === "Insight");

  const passivePerc =
    10 + (perception?.modifier ?? sheet.abilityModifiers.wis) + passivePerceptionBonus;
  const passiveInv =
    10 +
    (investigation?.modifier ?? sheet.abilityModifiers.int) +
    passiveInvestigationBonus;
  const passiveIns = 10 + (insight?.modifier ?? sheet.abilityModifiers.wis);

  const ac = effectiveAc ?? sheet.ac;
  const speed = effectiveSpeed ?? sheet.speed;
  const initiative = effectiveInitiative ?? sheet.initiative;

  const defenses = meta.defenses ?? {};
  const senses = meta.senses ?? {};
  const prof = meta.proficiencies ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Armor Class" value={String(ac)} />
        <StatBox label="Speed (ft)" value={String(speed)} />
        <StatBox label="Initiative" value={signed(initiative)} highlight />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={inspiration}
          onChange={(e) => onPatchMeta({ inspiration: e.target.checked })}
        />
        Inspiration
      </label>

      <DefenseBlock
        title="Defenses"
        defenses={defenses}
        onChange={(d) => onPatchMeta({ defenses: { ...defenses, ...d } })}
      />

      <section className="rounded-lg border border-lore-border bg-lore-surface p-3">
        <h3 className="mb-2 text-[10px] uppercase tracking-widest text-lore-muted">
          Conditions
        </h3>
        {liveConditions && liveConditions.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {liveConditions.map((c) => (
              <SheetTag
                key={`${c.condition}-${c.level ?? 0}`}
                label={
                  c.level != null && c.level > 0
                    ? `${c.condition} ${c.level}`
                    : c.condition
                }
              />
            ))}
          </ul>
        ) : liveConditions ? (
          <p className="text-sm text-lore-muted">No active conditions.</p>
        ) : (
          <>
            <p className="text-sm text-lore-muted">No conditions (out of combat).</p>
            <StubBanner>
              Live conditions sync from the engine during Live Play.
            </StubBanner>
          </>
        )}
      </section>

      <section className="rounded-lg border border-lore-border bg-lore-surface p-3">
        <h3 className="mb-2 text-[10px] uppercase tracking-widest text-lore-muted">
          Passive Senses
        </h3>
        <dl className="space-y-1 text-sm">
          <Row label="Investigation" value={String(passiveInv)} />
          <Row label="Insight" value={String(passiveIns)} />
          <Row label="Perception" value={String(passivePerc)} />
        </dl>
        <SensesBlock
          senses={senses}
          onChange={(s) => onPatchMeta({ senses: { ...senses, ...s } })}
        />
      </section>

      <ProficienciesBlock
        prof={prof}
        onChange={(p) => onPatchMeta({ proficiencies: { ...prof, ...p } })}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center ${
        highlight
          ? "border-red-500/50 bg-red-950/30"
          : "border-lore-border bg-lore-surface"
      }`}
    >
      <div className="text-[10px] uppercase text-lore-muted">{label}</div>
      <div className="font-display text-xl tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-lore-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function DefenseBlock({
  title,
  defenses,
  onChange,
}: {
  title: string;
  defenses: Partial<Defenses>;
  onChange: (d: Partial<Defenses>) => void;
}) {
  const fields: { key: keyof Defenses; label: string }[] = [
    { key: "resistances", label: "Resistances" },
    { key: "vulnerabilities", label: "Vulnerabilities" },
    { key: "immunities", label: "Immunities" },
    { key: "conditionImmunities", label: "Condition immunities" },
  ];

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-3">
      <h3 className="mb-2 text-[10px] uppercase tracking-widest text-lore-muted">
        {title}
      </h3>
      <div className="space-y-2">
        {fields.map(({ key, label }) => (
          <label key={key} className="block text-xs">
            <span className="text-lore-muted">{label}</span>
            <input
              defaultValue={defenses[key] ?? ""}
              onBlur={(e) => onChange({ [key]: e.target.value.trim() })}
              className="mt-0.5 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function SensesBlock({
  senses,
  onChange,
}: {
  senses: Partial<Senses>;
  onChange: (s: Partial<Senses>) => void;
}) {
  const fields: { key: keyof Senses; label: string }[] = [
    { key: "darkvision", label: "Darkvision" },
    { key: "blindsight", label: "Blindsight" },
    { key: "tremorsense", label: "Tremorsense" },
    { key: "truesight", label: "Truesight" },
  ];

  return (
    <div className="mt-3 space-y-2 border-t border-lore-border pt-2">
      {fields.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-lore-muted">{label}</span>
          <input
            defaultValue={senses[key] ?? ""}
            placeholder="—"
            onBlur={(e) => onChange({ [key]: e.target.value.trim() })}
            className="w-24 rounded border border-lore-border bg-lore-bg px-2 py-0.5 text-right text-sm"
          />
        </label>
      ))}
    </div>
  );
}

function ProficienciesBlock({
  prof,
  onChange,
}: {
  prof: Partial<ProficiencyTags>;
  onChange: (p: Partial<ProficiencyTags>) => void;
}) {
  const groups: { key: keyof ProficiencyTags; label: string; defaults: string[] }[] =
    [
      { key: "weapons", label: "Weapons", defaults: ["Simple", "Martial"] },
      { key: "armor", label: "Armor", defaults: ["Light", "Medium", "Shields"] },
      { key: "tools", label: "Tools", defaults: [] },
      { key: "languages", label: "Languages", defaults: ["Common"] },
    ];

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-3">
      <h3 className="mb-2 text-[10px] uppercase tracking-widest text-lore-muted">
        Proficiencies &amp; Languages
      </h3>
      {groups.map(({ key, label, defaults }) => {
        const tags = prof[key]?.length ? prof[key]! : defaults;
        return (
          <div key={key} className="mb-3">
            <div className="mb-1 text-xs text-lore-muted">{label}</div>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <SheetTag key={t} label={t} />
              ))}
            </div>
            <input
              defaultValue={tags.join(", ")}
              placeholder="Comma-separated"
              onBlur={(e) =>
                onChange({
                  [key]: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs"
            />
          </div>
        );
      })}
    </section>
  );
}
