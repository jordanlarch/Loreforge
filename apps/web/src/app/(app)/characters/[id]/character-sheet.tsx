"use client";

import Link from "next/link";
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
import { effectiveSheetVitals } from "@/lib/sheet-modifiers";

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
import type { CastableSpell } from "@/lib/live-combat";

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
  onFeatureUse,
  onCastSpell,
  liveConditions,
}: {
  id: string;
  embedded?: boolean;
  onFeatureUse?: (featureName: string) => void;
  onCastSpell?: (spell: CastableSpell) => void;
  liveConditions?: { condition: string; level?: number }[];
}) {
  const utils = trpc.useUtils();
  const query = trpc.characters.get.useQuery({ id });
  const [levelingUp, setLevelingUp] = useState(false);
  const [tab, setTab] = useState<Tab>("Combat");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [featureToast, setFeatureToast] = useState<string | null>(null);

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

  const uploadPortrait = trpc.characters.uploadPortrait.useMutation({
    async onSuccess(data) {
      await utils.characters.get.invalidate({ id });
      if (data.portraitUrl) {
        utils.characters.get.setData({ id }, (old) =>
          old ? { ...old, portraitUrl: data.portraitUrl } : old,
        );
      }
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
  const metaWithHitDice = ensureHitDice(parsed.meta, character.classes);
  const vitals = effectiveSheetVitals(
    { ...character, equipment: character.equipment },
    metaWithHitDice,
  );
  const milestoneXp = parsed.meta.milestoneXp ?? false;
  const progress = xpProgress(character.xp, sheet.level);
  const atCap = sheet.level >= MAX_CHARACTER_LEVEL;
  const canLevelUp = milestoneXp ? !atCap : progress.canLevelUp;
  const effectiveMaxHp = vitals.maxHp;
  const currentHp = Math.min(
    parsed.meta.currentHp ?? effectiveMaxHp,
    effectiveMaxHp,
  );
  const tempHp = parsed.meta.tempHp ?? 0;
  const notesRaw = character.notes;
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

  const charClasses = character.classes;

  function shortRest() {
    const nextMeta = applyShortRestMeta(metaWithHitDice, charClasses);
    saveNotes(patchCharacterMeta(notesRaw, nextMeta));
  }

  function longRest() {
    const nextMeta = applyLongRestMeta(
      metaWithHitDice,
      charClasses,
      charMaxHp,
    );
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
      {featureToast && (
        <p className="rounded border border-lore-accent/40 bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
          {featureToast}
        </p>
      )}

      {!embedded && (
        <Link
          href="/characters"
          className="inline-block text-sm text-lore-muted hover:text-lore-text"
        >
          ← Characters
        </Link>
      )}

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
          onPortraitUpload={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              if (typeof result !== "string") return;
              const base64 = result.split(",")[1];
              if (!base64) return;
              uploadPortrait.mutate({
                characterId: id,
                fileName: file.name,
                contentType: file.type,
                dataBase64: base64,
              });
            };
            reader.readAsDataURL(file);
          }}
          portraitUploading={uploadPortrait.isPending}
          onLevelUp={() => setLevelingUp(true)}
          canLevelUp={canLevelUp}
          atCap={atCap}
          milestoneXp={milestoneXp}
          onMilestoneXpChange={(enabled) => patchMeta({ milestoneXp: enabled })}
          onXpChange={(xp) => update.mutate({ id, xp })}
          xpRemaining={milestoneXp ? null : progress.remaining}
        />
        <SheetHpPanel
          current={currentHp}
          max={effectiveMaxHp}
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

      <div className="grid gap-6 xl:grid-cols-[280px_1fr_240px]">
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
                pactMagic={parsed.meta.pactMagic ?? null}
                onPatchPactMagic={(pool) =>
                  patchMeta({ pactMagic: pool ?? undefined })
                }
                saving={update.isPending}
                onSave={(spells) => update.mutate({ id, spells })}
                onCastSpell={onCastSpell}
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
                characterId={id}
                species={character.species}
                background={character.background}
                classes={character.classes}
                meta={metaWithHitDice}
                onPatchMeta={patchMeta}
                onUpdateClasses={(classes) => update.mutate({ id, classes })}
                onFeatureUse={onFeatureUse}
                onFeatureResult={(msg) => {
                  setFeatureToast(msg);
                  window.setTimeout(() => setFeatureToast(null), 5000);
                }}
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
            liveConditions={liveConditions}
            effectiveAc={vitals.ac}
            effectiveInitiative={vitals.initiative}
            effectiveSpeed={vitals.speed}
            passivePerceptionBonus={vitals.passivePerceptionBonus}
            passiveInvestigationBonus={vitals.passiveInvestigationBonus}
          />
          <SheetLiveHud
            sheet={sheet}
            currentHp={currentHp}
            tempHp={tempHp}
            portraitUrl={character.portraitUrl}
            maxHp={effectiveMaxHp}
            initiative={vitals.initiative}
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
          milestoneXp={milestoneXp}
          onClose={() => setLevelingUp(false)}
        />
      )}
    </div>
  );
}
