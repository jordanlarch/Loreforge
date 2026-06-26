"use client";

import { useMemo, useState } from "react";

import {
  buildCharacterSheet,
  xpProgress,
  type Ability,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  parseCharacterNotes,
  patchCharacterMeta,
  patchPersonalityFields,
  patchSessionNotes,
} from "@/lib/character-sheet-storage";
import {
  applyLongRestMeta,
  applyShortRestMeta,
  ensureHitDice,
  refreshSpellSlots,
} from "@/lib/sheet-rest";

import { AbilitiesPanel } from "./abilities-panel";
import { AboutTab } from "./about-tab";
import { CombatTab } from "./combat-tab";
import { FeaturesTab } from "./features-tab";
import { InventoryTab } from "./inventory-tab";
import { LevelUpDialog } from "./level-up-dialog";
import { NotesTab } from "./notes-tab";
import { SpellsTab } from "./spells-tab";
import { SheetHeader, MAX_CHARACTER_LEVEL } from "./sheet/sheet-header";
import { SheetHpPanel } from "./sheet/sheet-hp-panel";
import { SheetLeftRail } from "./sheet/sheet-left-rail";
import { SheetLiveHud } from "./sheet/sheet-live-hud";
import { SheetRightRail } from "./sheet/sheet-right-rail";
import { SheetToolbar } from "./sheet/sheet-toolbar";

const TABS = [
  "Combat",
  "Spells",
  "Inventory",
  "Features & Traits",
  "Notes",
  "About",
] as const;

type Tab = (typeof TABS)[number];

