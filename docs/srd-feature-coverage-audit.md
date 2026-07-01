# SRD 5.2.1 Feature-Coverage Audit (living tracker)

**Purpose:** the canonical, continuously-updated record of **how faithfully Loreforge implements the SRD 5.2.1 ruleset** — what is implemented, partially implemented, not implemented, and (critically) what is implemented but **incongruent** with the document. This is the *coverage/fidelity* companion to `docs/srd-version-audit.md` (which tracks *version alignment*: is content labeled 5.1 vs 5.2).

**Canonical source:** `SRD_CC_v5.2.1.pdf` (WotC CC-BY 4.0, 364 pp). Local copy: `C:\Users\Jordan\Downloads\SRD_CC_v5.2.1.pdf`.

**First audited:** 2026-06-29 · **Last reconciled:** 2026-06-30 · **Branch baseline:** `main`.

**Tracking IDs:** fidelity gaps use the `SRD-FID-*` family and are mirrored as rows in `docs/deferrals.md` §12 (and, for the incongruences, GitHub issues). Where a gap is already tracked under another family (e.g. `ENG-8`, `ENG-9`, `ENG-13`, `DATA-1c`, `PLAY-15`), this doc points at that ID instead of minting a duplicate.

> **Why two SRD docs?** `srd-version-audit.md` answered *"is our content the 2024 edition?"* (yes — AUDIT-0–12 done). This doc answers the different question *"does the engine actually implement the rule, correctly?"* — and the answer is much more mixed. Content is correctly **labeled** 5.2; a large fraction of **mechanics** is catalog/display-only or simplified ("tracer") rather than rules-accurate.

---

## How to keep this current

**Scheduling source of truth:** `docs/deferrals.md` §12. **This doc must stay in sync** whenever §12 changes.

