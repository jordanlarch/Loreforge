# SRD 5.2.1 Feature-Coverage Audit (living tracker)

**Purpose:** the canonical, continuously-updated record of **how faithfully Loreforge implements the SRD 5.2.1 ruleset** — what is implemented, partially implemented, not implemented, and (critically) what is implemented but **incongruent** with the document. This is the *coverage/fidelity* companion to `docs/srd-version-audit.md` (which tracks *version alignment*: is content labeled 5.1 vs 5.2).

**Canonical source:** `SRD_CC_v5.2.1.pdf` (WotC CC-BY 4.0, 364 pp). Local copy: `C:\Users\Jordan\Downloads\SRD_CC_v5.2.1.pdf`.

**First audited:** 2026-06-29 · **Branch baseline:** `main`.

**Tracking IDs:** fidelity gaps use the `SRD-FID-*` family and are mirrored as rows in `docs/deferrals.md` §12 (and, for the incongruences, GitHub issues). Where a gap is already tracked under another family (e.g. `ENG-8`, `ENG-9`, `ENG-13`, `DATA-1c`, `PLAY-15`), this doc points at that ID instead of minting a duplicate.

> **Why two SRD docs?** `srd-version-audit.md` answered *"is our content the 2024 edition?"* (yes — AUDIT-0–12 done). This doc answers the different question *"does the engine actually implement the rule, correctly?"* — and the answer is much more mixed. Content is correctly **labeled** 5.2; a large fraction of **mechanics** is catalog/display-only or simplified ("tracer") rather than rules-accurate.

---

## How to keep this current

