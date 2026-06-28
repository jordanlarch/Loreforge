"use client";

import { useState } from "react";

import {
  DAMAGE_TYPES,
  POISON_TYPES,
  TRAP_RESET_MODES,
  type GameplayToolboxEntryDefinition,
  type ItemSource,
  type PoisonDefinition,
  type PoisonType,
  type TrapDefinition,
  type ToolboxTopic,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const SAVE_OUTCOMES = ["none", "half", "negates"] as const;

export type SmithyToolboxFormInitial = {
  name: string;
  topic: ToolboxTopic;
  description: string;
  source: ItemSource;
  copiedFromSlug?: string | null;
  definition: GameplayToolboxEntryDefinition;
};

function trapFromDefinition(def: GameplayToolboxEntryDefinition): TrapDefinition {
  if (def.kind !== "trap") {
    return {
      kind: "trap",
      id: def.id,
      name: def.name,
      description: def.description,
      trigger: "",
      effect: {},
      reset: "once",
    };
  }
  return def;
}

export function SmithyToolboxForm({
  initial,
  entryId,
  onSaved,
  onCancel,
}: {
  initial?: SmithyToolboxFormInitial;
  entryId?: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const kind = initial?.definition.kind ?? "trap";
  if (kind === "poison") {
    return (
      <SmithyPoisonToolboxForm
        initial={initial}
        entryId={entryId}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    );
  }

  return (
    <SmithyTrapToolboxForm
      initial={initial}
      entryId={entryId}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function SmithyTrapToolboxForm({
  initial,
  entryId,
  onSaved,
  onCancel,
}: {
  initial?: SmithyToolboxFormInitial;
  entryId?: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const trap = trapFromDefinition(
    initial?.definition ?? {
      kind: "trap",
      id: "new-trap",
      name: "",
      description: "",
      trigger: "",
      effect: {},
      reset: "once",
    },
  );

  const [name, setName] = useState(initial?.name ?? trap.name);
  const [description, setDescription] = useState(
    initial?.description ?? trap.description,
  );
  const [trigger, setTrigger] = useState(trap.trigger);
  const [reset, setReset] = useState<TrapDefinition["reset"]>(trap.reset);
  const [resetInterval, setResetInterval] = useState(trap.resetInterval ?? "");
  const [saveAbility, setSaveAbility] = useState(
    trap.effect.save?.ability ?? "dex",
  );
  const [saveDc, setSaveDc] = useState(
    trap.effect.save ? String(trap.effect.save.dc) : "",
  );
  const [saveOnSuccess, setSaveOnSuccess] = useState<
    NonNullable<TrapDefinition["effect"]["save"]>["onSuccess"]
  >(trap.effect.save?.onSuccess ?? "negates");
  const [damageDice, setDamageDice] = useState(
    trap.effect.damage?.[0]?.dice ?? "",
  );
  const [damageType, setDamageType] = useState(
    trap.effect.damage?.[0]?.type ?? "poison",
  );
  const [conditions, setConditions] = useState(
    trap.effect.conditions?.join(", ") ?? "",
  );
  const [effectProse, setEffectProse] = useState(trap.effect.effectProse ?? "");
  const [detectDc, setDetectDc] = useState(
    trap.detect ? String(trap.detect.dc) : "",
  );
  const [detectAbility, setDetectAbility] = useState(
    trap.detect?.ability ?? "wis",
  );
  const [detectSkill, setDetectSkill] = useState(trap.detect?.skill ?? "Perception");
  const [disableDc, setDisableDc] = useState(
    trap.disable ? String(trap.disable.dc) : "",
  );
  const [disableAbility, setDisableAbility] = useState(
    trap.disable?.ability ?? "dex",
  );
  const [disableTool, setDisableTool] = useState(
    trap.disable?.tool ?? "Thieves' Tools",
  );
  const [error, setError] = useState<string | null>(null);

  const create = trpc.smithy.createToolboxEntry.useMutation({
    onSuccess: (row) => onSaved(row.id),
    onError: (err) => setError(err.message),
  });
  const update = trpc.smithy.updateToolboxEntry.useMutation({
    onSuccess: (row) => onSaved(row.id),
    onError: (err) => setError(err.message),
  });

  function buildPayload() {
    const effect: TrapDefinition["effect"] = {};
    const dc = parseInt(saveDc, 10);
    if (!Number.isNaN(dc) && dc > 0) {
      effect.save = {
        ability: saveAbility,
        dc,
        onSuccess: saveOnSuccess,
      };
    }
    if (damageDice.trim()) {
      effect.damage = [{ dice: damageDice.trim(), type: damageType }];
    }
    const conditionList = conditions
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (conditionList.length > 0) effect.conditions = conditionList;
    if (effectProse.trim()) effect.effectProse = effectProse.trim();

    const detectParsed = parseInt(detectDc, 10);
    const disableParsed = parseInt(disableDc, 10);

    return {
      name: name.trim(),
      topic: "trap" as const,
      description: description.trim(),
      source: initial?.source ?? ("original" as const),
      copiedFromSlug: initial?.copiedFromSlug ?? undefined,
      trap: {
        trigger: trigger.trim(),
        effect,
        detect:
          !Number.isNaN(detectParsed) && detectParsed > 0
            ? {
                dc: detectParsed,
                ability: detectAbility,
                skill: detectSkill.trim() || undefined,
              }
            : undefined,
        disable:
          !Number.isNaN(disableParsed) && disableParsed > 0
            ? {
                dc: disableParsed,
                ability: disableAbility,
                tool: disableTool.trim() || undefined,
              }
            : undefined,
        reset,
        resetInterval: resetInterval.trim() || undefined,
      },
    };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (entryId) {
      update.mutate({ id: entryId, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-lore-border bg-lore-surface p-5">
      <h3 className="font-display text-lg">
        {entryId ? "Edit trap" : "Forge a trap"}
      </h3>

      <Field label="Name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Trigger">
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Save ability">
          <select
            className={inputClass}
            value={saveAbility}
            onChange={(e) =>
              setSaveAbility(e.target.value as (typeof ABILITIES)[number])
            }
          >
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Save DC">
          <input
            className={inputClass}
            value={saveDc}
            onChange={(e) => setSaveDc(e.target.value)}
            placeholder="15"
          />
        </Field>
        <Field label="On success">
          <select
            className={inputClass}
            value={saveOnSuccess}
            onChange={(e) =>
              setSaveOnSuccess(
                e.target.value as (typeof SAVE_OUTCOMES)[number],
              )
            }
          >
            {SAVE_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Damage dice">
          <input
            className={inputClass}
            value={damageDice}
            onChange={(e) => setDamageDice(e.target.value)}
            placeholder="1d8"
          />
        </Field>
        <Field label="Damage type">
          <select
            className={inputClass}
            value={damageType}
            onChange={(e) =>
              setDamageType(e.target.value as (typeof DAMAGE_TYPES)[number])
            }
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Conditions (comma-separated)">
        <input
          className={inputClass}
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="poisoned, restrained"
        />
      </Field>

      <Field label="Effect prose (optional)">
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={effectProse}
          onChange={(e) => setEffectProse(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Detect DC">
          <input
            className={inputClass}
            value={detectDc}
            onChange={(e) => setDetectDc(e.target.value)}
          />
        </Field>
        <Field label="Detect skill">
          <input
            className={inputClass}
            value={detectSkill}
            onChange={(e) => setDetectSkill(e.target.value)}
          />
        </Field>
        <Field label="Disable DC">
          <input
            className={inputClass}
            value={disableDc}
            onChange={(e) => setDisableDc(e.target.value)}
          />
        </Field>
        <Field label="Disable tool">
          <input
            className={inputClass}
            value={disableTool}
            onChange={(e) => setDisableTool(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reset">
          <select
            className={inputClass}
            value={reset}
            onChange={(e) =>
              setReset(e.target.value as TrapDefinition["reset"])
            }
          >
            {TRAP_RESET_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reset interval">
          <input
            className={inputClass}
            value={resetInterval}
            onChange={(e) => setResetInterval(e.target.value)}
            placeholder="1 minute"
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text disabled:opacity-50"
        >
          {pending ? "Saving…" : entryId ? "Save changes" : "Forge trap"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted hover:text-lore-text"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function SmithyPoisonToolboxForm({
  initial,
  entryId,
  onSaved,
  onCancel,
}: {
  initial?: SmithyToolboxFormInitial;
  entryId?: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const poison: PoisonDefinition =
    initial?.definition.kind === "poison"
      ? initial.definition
      : {
          kind: "poison",
          id: "new-poison",
          name: "",
          description: "",
          poisonType: "injury",
        };

  const [name, setName] = useState(initial?.name ?? poison.name);
  const [description, setDescription] = useState(
    initial?.description ?? poison.description,
  );
  const [poisonType, setPoisonType] = useState<PoisonType>(poison.poisonType);
  const [saveAbility, setSaveAbility] = useState(
    poison.save?.ability ?? "con",
  );
  const [saveDc, setSaveDc] = useState(
    poison.save ? String(poison.save.dc) : "",
  );
  const [saveOnSuccess, setSaveOnSuccess] = useState<
    NonNullable<PoisonDefinition["save"]>["onSuccess"]
  >(poison.save?.onSuccess ?? "negates");
  const [damageDice, setDamageDice] = useState(
    poison.damage?.[0]?.dice ?? "",
  );
  const [damageType, setDamageType] = useState(
    poison.damage?.[0]?.type ?? "poison",
  );
  const [conditions, setConditions] = useState(
    poison.conditions?.join(", ") ?? "",
  );
  const [repeat, setRepeat] = useState(poison.repeat ?? "");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.smithy.createToolboxEntry.useMutation({
    onSuccess: (row) => onSaved(row.id),
    onError: (err) => setError(err.message),
  });
  const update = trpc.smithy.updateToolboxEntry.useMutation({
    onSuccess: (row) => onSaved(row.id),
    onError: (err) => setError(err.message),
  });

  function buildPayload() {
    const dc = parseInt(saveDc, 10);
    const conditionList = conditions
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      name: name.trim(),
      topic: "poison" as const,
      description: description.trim(),
      source: initial?.source ?? ("original" as const),
      copiedFromSlug: initial?.copiedFromSlug ?? undefined,
      poison: {
        poisonType,
        save:
          !Number.isNaN(dc) && dc > 0
            ? {
                ability: saveAbility,
                dc,
                onSuccess: saveOnSuccess,
              }
            : undefined,
        damage: damageDice.trim()
          ? [{ dice: damageDice.trim(), type: damageType }]
          : undefined,
        conditions: conditionList.length > 0 ? conditionList : undefined,
        repeat: repeat.trim() || undefined,
      },
    };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (entryId) {
      update.mutate({ id: entryId, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-lore-border bg-lore-surface p-5"
    >
      <h3 className="font-display text-lg">
        {entryId ? "Edit poison" : "Forge a poison"}
      </h3>

      <Field label="Name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Delivery type">
        <select
          className={inputClass}
          value={poisonType}
          onChange={(e) => setPoisonType(e.target.value as PoisonType)}
        >
          {POISON_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Save ability">
          <select
            className={inputClass}
            value={saveAbility}
            onChange={(e) =>
              setSaveAbility(e.target.value as (typeof ABILITIES)[number])
            }
          >
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Save DC">
          <input
            className={inputClass}
            value={saveDc}
            onChange={(e) => setSaveDc(e.target.value)}
            placeholder="15"
          />
        </Field>
        <Field label="On success">
          <select
            className={inputClass}
            value={saveOnSuccess}
            onChange={(e) =>
              setSaveOnSuccess(
                e.target.value as (typeof SAVE_OUTCOMES)[number],
              )
            }
          >
            {SAVE_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Damage dice">
          <input
            className={inputClass}
            value={damageDice}
            onChange={(e) => setDamageDice(e.target.value)}
            placeholder="3d6"
          />
        </Field>
        <Field label="Damage type">
          <select
            className={inputClass}
            value={damageType}
            onChange={(e) =>
              setDamageType(e.target.value as (typeof DAMAGE_TYPES)[number])
            }
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Conditions (comma-separated)">
        <input
          className={inputClass}
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="poisoned"
        />
      </Field>

      <Field label="Repeat / special rules">
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </Field>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text disabled:opacity-50"
        >
          {pending ? "Saving…" : entryId ? "Save changes" : "Forge poison"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted hover:text-lore-text"
          >
            Cancel
          </button>
        ) : null}
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
