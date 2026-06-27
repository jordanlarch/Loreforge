"use client";

import type { CharacterSheet } from "@app/engine";

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Persistent right-side Live Stats HUD per character-view spec. */
export function SheetLiveHud({
  sheet,
  currentHp,
  tempHp,
  portraitUrl,
  maxHp,
  initiative,
}: {
  sheet: CharacterSheet;
  currentHp: number;
  tempHp: number;
  portraitUrl: string;
  maxHp?: number;
  initiative?: number;
}) {
  const hpMax = maxHp ?? sheet.hp.max;
  const hpPct = Math.round((currentHp / Math.max(1, hpMax)) * 100);
  const init = initiative ?? sheet.initiative;

  return (
    <aside className="sticky top-4 rounded-lg border border-lore-border bg-lore-surface p-4">
      <div className="text-[10px] uppercase tracking-widest text-lore-muted">
        Live Stats
      </div>
      <div className="mt-2 flex items-center gap-3">
        {portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt=""
            className="h-12 w-12 rounded border border-lore-border object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded border border-dashed border-lore-border bg-lore-bg" />
        )}
        <div>
          <div className="font-display text-lg leading-tight">{sheet.name}</div>
          <div className="text-xs text-lore-muted">
            Lvl {sheet.level} {sheet.species}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
          <div key={a} className="rounded border border-lore-border py-1">
            <div className="text-lore-muted">{a.toUpperCase()}</div>
            <div className="text-sm">
              {sheet.abilityScores[a]}{" "}
              <span className="text-lore-muted">
                ({signed(sheet.abilityModifiers[a])})
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-lore-muted">
          <span>HP</span>
          <span>
            {currentHp}/{hpMax}
            {tempHp > 0 ? ` (+${tempHp} temp)` : ""}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-lore-bg">
          <div
            className="h-full rounded-full bg-lore-accent"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <div>
          <dt className="text-lore-muted">AC</dt>
          <dd className="font-display text-lg">{sheet.ac}</dd>
        </div>
        <div>
          <dt className="text-lore-muted">Speed</dt>
          <dd className="font-display text-lg">{sheet.speed} ft</dd>
        </div>
        <div>
          <dt className="text-lore-muted">Init</dt>
          <dd className="font-display text-lg">{signed(init)}</dd>
        </div>
        <div>
          <dt className="text-lore-muted">Prof</dt>
          <dd className="font-display text-lg">{signed(sheet.proficiencyBonus)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] text-lore-muted">
        Updates as you edit scores and vitals. Combat syncs from Live Play.
      </p>
    </aside>
  );
}