1. **When you ship a fidelity fix:** flip its **Status** here *and* in `docs/deferrals.md` §12 (don't delete rows — set `Done` with the PR). Update the chapter scorecard if a whole area changes verdict.
2. **When you find a new gap/incongruence:** add a row to the relevant table with the next `SRD-FID-*` id, mirror it to `deferrals.md` §12, and (if it's a correctness bug) open a GitHub issue.
3. **Periodic re-audit:** re-run the five domain sweeps (see [§9 Methodology](#9-methodology--re-audit)) after major engine work. Update **Last audited** dates per chapter.
4. This doc is **reference, not backlog-of-record** — `deferrals.md` stays the single source of truth for *work scheduling*; this doc is the SRD-shaped *coverage map*.

**Status legend:** ✅ Implemented (engine-owned, rules-accurate) · 🟡 Partial (present, materially incomplete) · 🔴 Missing/catalog-only · ⚠️ **Incongruent** (runs, but contradicts the PDF).

---

## 1. Scorecard by SRD 5.2.1 chapter

| SRD chapter | Data/Catalog | Engine mechanics | Verdict | Tracking |
|---|---|---|---|---|
| Playing the Game — D20 Tests | n/a | checks/attacks ✅; **save proficiency** ✅; skill prof on entity ✗ | 🟡 | SRD-FID-16 (saves done) |
| Playing the Game — Actions (12 standard) | n/a | Dash/Disengage/Dodge/Help/Hide ✅; Grapple/Shove/Use Object etc. ✗ | 🟡 | SRD-FID-14 (done); two-weapon/unarmed/shove/grapple still open |
| Playing the Game — Combat order | n/a | initiative/turns/rounds/surprise ✅ | 🟡 | SRD-FID-17 done |
| Playing the Game — Movement/position | n/a | grid/LOS/OA/cover ✅; **difficult terrain** ✅ | 🟢 | SRD-FID-18 done |
| Playing the Game — Damage/Healing | n/a | HP/crit/heal/death saves ✅; **resist/vuln/immunity** ✅; temp-HP grant ✅ | 🟢 | SRD-FID-19 done |
| Conditions (15) | declared ✅ | ~9 accurate, ~6 simplified | 🟡 | SRD-FID-3, SRD-FID-20 |
| Character Creation / Advancement | ✅ | XP/HP/ASI/multiclass ✅; **background ASI** ✅ | 🟢 | SRD-FID-2 **Done** |
| Classes (12) | catalog ✅ | features mostly display-only (2 wired) | 🟡 | SRD-FID-21 |
| Subclasses (12) | catalog ✅ | **0 mechanical** | 🔴 | SRD-FID-21 |
| Species (9) | catalog ✅ | traits **0 mechanical** | 🔴 | SRD-FID-22 |
| Backgrounds (4) | ingest ✅ | skills ✅; **ASI** ✅; origin feat partial | 🟡 | SRD-FID-2 **Done** |
| Feats | catalog ✅ | 8 of N mechanical | 🟡 | SRD-FID-23 |
| Equipment — Weapons | catalog ✅ | finesse/reach/ranged ✅; most props ✗; **mastery display-only** | 🟡 | SRD-FID-24 |
| Equipment — Armor | catalog ✅ | AC calc ✅; stealth/Str/Armor-Training ✗ | 🟡 | SRD-FID-25 |
| Equipment — Tools/gear/mounts/vehicles/lifestyle/hirelings | partial | none | 🔴 | SRD-FID-26 |
| Spells (~360) | 339 catalog ✅ | 126 deep; ~165 lossy auto; ~172 no-effect | 🟡 | ENG-2, ENG-3, SRD-FID-6 |
| Spellcasting rules | n/a | slots/DC/upcast/concentration ✅; **ritual, components, prepared-model** ✗ | 🟡 | SRD-FID-27 |
| Rules Glossary terms | Codex ✅ | Bloodied/Heroic-Inspiration/Emanation not enforced; **Cover** ✅ | 🟡 | SRD-FID-28 |
| Gameplay Toolbox | 44 hand-seeds | traps/poison/curse/env/fear handlers ✅ (sample depth) | 🟡 | DATA-1b |
| Magic Items (A–Z) | ~203/440 catalog | no effect schema, **no attunement enforcement**, no charges | 🔴 | SRD-FID-29 |
| Monsters (A–Z, ~300+) | 331 catalog ✅ | **8 combat templates (~2.4%)**; no legendary/lair | 🔴 | DATA-1c, PLAY-15 |
| Animals | catalog ✅ | 1 template (wolf) | 🔴 | DATA-1c |

---

## 2. ⚠️ Incongruences — implemented but contradicts SRD 5.2.1 (highest priority)

These run today and produce **wrong results** vs the PDF. They are correctness bugs, not backlog. All confirmed against the PDF during the 2026-06-29 audit. Mirrored to `deferrals.md` §12.1 and GitHub issues.

**2026-06-29 fix pass:** before any code changed, **every row below was re-read against the 5.2.1 PDF text** — which caught that **SRD-FID-10 (Sleep) was a wrong claim** (the "5d8 HP budget" is the *2014* spell; 2024 Sleep is a Wisdom save, so the engine was already a valid tracer). Fixed: FID-1, FID-3, FID-4, FID-5, FID-6, FID-12 (Flame Strike), plus the real Sleep gaps. Engine suite green (603 tests) + typecheck. Remaining rows need new subsystems (resistance engine, multi-attack mode, revive lifecycle, reaction-during-cast) and stay open.

| ID | Feature | Engine behavior | SRD 5.2.1 (PDF) | Files | Status |
|---|---|---|---|---|---|
| **SRD-FID-1** | **Exhaustion** | 2014-style tiered effects at levels 2/3/5 | Uniform: **−2 × level on all D20 Tests, −5 ft × level Speed, death at 6**, Long Rest −1 (p.181) | `packages/engine/src/combat/conditions.ts` | ✅ **Fixed** — `exhaustionD20Penalty` (−2×lvl) threaded into attack/check/save/spell-attack; `effectiveSpeed` −5×lvl |
| **SRD-FID-2** | **Background ability bonuses** | Wizard applies species bonuses only = `{}` → **PCs get no ASI from background**; UI copy claims otherwise | Backgrounds grant **+2/+1 or three +1s** (p.83, Character Origins) | `creation-wizard.tsx`, `background-asi-picker.tsx`, `character-build.ts` | ✅ **Fixed** — PR #326: Background ASI picker on Abilities step; `applyBackgroundAsi` folded into saved scores |
| **SRD-FID-3** | **Frightened** | always-on attack disadvantage, no gating | Disadvantage on **ability checks AND attacks while source in LoS** + **can't willingly approach** (p.182) | `packages/engine/src/combat/conditions.ts` | ✅ **Fixed** — `checkMode` (check disadvantage) + `frightenedSources` can't-approach in `handleMoveEntity`; LoS gate kept as documented always-on approximation |
| **SRD-FID-4** | **Faerie Fire shape** | 20-ft **Sphere** | 20-ft **Cube** | spell registry (`faerie-fire`) | ✅ **Fixed** — `cube` |
| **SRD-FID-5** | **Spirit Guardians shape** | Sphere | 15-ft **Emanation** around caster (Emanation shape, p.181) | spell registry, `commands/handlers.ts` | ✅ **Fixed** — added `emanation` AoE shape (caster-centered, excludes caster) |
| **SRD-FID-6** | **Open5e auto-converted saves (~165 spells)** | converter defaults every save spell to `half_damage` on success | Many are **no effect** on success (Sacred Flame) or condition-only with **no damage** (Hold Person) | `packages/engine/src/content/open5e-spell.ts` | ✅ **Fixed** — text-inferred `no_effect`/`half_damage`; **registry regenerated, 68 spells corrected** |
| **SRD-FID-7** | **Hex** | reuses Hunter's Mark modifier — weapon hits only, damage type mislabeled | Necrotic, applies to **any attack** by caster + ability-check disadvantage rider | spell registry (`hex`) | ⚠️ Open — necrotic typing is cosmetic until the resistance engine (SRD-FID-19); any-attack scope + chosen-ability check rider need new effect plumbing |
| **SRD-FID-8** | **Scorching Ray** | auto-hit darts (like Magic Missile) | **Separate ranged spell attack rolls** per ray | spell registry (`scorching-ray`) | ⚠️ Open — needs a per-ray spell-attack resolution mode (schema addition) |
| **SRD-FID-9** | **Revivify** | heals a living ally | Returns a creature **dead ≤1 min** to life at 1 HP | spell registry (`revivify`) | ⚠️ Open — needs a revive/raise-dead path (clear `dead`/`deathSaves`) |
| **SRD-FID-10** | ~~**Sleep**~~ — **claim RETRACTED** | flat Wis save → Unconscious in a sphere | **2024 Sleep is a Wisdom save** (Incapacitated→Unconscious, 5-ft Sphere, Concentration). The "5d8 HP budget" was the 2014 spell. | spell registry (`sleep`) | ✅ **Done** — engine already edition-correct; fixed remaining gaps (5-ft Sphere + Concentration) |
| **SRD-FID-11** | **Counterspell / Dispel Magic** | spend reaction/slot; no interrupt, no level contest | Counterspell interrupts a cast; Dispel ends effects by slot-level comparison | `commands/handlers.ts`, `combat/effects.ts` | ⚠️ Open — Counterspell interrupt needs a reaction-during-cast window |
| **SRD-FID-12** | **Tracer spells** (Flame Strike, Wall of Fire, Polymorph, Spiritual Weapon, …) | sphere/burst/restrained/one-shot approximations | cylinder / persistent wall / beast-form stat swap / recurring bonus-action attacks | spell registry | 🟡 **Partial** — Flame Strike fixed (cylinder + 5d6 fire/5d6 radiant); wall/polymorph/spiritual-weapon still need subsystems |
| **SRD-FID-13** | **Damage at 0 HP** | adds **1** death-save failure; no instant death | **2 failures on a critical hit**; **instant death** if a single hit's damage ≥ HP max (p.17) | `projections/world-state.ts`, `combat/death.ts` | ⚠️ Open (overlaps ENG-8 — needs a `critical` flag on `DamageDealt`) |

> The still-open rows (FID-7/8/9/11/13 and the rest of FID-12) are blocked on subsystems that are themselves tracked engine backlog (damage-type resistance, per-ray multi-attack, a Dead→revive lifecycle, reaction-during-cast windows, a crit flag on the damage event). They are real fidelity gaps for a rules-fidelity wedge, so they stay open rather than being marked "done."

---

## 3. Next-up: cheap, high-visibility combat completeness

The fastest wins toward a complete-feeling combat loop. Targeted as the slice immediately after the incongruence fixes.

| ID | Feature | Gap | SRD 5.2.1 (PDF, glossary) | Status |
|---|---|---|---|---|
| **SRD-FID-14** | **Standard actions** Dash / Disengage / Dodge / Help / Hide | no engine commands exist (only Attack, Magic-via-spell, Ready) | Dash = extra move = Speed (p.180); Disengage = no OAs this turn (p.182); Dodge = attackers Disadvantage + Dex saves Advantage until next turn (p.182); Help = grant Advantage on a check or an ally's attack vs adjacent foe (p.182); Hide = DC 15 Stealth → Invisible while hidden (p.183) | ✅ **Done** — PR #327 |
| **SRD-FID-15** | **Cover** | no AC/save modifiers; AoE blocking only uses Total Cover via LOS | Half cover **+2 AC & Dex saves**; Three-Quarters **+5**; Total = can't be targeted (ties into Hide & AoE origin rules) | ✅ **Done** — PR #327; Sacred Flame `ignoreCover` |

*(SRD-FID-14/15 are also the gateway for several incongruence/condition fixes: Disengage is required for Frightened/grapple interplay; Hide produces the Invisible condition; Cover feeds Sacred Flame's "ignores cover" and AoE accuracy.)*

---

## 4. ✅ Implemented (engine-owned, rules-accurate)

Work end-to-end with deterministic math + tests:

- **D20 core:** ability checks (+proficiency flag), attack rolls, advantage/disadvantage with correct cancel-to-normal stacking.
- **Progression:** proficiency bonus by level, HP at L1 + per level, XP thresholds & milestone, ASI at 4/8/12/16/19 + class extras, multiclassing prerequisites + spell-slot pooling math.
- **Combat loop:** initiative (DEX tiebreak), turns/rounds, **surprise** (first-turn skip), action economy for Attack + Extra Attack/Multiattack, **Dash/Disengage/Dodge/Help/Hide**, opportunity attacks (respects Disengage), Ready, reaction budget.
- **Movement:** 5-5-5 grid, speed budget, Bresenham line-of-sight enforced on attacks/spells; **cover** (half +2 / three-quarters +5 AC & Dex saves; total cover = wall blocks targeting).
- **Damage/Healing:** HP/temp-HP soak, critical hits (dice doubling, adjacent auto-crit on prone/unconscious), healing clamp, death saving throws, 0-HP downing clears concentration.
- **Concentration:** start/replace/break, CON save DC `max(10, dmg/2)`, strips linked effects.
- **Conditions (accurate):** Incapacitated, Invisible, Paralyzed, Poisoned, Prone, Restrained, Stunned, Unconscious.
- **Spell engine (declarative):** slots, upcasting, save DC `8+PB+mod`, spell attack bonus, cantrip scaling by tier, AoE sphere/cone/line/cube, **126 golden-tested combat spells**, ENG-13 active effects (Shield/Bless/Bane/Hunter's Mark/Faerie Fire/Blur/Haste).
- **Class features wired:** Second Wind, Action Surge.
- **Gameplay Toolbox handlers:** traps, poisons (injury+ingested), curses, environmental effects, fear/stress, encounter XP budget; exploration hazards Burning (1d4/turn) & Falling (1d6/10ft, max 20d6) — both PDF-accurate.
- **Codex:** all 10 SRD content families browsable with attribution.

---

## 5. 🟡 Partial (present but incomplete)

| ID | Area | Works | Missing vs PDF |
|---|---|---|---|
| SRD-FID-16 | Saving throws | d20 + ability mod + **class save proficiency**, condition auto-fail/adv | skill proficiency not on entity yet |
| SRD-FID-16 | Skill/tool/weapon proficiency | added when caller passes `proficient:true` | not stored on `EntityState`; engine can't self-derive |
| SRD-FID-19 | Temp HP | soaks damage first | **`grant_temp_hp` command + False Life** (SRD-FID-19) |
| ENG-9 | Short rest / Hit Dice | emits `Rested`, optional heal | **no Hit Dice pool tracked** |
| SRD-FID-20 | Grappled / Frightened / Blinded / Deafened / Petrified / Charmed | declared + core effect | **Done** — `escape_grapple`; frightened LOS gates; blinded/deafened auto-fail; petrified resistances. Charmed social-only facets still deferred. |
| SRD-FID-21 | Class & subclass features | text + resource counters | **Partial** — Sneak Attack, Rage, Bardic Inspiration wired (PR #334); Ki/Metamagic/Invocations/subclass mechanics still display-only. |
| SRD-FID-22 | Species traits | full trait text | **0 mechanical** (Darkvision, Breath Weapon, Lucky, Powerful Build, lineage spells…) |
| SRD-FID-23 | Feats | full Codex catalog | **8 mechanical**; rest recorded but inert |
| SRD-FID-24 | Weapons | finesse, reach, ranged ability | Light/Heavy/Loading/Ammunition/Thrown/Versatile/long-range; **weapon mastery display-only** |
| SRD-FID-25 | Armor | AC calc (light/med/heavy/shield/Dex cap) | stealth disadvantage, Str requirement, **Armor Training (2024)**, don/doff |
| ENG-2/ENG-3 | Spell coverage | 126 deep handlers | ~165 lossy Open5e auto-conversions; ~172 cast with no effect (Aid, Animate Dead, divinations…) |
| SRD-FID-27 | Spellcasting rules | slots, DC, upcast, concentration | **ritual casting, V/S/M components, prepared-vs-known class models, Warlock pact slots at runtime** |
| DATA-1c/PLAY-15 | Monsters | 331 catalog rows | **8 engine templates**; no legendary/reactions/spellcasting render; AI uses generic 1d6 |
| SRD-FID-29 | Magic items | ~203 catalog + rarity/attunement metadata | no effect schema, **no attunement-limit enforcement**, no charges/activation, no cursed-item type |
| DATA-1b | Toolbox depth | handlers per topic | sample seeds only; contact/inhaled poison rejected; contagion spread, prolonged-stress slugs rejected; hourly env ticks skipped |

---

## 6. 🔴 Not implemented at all

| ID | Item | Notes |
|---|---|---|
| SRD-FID-18 | **Difficult terrain** movement cost | PR #330 — `SceneMap.difficultCells`; `movementCostFeet` doubles entered squares in handler + projection. |
| SRD-FID-19 | **Resistance / Vulnerability / Immunity** | PR #331 — `adjustDamageAmount` on entity damage lists across damage paths |
| ENG-8 | **Instant death / massive damage**, crit-doubles-death-failures, Stabilize action | partially overlaps SRD-FID-13 |
| SRD-FID-30 | **Mounted combat**, **Underwater combat** | |
| SRD-FID-14 | **Two-weapon fighting**, **unarmed strike** rules, **Shove**, **Grapple action** | conditions exist; actions don't |
| PLAY-15 | **Legendary / lair actions** | |
| SRD-FID-26 | **Tools, mounts & vehicles, lifestyle expenses, hirelings, services** | no engine model |
| SRD-FID-31 | **Crafting** (nonmagical, potions of healing math, spell-scroll casting, magic-item crafting) | |
| SRD-FID-32 | **Spell classes:** summoning, true polymorph/wild-shape stat swap, persistent wall/zone, general teleportation, divination, banishment removal, restoration condition-removal, command-obedience | |
| SRD-FID-28 | **2024 glossary mechanics:** Bloodied, Heroic Inspiration (reroll), Emanation/Cylinder AoE shapes, Armor Training penalties, Dehydration/Malnutrition/Suffocation hazards | |

---

## 7. Custom product layer — *correctly* beyond the SRD (no fidelity obligation)

These have **no basis in the SRD document** and are the product layer built on top of the ruleset. They are **not** gaps — listed so they're never mistaken for SRD coverage debt. (Per user direction, 2026-06-29.)

| Area | Where |
|---|---|
| AI-GM narrative chat + input modes | `play-surface.tsx`, `chat-zone.tsx`, `@app/llm` |
| Realms — 7 worldbuilding generators + relationships/graph | `realms.ts`, `realms-browser.tsx`, `generator.ts` |
| Smithy — homebrew library/forge | `smithy.ts`, `smithy-browser.tsx` |
| Quests / plot-hook pipeline | `quests-section.tsx`, `hooks-tab.tsx`, `@app/engine/quests` |
| Campaign overworld map & per-campaign discovery | `world-map-tab.tsx`, `overworld-grid.tsx`, `world-tab.tsx` |
| Memory / recap tier (pins, recaps, RAG) | `@app/memory`, `memory/recap.ts`, `play-panel-content.tsx` |
| Yjs multiplayer / live session | `@app/ws-server`, `use-live-session.ts` |
| Tutorial micro-campaign ("Lantern's Last Flicker") | `tutorial/*`, tutorial fixtures |
| GM persona / art-style lock / play tempo | `settings-tab.tsx` |

These are governed by their own roadmap rows in `deferrals.md` (GEN-*, REALM-*, SMITH-*, CAMP-*, PLAY-*, MEM-*, TUT-*), **not** by `SRD-FID-*`.

---

## 8. Coverage counts (snapshot 2026-06-29)

| Metric | Value |
|---|---|
| SRD spells in Codex (`srd-2024`) | 339 |
| Spells with hand-authored combat handlers (golden-tested) | 126 |
| Spells auto-converted from Open5e (lossy) | ~165 |
| Spells cast-with-no-effect (catalog-only) | ~172 |
| Monsters in Codex | 331 |
| Monsters with engine combat templates | 8 (~2.4%) |
| Standard actions implemented | 3 of 12 (Attack, Magic, Ready) |
| Conditions rules-accurate | ~9 of 15 |
| Feats mechanically implemented | 8 |
| Class signature mechanics wired | 2 (Second Wind, Action Surge) |
| Subclass features wired | 0 |
| Species traits wired | 0 |
| Gameplay Toolbox seed rows | 44 |

---

## 9. Methodology / re-audit

The 2026-06-29 audit cross-referenced the PDF table of contents + key glossary entries against five read-only codebase sweeps:

1. **Combat & core rules** — `packages/engine/src/{engine.ts,combat/*,commands/*,projections/*}` + `engine.*.test.ts`.
2. **Character creation/classes** — `packages/engine/src/entities/*`, `packages/db/src/ingest/srd-*`, `apps/web/.../characters/*`.
3. **Spells** — `packages/engine/src/content/{spells,spell-registry*,open5e-spell}.ts`, `packages/db/.../open5e-spells.ts`, `generate-spell-registry.ts`.
4. **Equipment/items/monsters/toolbox** — `packages/engine/src/content/{weapons,armor-ac,items,monsters,*-seeds}.ts`, `commands/*-handlers.ts`, `packages/db/src/ingest/*`.
5. **Product surfaces** — `apps/web/src/` (Codex, sheet, creation, Live Play).

**To re-audit:** repeat the five sweeps after major engine work, confirm specific rules against the PDF (it's outside the workspace, so read with offset/limit rather than Grep), and update the chapter scorecard + `Last audited` dates. The version-audit DB counts re-run via `cd packages/db && npm run srd-audit:db`.

---

## 10. Related docs

- `docs/srd-version-audit.md` — SRD 5.1 → 5.2 **version** alignment (AUDIT-0–12, done).
- `docs/deferrals.md` §12 — `SRD-FID-*` work rows (scheduling source of truth).
- `docs/data-model-hazards.md` — Gameplay Toolbox data model.
- `docs/engine/architecture.md` — engine design (some sections proposal-stage).