1. **When you ship a fidelity fix:** flip its **Status** here *and* in `docs/deferrals.md` §12 (don't delete rows — set `Done` with the PR). Update the chapter scorecard if a whole area changes verdict.
2. **When you find a new gap/incongruence:** add a row to the relevant table with the next `SRD-FID-*` id, mirror it to `deferrals.md` §12, and (if it's a correctness bug) open a GitHub issue.
3. **Ship-it gate:** `.cursor/skills/ship-it/SKILL.md` §7 requires updating **both** `deferrals.md` and this file for any `SRD-FID-*` ship.
4. **Periodic re-audit:** re-run the five domain sweeps (see [§9 Methodology](#9-methodology--re-audit)) after major engine work. Update **Last reconciled** at the top.
5. This doc is **reference, not backlog-of-record** — `deferrals.md` stays the single source of truth for *work scheduling*; this doc is the SRD-shaped *coverage map*.

**Status legend:** ✅ Implemented (engine-owned, rules-accurate) · 🟡 Partial (present, materially incomplete) · 🔴 Missing/catalog-only · ⚠️ **Incongruent** (runs, but contradicts the PDF).

---

## 1. Scorecard by SRD 5.2.1 chapter

| SRD chapter | Data/Catalog | Engine mechanics | Verdict | Tracking |
|---|---|---|---|---|
| Playing the Game — D20 Tests | n/a | checks/attacks ✅; save + skill/tool/weapon prof ✅ | 🟢 | SRD-FID-16 **Done** (PR #328, #350) |
| Playing the Game — Actions (12 standard) | n/a | Dash/Disengage/Dodge/Help/Hide ✅; Grapple/Shove/Use Object etc. ✗ | 🟡 | SRD-FID-14 **Done**; two-weapon/unarmed/shove/grapple open |
| Playing the Game — Combat order | n/a | initiative/turns/rounds/surprise ✅ | 🟢 | SRD-FID-17 **Done** |
| Playing the Game — Movement/position | n/a | grid/LOS/OA/cover/difficult terrain ✅ | 🟢 | SRD-FID-15, SRD-FID-18 **Done** |
| Playing the Game — Damage/Healing | n/a | HP/crit/heal/death saves/instant death ✅; resist/vuln/immunity ✅; temp-HP grant ✅ | 🟢 | SRD-FID-13, SRD-FID-19 **Done** |
| Conditions (15) | declared ✅ | ~12 accurate; Charmed social facets deferred | 🟡 | SRD-FID-3, SRD-FID-20 **Done** |
| Character Creation / Advancement | ✅ | XP/HP/ASI/multiclass/background ASI ✅ | 🟢 | SRD-FID-2 **Done** |
| Classes (12) | catalog ✅ | many signatures wired; remainder display-only | 🟡 | SRD-FID-21 **Partial** |
| Subclasses (12) | catalog ✅ | **12 of 12 wired** (≥1 mechanical tracer each) | 🟢 | SRD-FID-21b **Done** |
| Species (9) | catalog ✅ | traits **0 mechanical** | 🔴 | SRD-FID-22 |
| Backgrounds (4) | ingest ✅ | skills ✅; ASI ✅; origin feat partial | 🟡 | SRD-FID-2 **Done** |
| Feats | catalog ✅ | 8 of N mechanical | 🟡 | SRD-FID-23 |
| Equipment — Weapons | catalog ✅ | finesse/reach/ranged ✅; most props ✗; mastery display-only | 🟡 | SRD-FID-24 |
| Equipment — Armor | catalog ✅ | AC calc ✅; stealth/Str/Armor-Training ✗ | 🟡 | SRD-FID-25 |
| Equipment — Tools/gear/mounts/vehicles/lifestyle/hirelings | partial | none | 🔴 | SRD-FID-26 |
| Spells (~360) | 339 catalog ✅ | 126+ deep; ~165 lossy auto; tracer depth expanding | 🟡 | ENG-2, ENG-3, SRD-FID-12 |
| Spellcasting rules | n/a | slots/DC/upcast/concentration ✅; ritual/components/prepared-model ✗ | 🟡 | SRD-FID-27 |
| Rules Glossary terms | Codex ✅ | Cover ✅; Emanation shape ✅; Bloodied/Heroic Inspiration ✗ | 🟡 | SRD-FID-28 |
| Gameplay Toolbox | 44 hand-seeds | traps/poison/curse/env/fear handlers ✅ (sample depth) | 🟡 | DATA-1b |
| Magic Items (A–Z) | ~203/440 catalog | no effect schema, no attunement enforcement | 🔴 | SRD-FID-29 |
| Monsters (A–Z, ~300+) | 331 catalog ✅ | **8 combat templates (~2.4%)**; no legendary/lair | 🔴 | DATA-1c, PLAY-15 |
| Animals | catalog ✅ | 1 template (wolf) | 🔴 | DATA-1c |

---

## 2. ⚠️ Incongruences — implemented but contradicts SRD 5.2.1

These run today and produce **wrong results** vs the PDF. Mirrored to `docs/deferrals.md` §12.1 and GitHub issues #310–#322.

**2026-06-29 fix pass:** FID-1–6, FID-10 fixed; FID-12 partially fixed (Flame Strike). **2026-06-30 pass:** FID-7–9, FID-11, FID-13 **Done** (PR #346–#347, #350–#351). **§12.1 incongruence queue is clear** except FID-12 tracer depth (ongoing).

| ID | Feature | Status |
|---|---|---|
| **SRD-FID-1** | Exhaustion (2024 uniform model) | ✅ **Done** — PR #326 area |
| **SRD-FID-2** | Background ASI | ✅ **Done** — PR #326 |
| **SRD-FID-3** | Frightened can't-approach + check disadvantage | ✅ **Done** |
| **SRD-FID-4** | Faerie Fire cube | ✅ **Done** |
| **SRD-FID-5** | Spirit Guardians emanation | ✅ **Done** |
| **SRD-FID-6** | Open5e save `half_damage` defaults | ✅ **Done** — 68 spells corrected |
| **SRD-FID-7** | Hex any-attack + check rider | ✅ **Done** — PR #346 |
| **SRD-FID-8** | Scorching Ray per-ray spell attacks | ✅ **Done** — PR #346 |
| **SRD-FID-9** | Revivify raises dead | ✅ **Done** — PR #347 |
| **SRD-FID-10** | Sleep (2014 claim retracted) | ✅ **Done/retracted** |
| **SRD-FID-11** | Counterspell / Dispel interrupt + contest | ✅ **Done** — PR #346, #349 |
| **SRD-FID-12** | Tracer spells (zones, polymorph, summons, …) | 🟡 **Partial** — PR #348 (Wall of Fire, Polymorph, Spiritual Weapon); PR #352 (Moonbeam, Call Lightning engine, Spirit Guardians); PR #355 (Cloudkill, Stinking Cloud, Haste depth). Live Play Call Lightning strike button wired. Remaining: Banishment, … (ENG-3 overlap) |
| **SRD-FID-13** | Damage at 0 HP (crit failures, instant death) | ✅ **Done** — PR #346 area |

---

## 3. Next-up: cheap, high-visibility combat completeness

| ID | Feature | Status |
|---|---|---|
| **SRD-FID-14** | Standard actions Dash / Disengage / Dodge / Help / Hide | ✅ **Done** — PR #327 |
| **SRD-FID-15** | Cover (half +2 / three-quarters +5) | ✅ **Done** — PR #327 |

---

## 4. ✅ Implemented (engine-owned, rules-accurate)

Work end-to-end with deterministic math + tests (751 engine tests, Jun 2026):

- **D20 core:** ability checks with skill/tool/weapon proficiency on `EntityState`; attack rolls; advantage/disadvantage stacking.
- **Progression:** proficiency bonus, HP, XP, ASI, multiclass, background ASI.
- **Combat loop:** initiative, surprise, turns/rounds, action economy, Dash/Disengage/Dodge/Help/Hide, opportunity attacks, Ready, reactions, cover, difficult terrain.
- **Damage/Healing:** resist/vuln/immunity, temp HP grant, crit death-save doubling, instant death overflow, death saves.
- **Concentration:** start/replace/break, CON save, linked effect/zone cleanup.
- **Conditions:** Incapacitated, Invisible, Paralyzed, Poisoned, Prone, Restrained, Stunned, Unconscious, grapple escape, frightened/blinded/deafened gates, petrified resistances.
- **Spell engine:** slots, upcast, saves, spell attacks, AoE shapes (sphere/cone/line/cube/**emanation**), **126+ golden-tested** spells; persistent spell zones (Wall of Fire, Moonbeam, Call Lightning, Cloudkill, Stinking Cloud); Spirit Guardians aura; Spiritual Weapon + Call Lightning strike commands; Haste extra action + lethargy.
- **Class/subclass features:** Second Wind, Action Surge, Sneak Attack, Rage, Bardic Inspiration, Monk/Metamagic/Warlock/Paladin tracers; **all 12 SRD subclasses** have ≥1 wired feature (SRD-FID-21b).
- **Gameplay Toolbox:** traps, poisons, curses, environmental effects, fear/stress; exploration Burning & Falling.
- **Codex:** all 10 SRD content families browsable.

---

## 5. 🟡 Partial (present but incomplete)

| ID | Area | Missing vs PDF |
|---|---|---|
| SRD-FID-12 | Tracer spells | Banishment, … (Cloudkill / Stinking Cloud zones + Haste extra action shipped PR #355) |
| SRD-FID-21 | Class features | Remaining base-class features; Live Play wiring for some (PR #351 shipped Indomitable/Lay on Hands/Spiritual Weapon) |
| SRD-FID-22 | Species traits | 0 mechanical |
| SRD-FID-23 | Feats | 8 mechanical; rest inert |
| SRD-FID-24 | Weapons | Light/Heavy/Loading/Ammo/Thrown/Versatile; mastery effects display-only |
| SRD-FID-25 | Armor | stealth disadvantage, Str req, Armor Training |
| ENG-2/ENG-3 | Spell coverage | ~165 lossy Open5e auto-conversions; ~172 no-effect casts |
| SRD-FID-27 | Spellcasting rules | ritual, V/S/M components, prepared-vs-known runtime |
| ENG-9 | Short rest / Hit Dice | no Hit Dice pool tracked |
| DATA-1c/PLAY-15 | Monsters | 8 engine templates; no legendary/lair |
| SRD-FID-29 | Magic items | catalog only; no effect schema or attunement limit |
| DATA-1b | Toolbox depth | sample seeds only |

---

## 6. 🔴 Not implemented at all

| ID | Item |
|---|---|
| SRD-FID-26 | Tools, mounts & vehicles, lifestyle, hirelings, services |
| SRD-FID-30 | Mounted combat, Underwater combat |
| SRD-FID-14 (remainder) | Two-weapon fighting, unarmed strike rules, Shove, Grapple **action** |
| PLAY-15 (remainder) | Legendary / lair actions |
| SRD-FID-31 | Crafting |
| SRD-FID-32 (remainder) | Summoning, teleportation, divination, banishment removal, restoration, command-obedience (persistent zones **partially** shipped under FID-12) |
| SRD-FID-28 | Bloodied, Heroic Inspiration, dehydration/malnutrition/suffocation hazards |

---

## 7. Custom product layer — *correctly* beyond the SRD

These have **no basis in the SRD document** and are the product layer. **Not** SRD coverage debt. Governed by `deferrals.md` (GEN-*, REALM-*, SMITH-*, CAMP-*, PLAY-*, MEM-*, TUT-*), not `SRD-FID-*`.

| Area | Where | Status (Jun 2026) |
|---|---|---|
| AI-GM narrative chat + input modes | `play-surface.tsx`, `@app/llm` | **Partial** — real narration, check mode via engine (PLAY-1/2) |
| Realms — 7 generators | `realms.ts`, generators | **Mostly shipped** — tab depth partial |
| Smithy — homebrew library | `smithy.ts` | **MVP Done** |
| Quests / plot-hook pipeline | `hooks-tab.tsx`, `@app/engine/quests` | **Partial** — Phase D; combat/step triggers in progress |
| Campaign overworld map & discovery | `world-map-tab.tsx` | **Partial** — grid + territory painting (CAMP-7) |
| Memory / recap tier | `@app/memory` | **Largely shipped** (MEM-1–8) |
| Yjs multiplayer / live session | `@app/ws-server` | **Tier 4 shipped**; invites partial (CAMP-14) |
| Tutorial ("Lantern's Last Flicker") | `tutorial/*` | **Done** (TUT-1, #169–#178) |
| GM persona / art-style / tempo | Settings + pacing | **Partial** (CAMP-10, PLAY-5) |

---

## 8. Coverage counts (snapshot 2026-06-30)

| Metric | Value |
|---|---|
| Engine unit tests | 751 |
| SRD spells in Codex (`srd-2024`) | 339 |
| Spells with hand-authored combat handlers (golden-tested) | 126+ |
| Spells auto-converted from Open5e (lossy) | ~165 |
| Spells cast-with-no-effect (catalog-only) | ~172 |
| Monsters in Codex | 331 |
| Monsters with engine combat templates | 8 (~2.4%) |
| Standard actions implemented | 8 of 12 (Attack, Magic, Ready, Dash, Disengage, Dodge, Help, Hide) |
| Conditions rules-accurate | ~12 of 15 |
| Feats mechanically implemented | 8 |
| Subclass features wired (tracer depth) | 12 of 12 SRD subclasses |
| Species traits wired | 0 |
| Gameplay Toolbox seed rows | 44 |

---

## 9. Methodology / re-audit

The 2026-06-29 audit cross-referenced the PDF against five codebase sweeps (combat, characters, spells, equipment/monsters/toolbox, product surfaces). **Reconcile this doc with `deferrals.md` §12 after every fidelity PR**; full re-audit sweeps after major engine milestones.

DB counts: `cd packages/db && npm run srd-audit:db`.

---

## 10. Related docs

- `docs/srd-version-audit.md` — SRD 5.1 → 5.2 **version** alignment (AUDIT-0–12, done).
- `docs/deferrals.md` §12 — `SRD-FID-*` work rows (**scheduling source of truth**).
- `docs/data-model-hazards.md` — Gameplay Toolbox data model.
- `docs/engine/architecture.md` — engine design (some sections proposal-stage).