export function CharacterSheetView({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const utils = trpc.useUtils();
  const query = trpc.characters.get.useQuery({ id });
  const [levelingUp, setLevelingUp] = useState(false);
  const [tab, setTab] = useState<Tab>("Combat");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const update = trpc.characters.update.useMutation({
    async onMutate(vars) {
      await utils.characters.get.cancel({ id });
      const previous = utils.characters.get.getData({ id });
      utils.characters.get.setData({ id }, (old) =>
        old ? { ...old, ...vars } : old,
      );
      return { previous };
    },
    onError(_err, _vars, context) {
      if (context?.previous !== undefined) {
        utils.characters.get.setData({ id }, context.previous);
      }
    },
    async onSettled() {
      setLastSaved(new Date());
      await Promise.all([
        utils.characters.get.invalidate({ id }),
        utils.characters.list.invalidate(),
        utils.characters.listDashboard.invalidate(),
      ]);
    },
  });

  const character = query.data;
  const parsed = useMemo(
    () => parseCharacterNotes(character?.notes ?? ""),
    [character?.notes],
  );

  if (query.isLoading) {
    return (
      <div
        className={
          embedded
            ? "py-6 text-lore-muted"
            : "mx-auto max-w-7xl px-4 py-10 text-lore-muted"
        }
      >
        Loading…
      </div>
    );
  }

  if (!character) {
    return (
      <div className={embedded ? "py-6" : "mx-auto max-w-7xl px-4 py-10"}>
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Character not found.
        </div>
      </div>
    );
  }

  const sheet = buildCharacterSheet(character);
  const progress = xpProgress(character.xp, sheet.level);
  const atCap = sheet.level >= MAX_CHARACTER_LEVEL;
  const currentHp = parsed.meta.currentHp ?? character.maxHp;
  const tempHp = parsed.meta.tempHp ?? 0;
  const notesRaw = character.notes;
  const metaWithHitDice = ensureHitDice(parsed.meta, character.classes);
  const hitDiceList = Object.entries(metaWithHitDice.hitDice ?? {}).map(
    ([className, pool]) => ({
      class: className,
      current: pool.current,
      max: pool.max,
    }),
  );

  function saveNotes(nextRaw: string) {
    update.mutate({ id, notes: nextRaw });
  }

  function patchMeta(patch: Parameters<typeof patchCharacterMeta>[1]) {
    saveNotes(patchCharacterMeta(notesRaw, patch));
  }

  function patchPersonality(
    patch: Parameters<typeof patchPersonalityFields>[1],
  ) {
    saveNotes(patchPersonalityFields(notesRaw, patch));
  }

  function patchSession(sessionNotes: string) {
    saveNotes(patchSessionNotes(notesRaw, sessionNotes));
  }

  const charMaxHp = character.maxHp;
  const charSpells = character.spells;

  function shortRest() {
    const nextMeta = applyShortRestMeta(metaWithHitDice);
    saveNotes(patchCharacterMeta(notesRaw, nextMeta));
  }

  function longRest() {
    const nextMeta = applyLongRestMeta(metaWithHitDice, charMaxHp);
    saveNotes(patchCharacterMeta(notesRaw, nextMeta));
    update.mutate({
      id,
      spells: refreshSpellSlots(charSpells),
    });
  }

  return (
    <div
      className={`${embedded ? "py-4" : "mx-auto max-w-7xl px-4 py-10 pb-24"} space-y-4`}
    >
      {update.error && (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {update.error.message}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <SheetHeader
          character={character}
          sheet={sheet}
          embedded={embedded}
          onNameChange={(name) => update.mutate({ id, name })}
          onSpeciesChange={(species) => update.mutate({ id, species })}
          onBackgroundChange={(background) =>
            update.mutate({ id, background })
          }
          onPortraitChange={(portraitUrl) =>
            update.mutate({ id, portraitUrl })
          }
          onLevelUp={() => setLevelingUp(true)}
          canLevelUp={progress.canLevelUp}
          atCap={atCap}
          onXpChange={(xp) => update.mutate({ id, xp })}
          xpRemaining={progress.remaining}
        />
        <SheetHpPanel
          current={currentHp}
          max={character.maxHp}
          temp={tempHp}
          hitDice={hitDiceList}
          onPatch={patchMeta}
          onShortRest={shortRest}
          onLongRest={longRest}
        />
      </div>

      <AbilitiesPanel
        sheet={sheet}
        abilityScores={character.abilityScores}
        onScoreChange={(ability: Ability, score) =>
          update.mutate({
            id,
            abilityScores: { ...character.abilityScores, [ability]: score },
          })
        }
        onToggleSaveProficiency={(ability) => {
          const saves = character.saveProficiencies;
          const next = saves.includes(ability)
            ? saves.filter((a) => a !== ability)
            : [...saves, ability];
          update.mutate({ id, saveProficiencies: next });
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[220px_1fr_240px]">
        <div className="hidden xl:block">
          <SheetLeftRail
            sheet={sheet}
            equipment={character.equipment}
            onToggleSkill={(skill) => {
              const skills = character.skillProficiencies;
              const next = skills.includes(skill)
                ? skills.filter((s) => s !== skill)
                : [...skills, skill];
              update.mutate({ id, skillProficiencies: next });
            }}
          />
        </div>

        <div className="min-w-0">
          <nav className="flex flex-wrap gap-1 border-b border-lore-border">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-xs uppercase tracking-wide transition-colors sm:text-sm ${
                  tab === t
                    ? "border-lore-accent text-lore-text"
                    : "border-transparent text-lore-muted hover:text-lore-text"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="mt-6">
            {tab === "Combat" && (
              <CombatTab
                character={character}
                meta={metaWithHitDice}
                onPatchMeta={patchMeta}
              />
            )}
            {tab === "Spells" && (
              <SpellsTab
                spells={character.spells}
                sheet={sheet}
                classes={character.classes}
                saving={update.isPending}
                onSave={(spells) => update.mutate({ id, spells })}
              />
            )}
            {tab === "Inventory" && (
              <InventoryTab
                equipment={character.equipment}
                meta={metaWithHitDice}
                saving={update.isPending}
                onSaveEquipment={(equipment) =>
                  update.mutate({ id, equipment })
                }
                onPatchMeta={patchMeta}
              />
            )}
            {tab === "Features & Traits" && (
              <FeaturesTab
                species={character.species}
                background={character.background}
                classes={character.classes}
                meta={metaWithHitDice}
                onPatchMeta={patchMeta}
              />
            )}
            {tab === "Notes" && (
              <NotesTab
                sessionNotes={parsed.sessionNotes}
                meta={metaWithHitDice}
                onPatchSessionNotes={patchSession}
                onPatchMeta={patchMeta}
              />
            )}
            {tab === "About" && (
              <AboutTab
                background={character.background}
                personality={parsed.personality}
                meta={metaWithHitDice}
                onPatchPersonality={patchPersonality}
                onPatchMeta={patchMeta}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SheetRightRail
            sheet={sheet}
            meta={metaWithHitDice}
            inspiration={parsed.meta.inspiration ?? false}
            onPatchMeta={patchMeta}
          />
          <SheetLiveHud
            sheet={sheet}
            currentHp={currentHp}
            tempHp={tempHp}
            portraitUrl={character.portraitUrl}
          />
        </div>
      </div>

      <div className="xl:hidden">
        <SheetLeftRail
          sheet={sheet}
          equipment={character.equipment}
          onToggleSkill={(skill) => {
            const skills = character.skillProficiencies;
            const next = skills.includes(skill)
              ? skills.filter((s) => s !== skill)
              : [...skills, skill];
            update.mutate({ id, skillProficiencies: next });
          }}
        />
      </div>

      {!embedded && (
        <SheetToolbar
          characterId={id}
          saving={update.isPending}
          lastSaved={lastSaved}
        />
      )}

      {levelingUp && (
        <LevelUpDialog
          character={character}
          onClose={() => setLevelingUp(false)}
        />
      )}
    </div>
  );
}
