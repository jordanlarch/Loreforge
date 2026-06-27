"use client";

import { useState } from "react";

import {
  DAMAGE_TYPES,
  ITEM_RARITIES,
  ITEM_TYPES,
  type ItemDefinition,
  type ItemRarity,
  type ItemSource,
  type ItemType,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

export type SmithyItemFormInitial = {
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  properties: string[];
  description: string;
  requiresAttunement: boolean;
  source: ItemSource;
  copiedFromSlug?: string | null;
  definition?: ItemDefinition;
};

type MechanicsState = {
  damageDice: string;
  damageType: (typeof DAMAGE_TYPES)[number];
  attackBonus: string;
  finesse: boolean;
  ranged: boolean;
  rangeFt: string;
  baseAc: string;
  dexBonusMax: string;
  stealthDisadvantage: boolean;
  shield: boolean;
  onHitName: string;
  onHitDice: string;
  onHitDamageType: (typeof DAMAGE_TYPES)[number];
};

function mechanicsFromDefinition(def?: ItemDefinition): MechanicsState {
  return {
    damageDice: def?.weapon?.damage.dice ?? "1d8",
    damageType: def?.weapon?.damage.type ?? "slashing",
    attackBonus:
      def?.weapon?.attackBonus != null ? String(def.weapon.attackBonus) : "",
    finesse: def?.weapon?.finesse ?? false,
    ranged: def?.weapon?.ranged ?? false,
    rangeFt: def?.weapon?.rangeFt != null ? String(def.weapon.rangeFt) : "",
    baseAc: def?.armor?.baseAc != null ? String(def.armor.baseAc) : "14",
    dexBonusMax:
      def?.armor?.dexBonusMax === null
        ? "unlimited"
        : def?.armor?.dexBonusMax != null
          ? String(def.armor.dexBonusMax)
          : "",
    stealthDisadvantage: def?.armor?.stealthDisadvantage ?? false,
    shield: def?.armor?.shield ?? false,
    onHitName: def?.equippedEffects?.[0]?.name ?? "",
    onHitDice:
      def?.equippedEffects?.[0]?.modifier.type === "on_hit_damage"
        ? def.equippedEffects[0].modifier.dice
        : "",
    onHitDamageType:
      def?.equippedEffects?.[0]?.modifier.type === "on_hit_damage"
        ? def.equippedEffects[0].modifier.damageType
        : "fire",
  };
}

function buildMechanicsPayload(
  type: ItemType,
  mechanics: MechanicsState,
): SmithyItemFormInitial extends never ? never : {
  weapon?: {
    damage: { dice: string; type: (typeof DAMAGE_TYPES)[number] };
    attackBonus?: number;
    finesse?: boolean;
    ranged?: boolean;
    rangeFt?: number;
  };
  armor?: {
    baseAc: number;
    dexBonusMax?: number | null;
    stealthDisadvantage?: boolean;
    shield?: boolean;
  };
  equippedEffects?: {
    name: string;
    modifier:
      | { type: "on_hit_damage"; dice: string; damageType: (typeof DAMAGE_TYPES)[number] };
  }[];
} {
  const payload: ReturnType<typeof buildMechanicsPayload> = {};

  if (type === "Weapon" || type === "Magic Item") {
    payload.weapon = {
      damage: {
        dice: mechanics.damageDice.trim(),
        type: mechanics.damageType,
      },
    };
    const bonus = parseInt(mechanics.attackBonus, 10);
    if (!Number.isNaN(bonus) && bonus !== 0) payload.weapon.attackBonus = bonus;
    if (mechanics.finesse) payload.weapon.finesse = true;
    if (mechanics.ranged) payload.weapon.ranged = true;
    const range = parseInt(mechanics.rangeFt, 10);
    if (!Number.isNaN(range) && range > 0) payload.weapon.rangeFt = range;
  }

  if (type === "Armor") {
    payload.armor = {
      baseAc: parseInt(mechanics.baseAc, 10) || 14,
      stealthDisadvantage: mechanics.stealthDisadvantage || undefined,
      shield: mechanics.shield || undefined,
    };
    if (mechanics.dexBonusMax === "unlimited") {
      payload.armor.dexBonusMax = null;
    } else if (mechanics.dexBonusMax !== "") {
      payload.armor.dexBonusMax = parseInt(mechanics.dexBonusMax, 10);
    }
  }

  if (
    type === "Magic Item" &&
    mechanics.onHitName.trim() &&
    mechanics.onHitDice.trim()
  ) {
    payload.equippedEffects = [
      {
        name: mechanics.onHitName.trim(),
        modifier: {
          type: "on_hit_damage",
          dice: mechanics.onHitDice.trim(),
          damageType: mechanics.onHitDamageType,
        },
      },
    ];
  }

  return payload;
}

export function SmithyItemForm({
  mode,
  itemId,
  initial,
  onDone,
  onCancel,
  className,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initial?: SmithyItemFormInitial;
  onDone: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const create = trpc.smithy.create.useMutation({
    onSuccess: async () => {
      await utils.smithy.list.invalidate();
      onDone();
    },
  });
  const update = trpc.smithy.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.smithy.list.invalidate(),
        utils.smithy.get.invalidate({ id: row.id }),
      ]);
      onDone();
    },
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ItemType>(initial?.type ?? "Weapon");
  const [rarity, setRarity] = useState<ItemRarity>(initial?.rarity ?? "Common");
  const [propertiesText, setPropertiesText] = useState(
    initial?.properties.join(", ") ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requiresAttunement, setRequiresAttunement] = useState(
    initial?.requiresAttunement ?? false,
  );
  const [mechanics, setMechanics] = useState(() =>
    mechanicsFromDefinition(initial?.definition),
  );

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function patchMechanics(patch: Partial<MechanicsState>) {
    setMechanics((prev) => ({ ...prev, ...patch }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      type,
      rarity,
      properties: propertiesText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      description: description.trim(),
      requiresAttunement,
      mechanics: buildMechanicsPayload(type, mechanics),
    };
    if (mode === "edit" && itemId) {
      update.mutate({
        id: itemId,
        ...payload,
        source: initial?.source ?? "original",
        copiedFromSlug: initial?.copiedFromSlug ?? undefined,
      });
      return;
    }
    create.mutate(payload);
  }

  const showWeaponFields = type === "Weapon" || type === "Magic Item";
  const showArmorFields = type === "Armor";
  const showMagicOnHit = type === "Magic Item";

  return (
    <form
      onSubmit={submit}
      className={`space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6 ${className ?? ""}`}
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
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className={inputClass}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rarity">
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value as ItemRarity)}
            className={inputClass}
          >
            {ITEM_RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {showWeaponFields ? (
        <section className="space-y-4 rounded border border-lore-border/70 p-4">
          <h3 className="text-xs uppercase tracking-widest text-lore-muted">
            Weapon mechanics
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Damage dice">
              <input
                required={type === "Weapon"}
                value={mechanics.damageDice}
                onChange={(e) => patchMechanics({ damageDice: e.target.value })}
                placeholder="1d8"
                className={inputClass}
              />
            </Field>
            <Field label="Damage type">
              <select
                value={mechanics.damageType}
                onChange={(e) =>
                  patchMechanics({
                    damageType: e.target.value as (typeof DAMAGE_TYPES)[number],
                  })
                }
                className={inputClass}
              >
                {DAMAGE_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Magic bonus">
              <input
                value={mechanics.attackBonus}
                onChange={(e) => patchMechanics({ attackBonus: e.target.value })}
                placeholder="+1"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-lore-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mechanics.finesse}
                onChange={(e) => patchMechanics({ finesse: e.target.checked })}
                className="accent-lore-accent"
              />
              Finesse
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mechanics.ranged}
                onChange={(e) => patchMechanics({ ranged: e.target.checked })}
                className="accent-lore-accent"
              />
              Ranged
            </label>
          </div>
          <Field label="Range / reach (ft)">
            <input
              value={mechanics.rangeFt}
              onChange={(e) => patchMechanics({ rangeFt: e.target.value })}
              placeholder="80 ranged · 10 reach"
              className={inputClass}
            />
          </Field>
        </section>
      ) : null}

      {showArmorFields ? (
        <section className="space-y-4 rounded border border-lore-border/70 p-4">
          <h3 className="text-xs uppercase tracking-widest text-lore-muted">
            Armor mechanics
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base AC">
              <input
                required
                value={mechanics.baseAc}
                onChange={(e) => patchMechanics({ baseAc: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="DEX bonus cap">
              <select
                value={mechanics.dexBonusMax}
                onChange={(e) => patchMechanics({ dexBonusMax: e.target.value })}
                className={inputClass}
              >
                <option value="">Fixed AC</option>
                <option value="unlimited">Unlimited DEX</option>
                <option value="0">No DEX (heavy)</option>
                <option value="2">Max +2 (medium)</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-lore-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mechanics.stealthDisadvantage}
                onChange={(e) =>
                  patchMechanics({ stealthDisadvantage: e.target.checked })
                }
                className="accent-lore-accent"
              />
              Stealth disadvantage
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mechanics.shield}
                onChange={(e) => patchMechanics({ shield: e.target.checked })}
                className="accent-lore-accent"
              />
              Shield
            </label>
          </div>
        </section>
      ) : null}

      {showMagicOnHit ? (
        <section className="space-y-4 rounded border border-lore-border/70 p-4">
          <h3 className="text-xs uppercase tracking-widest text-lore-muted">
            On-hit rider (optional)
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Effect name">
              <input
                value={mechanics.onHitName}
                onChange={(e) => patchMechanics({ onHitName: e.target.value })}
                placeholder="Flames"
                className={inputClass}
              />
            </Field>
            <Field label="Extra damage dice">
              <input
                value={mechanics.onHitDice}
                onChange={(e) => patchMechanics({ onHitDice: e.target.value })}
                placeholder="2d6"
                className={inputClass}
              />
            </Field>
            <Field label="Extra damage type">
              <select
                value={mechanics.onHitDamageType}
                onChange={(e) =>
                  patchMechanics({
                    onHitDamageType: e.target.value as (typeof DAMAGE_TYPES)[number],
                  })
                }
                className={inputClass}
              >
                {DAMAGE_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      ) : null}

      <Field label="Properties (comma-separated)">
        <input
          value={propertiesText}
          onChange={(e) => setPropertiesText(e.target.value)}
          placeholder="Heavy, Two-Handed, Special"
          className={inputClass}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A greataxe wreathed in rolling thunder…"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-lore-muted">
        <input
          type="checkbox"
          checked={requiresAttunement}
          onChange={(e) => setRequiresAttunement(e.target.checked)}
          className="accent-lore-accent"
        />
        Requires attunement
      </label>

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
              : "Forging…"
            : mode === "edit"
              ? "Save changes"
              : "Forge item"}
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
    <label className="block space-y-1.5 text-sm">
      <span className="text-lore-muted">{label}</span>
      {children}
    </label>
  );
}
