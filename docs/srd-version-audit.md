# SRD 5.1 → 5.2 Version Audit

**Status:** **SRD-AUDIT-0–10 complete** (Jun 2026) — prod Codex on `srd-2024` target; Gameplay Toolbox on hand-seeded `codex_toolbox_entries`; legacy `codex_advanced_rules` retired from ingest/UI.  
**Date:** 2026-06-28 (AUDIT-0–9); **2026-06-27** (AUDIT-10 post–DATA-1b)  
**Branch baseline:** `main` (post PR #290 / toolbox fear-stress)

This document is the canonical inventory of where Loreforge still runs **SRD 5.1 / 2014 PHB** content versus the locked **SRD 5.2 (2024)** target. Execution slices are tracked in `docs/deferrals.md` as `SRD-AUDIT-*`.

---

## Locked decisions (Jordan, 2026-06-28)

| Question | Decision |
|---|---|
| **Canonical reference** | **Official SRD PDF first** — `SRD_CC_v5.2.1.pdf` (WotC CC-BY 4.0, v5.2.1). Use Open5e `srd-2024` as the preferred *machine ingest* path where it matches the PDF; repo seed overrides where Open5e is wrong or incomplete. |
| **Existing characters** | **Delete all current characters** — no long-lived display aliases or slug migration. (Prod DB had **3** rows at audit time.) |
| **Spell handler scope** | Codex spell list **and** engine `SPELL_REGISTRY` must align to the **PDF canonical spell set** (~360 target locked for v1). Audit includes handler coverage reconciliation, not Codex-only. |
| **5e-bits API** | **Rejected** — never integrated; removed from ingest docs (SRD-AUDIT-9). 2014-only API; no 2024 corpus. |

---

## Executive summary (post-audit, Jun 2026)

The **SRD 5.1 → 5.2 migration slices (AUDIT-0–9) are complete.** Prod Codex spells/monsters run on Open5e `srd-2024` (**339** / **331** rows). Species seed is **9 PDF species**. Class features, fighting styles, and origin feats align to 5.2. Engine `SPELL_REGISTRY` lists **339** catalog entries (**124** hand-authored combat overrides). Legacy characters purged; third-caster (EK/AT) removed; docs state **PDF-first + Open5e-only** ingest.

**Remaining v1 work outside this audit:** deepen combat handlers for catalog-only spells (ENG-2), custom PDF ingest at GA (INFRA-6), background ASI wiring in creation wizard, **prod spell doc_key regression** (see SRD-AUDIT-10-R1), full PDF toolbox entry coverage (sample seeds only), **GRILL-EXPLORATION** (Playing the Game hazards — separate from Gameplay Toolbox).

---

## Canonical source reference

| Source | Role | Notes |
|---|---|---|
| `SRD_CC_v5.2.1.pdf` | **Truth for names, mechanics, spell list membership** | 364 pp; spell descriptions pp. 107–175; 9 species (no 2014 subraces); 4 backgrounds; 1 subclass/class; fighting style feats; weapon mastery properties |
| Open5e `srd-2024` | **Primary ingest API** (after PDF diff) | Spells **339**, creatures **331**, items **440**, backgrounds **4**, feats **17** (API counts 2026-06-28) |
| Open5e `srd-2014` | **Retired** | Pruned from prod spells/monsters (AUDIT-2/3) |
| 5e-bits (`dnd5eapi.co`) | **Rejected — not used** | 2014-only; removed from docs (AUDIT-9) |
| Repo curated seeds | **Override layer** | Species (9), classes, subclasses, class-features — all 5.2.1 PDF-sourced |

---

## Entity matrix (post-audit)

| Entity | Ingest / seed source | Document key / version | DB rows (prod audit) | Engine | Primary UI surfaces | Status |
|---|---|---|---:|---|---|---|
| **Spells** | `open5e-spells.ts` nightly job | `srd-2024` | 339 × `srd-2024` | `SPELL_REGISTRY` **339** catalog (**124** combat-authored) | Codex, Creation spell picker, Live Play cast, Smithy copy | ✅ AUDIT-2/6 |
| **Creatures / monsters** | `open5e-creatures.ts` | `srd-2024` | 331 × `srd-2024` | `MONSTER_TEMPLATES` (subset) | Codex Animals/Monsters | ✅ AUDIT-3 |
| **Items** | `open5e-items.ts` | `srd-2024` | 203 × `srd-2024` *(partial — API has 440)* | `open5eRawToItemDefinition`, weapon mastery | Codex, equipment, combat weapons | ⚠️ 5.2 key, incomplete count |
| **Backgrounds** | `open5e-backgrounds.ts` | `srd-2024` | 4 × `srd-2024` | — | Codex, Creation wizard | ✅ |
| **Feats** | `open5e-feats.ts` | `srd-2024` | 17 × `srd-2024` | Partial passives (Alert, Tough, …) | Codex, Creation ASI/feat picker | ✅ AUDIT-5 (fighting styles + origin feats) |
| **Rules chapters** | `open5e-rules.ts` | `srd-2024` | 11 × `srd-2024` | — | Codex Rules | ✅ |
| **Rule sections** | nested under rulesets | *(no doc key on row)* | 61 | — | Codex Rules | ✅ |
| **Gameplay Toolbox** | hand-seed `srd-toolbox-*.ts` + `seed-toolbox-*` CLIs | **`srd-2024_*` slugs** | **44** (8+14+4+9+9 by topic) | `toolbox-definitions.ts` | Codex **Gameplay Toolbox**, Smithy forge | ✅ **SRD-AUDIT-10** — replaces legacy Advanced IA |
| **Advanced rules (legacy)** | ~~`open5e-advanced-rules.ts`~~ **retired from nightly ingest** | **`srd_traps_*` legacy keys** | 30 orphan rows | — | *(no UI — removed)* | ⚠️ **orphan table** — drop in GA migration; Smithy maps `Advanced:` → `Toolbox` for old copies |
| **Species** | `srd-character-options.ts` seed | **Hand 5.2.1 PDF** (9 unified) | 9 × `source=srd` | — | Creation wizard, Codex | ✅ AUDIT-4 |
| **Classes** | `srd-character-options.ts` seed | **Hand 5.2.1 PDF** prose | 12 × `source=srd` | Slot tables, prof bonus | Creation, Codex | ✅ AUDIT-4 |
| **Subclasses** | `srd-subclasses.ts` + features | **Hand 5.2** | 12 × `source=srd` | `SUBCLASS_OPTIONS` | Creation, Codex, sheet | ✅ |
| **Class features (L1–20 stubs)** | `class-features.ts` | **Hand 5.2 / SRD** | — | Features tab, creation Features step | `features-tab.tsx`, `class-feature-choices.tsx` | ✅ AUDIT-1 |
| **Fighting styles** | Codex feat rows + pickers | **5.2 feats** | — | Combat modifiers | Creation, sheet Combat | ✅ AUDIT-5 |
| **Weapon mastery** | Open5e item raw | `srd-2024` items | partial | `weapon-mastery-open5e.ts` | Sheet Combat | ⚠️ verify vs PDF mastery table |
| **Spell slots / multiclass** | `spell-slots.ts`, etc. | SRD 5.2 pooled tables | — | Sheet Spells tab | `spells-tab.tsx` | ✅ AUDIT-7 (EK/AT removed; UI relabeled) |
| **Third-caster (EK/AT)** | — | **Removed** | — | — | — | ✅ AUDIT-7 (not in 2024 SRD) |
| **LLM narration** | `narration.ts` | Prompt says 5.2 | — | Live Play | — | ✅ |
| **Test fixtures** | `fixtures/party.ts` | Dwarf/Champion, Elf | — | Engine tests | — | ✅ AUDIT-8 |
| **Characters (legacy)** | — | — | **0** | — | — | ✅ AUDIT-8 purge |

---

## Prod DB audit (post–SRD-AUDIT-10, 2026-06-27)

Run locally: `cd packages/db && npm run srd-audit:db`

**Expected toolbox rows (hand-seed modules):**

| Topic | Seed module | Rows |
|---|---|---:|
| `trap` | `srd-toolbox-traps.ts` | 8 |
| `poison` | `srd-toolbox-poisons.ts` | 14 |
| `curse` | `srd-toolbox-curses.ts` | 4 |
| `environmental_effect` | `srd-toolbox-environmental-effects.ts` | 9 |
| `fear_stress` | `srd-toolbox-fear-stress.ts` | 9 |
| **Total** | | **44** |

**Snapshot (prod `.env.local`, 2026-06-27):**

```json
{
  "codex_spells": [{ "doc_key": "srd-2024", "n": 339 }],
  "codex_monsters": [{ "doc_key": "srd-2024", "n": 331 }],
  "codex_items": [{ "doc_key": "srd-2024", "n": 203 }],
  "codex_toolbox_entries": [
    { "topic": "curse", "n": 4 },
    { "topic": "environmental_effect", "n": 9 },
    { "topic": "fear_stress", "n": 9 },
    { "topic": "poison", "n": 14 },
    { "topic": "trap", "n": 8 }
  ],
  "codex_advanced_rules": [{ "doc_key": "(no document key)", "n": 30 }]
}
```

⚠️ **SRD-AUDIT-10-R1:** Spells regressed to **`srd-2014` × 319** (expected **`srd-2024` × 339**). **Fixed 2026-06-27** — `npm run ingest:open5e` pruned 319 legacy rows, upserted 339 `srd-2024`. Root cause TBD (likely manual/stale ingest or pre-AUDIT-2 env); nightly job uses `OPEN5E_SRD_DOCUMENT_KEY`.

---

## Prod DB audit (post-migration, 2026-06-28 — historical)

Run locally: `cd packages/db && npm run srd-audit:db`

```json
{
  "codex_spells": [{ "doc_key": "srd-2024", "n": 339 }],
  "codex_monsters": [{ "doc_key": "srd-2024", "n": 331 }],
  "codex_items": [{ "doc_key": "srd-2024", "n": 203 }],
  "codex_backgrounds": [{ "doc_key": "srd-2024", "n": 4 }],
  "codex_feats": [{ "doc_key": "srd-2024", "n": 17 }],
  "codex_rule_chapters": [{ "doc_key": "srd-2024", "n": 11 }],
  "codex_species": [{ "source": "srd", "n": 9 }],
  "codex_classes": [{ "source": "srd", "n": 12 }],
  "codex_subclasses": [{ "source": "srd", "n": 12 }],
  "characters": [{ "n": 0 }]
}
```

**Open5e API reference counts:** spells **339**, creatures **331**, items **440** (DB items still partial at 203).

---

## Grep audit — historical notes (pre-migration)

*Retained for provenance. Post-audit: no runtime `srd-2014` ingest constants; `third-caster-slots.ts` deleted; `class-features.ts` and species seed rewritten.*

### `srd-2014` (was ingest constants — **fixed AUDIT-2/3**)

| File | Notes |
|---|---|
| `packages/db/src/ingest/open5e-spells.ts` | Now `srd-2024` |
| `packages/db/src/ingest/open5e-creatures.ts` | Now `srd-2024` |
| `packages/db/src/ingest/open5e-items.ts` | Comment contrast only |

### `SRD 5.1` / `5.1 core` (was seeds — **fixed AUDIT-1/4**)

| File | Notes |
|---|---|
| `packages/db/src/ingest/srd-character-options.ts` | Now SRD 5.2.1 (9 species) |
| Policy docs | Updated AUDIT-9 (`data-sources.md`, AGENTS.md, …) |

### PHB labels (was engine/UI — **fixed AUDIT-7**)

| File | Context |
|---|---|
| `third-caster-slots.ts` | **Deleted** (EK/AT not in 2024 SRD) |
| `spells-tab.tsx` | Relabeled from "Apply PHB slots" |
| Slot tables | Comments updated to SRD 5.2 |

### 2014-only selectable content (was pickers/seeds — **fixed AUDIT-1/8**)

| Pattern | Resolution |
|---|---|
| `Battle Master` | Removed from fixtures; aliases dropped |
| `School of *` wizard schools | Alias layer removed |
| `Eldritch Knight` / `Arcane Trickster` | Removed with third-caster |
| 2014 Ranger stubs | Replaced with 2024 SRD features |

### 5e-bits

**Never integrated.** Removed from ingest docs (AUDIT-9). Historical mentions only in this audit doc and deferrals provenance rows.

---

## Spell coverage (post-AUDIT-6)

| Layer | Count | Notes |
|---|---:|---|
| Open5e `srd-2024` / prod `codex_spells` | **339** | Matches Open5e API |
| `SPELL_REGISTRY` catalog entries | **339** | Generated via `npm run generate:spell-registry` |
| Hand-authored combat overrides | **124** | Golden tests on authored set |
| Catalog-only stubs (no full combat resolution) | **~215** | ENG-2 backlog — deepen handlers individually |

Product lock remains **~360** spells; gap vs PDF is tracked via Open5e ↔ PDF diff (INFRA-6 at GA).

---

## 2024 SRD species (post-AUDIT-4)

**PDF Character Species (9):** Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling.

**Prod seed:** 9 unified species in `srd-character-options.ts` — matches PDF. Human Origin feat picker wired (AUDIT-5).

---

## Surface trace (DB → API → UI)

```
Open5e ingest ──► codex_* tables ──► codex.ts tRPC ──► Codex browse/detail
                              │
                              ├──► Creation wizard (species/classes/bg/spells/subclass)
                              ├──► Character sheet tabs (spells, features, combat)
                              └──► Smithy copy-from-Codex

Curated seeds ──► codex_species/classes/subclasses ──► same tRPC path

class-features.ts ──► engine export ──► features-tab, creation Features step
class-choices.ts  ──► creation pickers, normalizeSubclassName on sheet/Codex

SPELL_REGISTRY ──► engine cast/attack ──► Live Play turn bar (sheet ∩ registry)
```

---

## Execution slices (`SRD-AUDIT-*`)

| ID | Work | Depends on | Verify |
|---|---|---|---|
| **SRD-AUDIT-0** | This matrix + grep + DB audit | — | ✅ Done |
| **SRD-AUDIT-1** | Rewrite `class-features.ts` (all 12 classes to 2024 SRD) | — | ✅ Done |
| **SRD-AUDIT-2** | Spells ingest → `srd-2024` + prune + diff report | PDF spell list | ✅ Done |
| **SRD-AUDIT-3** | Creatures ingest → `srd-2024` + prune | — | ✅ Done |
| **SRD-AUDIT-4** | Re-seed `srd-character-options.ts` (9 species, 2024 class blurbs) | PDF | ✅ Done |
| **SRD-AUDIT-5** | Fighting style ↔ Codex feat rows; origin feats | Feats ingest ✅ | ✅ Done |
| **SRD-AUDIT-6** | Spell registry ↔ PDF canonical list (handlers) | SRD-AUDIT-2 | ✅ Done |
| **SRD-AUDIT-7** | Engine slot/multiclass vs 2024 rules; remove EK/AT third-caster | SRD-AUDIT-1/4 | ✅ Done |
| **SRD-AUDIT-8** | UI copy + fixtures; delete all characters; drop legacy aliases | Jordan purge OK | ✅ Done |
| **SRD-AUDIT-9** | Docs cleanup (`data-sources.md`, AGENTS.md); remove 5e-bits references | — | ✅ Done |
| **SRD-AUDIT-10** | Gameplay Toolbox IA + legacy Advanced retirement; PDF/toolbox gap matrix | post–DATA-1b (#286–#290) | ✅ Done |

**Suggested order:** 0 ✅ → … → 9 ✅ → **10 ✅** — **audit program complete** (follow-ups tracked as R1 / GRILL-EXPLORATION / INFRA-6).

---

## SRD-AUDIT-10 — Gameplay Toolbox alignment (2026-06-27)

Post–DATA-1b audit after all five GRILL sessions shipped (traps → fear/stress). Canonical spec: `docs/data-model-hazards.md`.

### Codex IA vs PDF

| PDF chapter | Codex nav | Storage | Status |
|---|---|---|---|
| **Gameplay Toolbox** (Traps, Poisons, Curses and Magical Contagions, Environmental Effects, Fear and Mental Stress) | **Gameplay Toolbox** (replaced **Advanced**) | `codex_toolbox_entries` + `codex_rule_sections` per topic | ✅ two-tier UI + rules slugs `srd-2024_*-rules` |
| **Playing the Game → Exploration** (frigid water, thin ice, … overlap) | *(not in toolbox)* | — | ⏳ **GRILL-EXPLORATION** — separate entity model; do not merge into toolbox |
| Open5e `/v2/rules/` legacy keys (`srd_traps_*`, `srd_diseases_*`, …) | *(removed)* | `codex_advanced_rules` orphan | ✅ nightly ingest stopped; dead tRPC removed |

### Terminology locks

| Wrong (legacy) | Correct (PDF / Loreforge) |
|---|---|
| Codex **Advanced** | **Gameplay Toolbox** |
| `srd_traps_poison_needle` | `srd-2024_poison-needle` |
| "disease" nav / `srd_diseases_*` | **Curses and Magical Contagions** / `curse` topic |
| `srd_madness_*` | **Fear and Mental Stress** / `fear_stress` topic |
| `HAZARD_KINDS` / hazard-definitions | **toolbox-definitions** (hazard re-exports deprecated) |
| Open5e exploration hazards in toolbox ingest | **Environmental Effects** (toolbox) ≠ **Exploration hazards** (P:tG) |

### Ingest policy (locked)

| Corpus | v1 path | Full PDF at GA |
|---|---|---|
| Gameplay Toolbox entries | **Hand-seed** from PDF samples (`packages/db/src/ingest/srd-toolbox-*.ts`) | INFRA-6 custom ingest or expanded hand-seeds |
| Toolbox rules prose | `codex_rule_sections` via seed scripts | same |
| Open5e advanced rules API | **Retired** — wrong keys, prose-only, no Q3 definitions | Drop `codex_advanced_rules` table |

### Coverage gaps (expected v1)

Hand-seeds are **PDF samples**, not exhaustive. Full PDF trap/poison/etc. lists are GA / INFRA-6 scope. Engine validates Q3 shape; Smithy forge forms are **best-effort** (complex mechanics in prose fields).

### Code changes (SRD-AUDIT-10 slice)

- `srd-audit-db.ts` — adds `codex_toolbox_entries` by topic
- `ingest-spells.ts` (Trigger) — removed `ingestOpen5eAdvancedRules`
- `codex.ts` tRPC — removed `listAdvancedRules` / `advancedFacets` / `getAdvancedRule`
- `open5e-advanced-rules.ts` — marked `@deprecated`; manual CLI retained for diff only

### Follow-ups

| ID | Item | Owner |
|---|---|---|
| **SRD-AUDIT-10-R1** | Prod spell `doc_key` regression | ✅ Done 2026-06-27 |
| **SRD-AUDIT-12** | Runtime/UI congruence sweep (no PHB / 2014 / non-SRD refs) | ✅ Done 2026-06-27 — see below |
| **GRILL-EXPLORATION** | Playing the Game exploration hazards + glossary | Separate from toolbox — blocked until Jordan schedules grill |
| **INFRA-6** | Full PDF-normalized ingest at GA | Custom SRD 5.2 pipeline |
| **GA migration** | Drop `codex_advanced_rules` table + migration | After orphan row audit / Smithy copy backfill |
| **GRILL-LIVE-TOOLBOX** | Live Play detect/disable/trigger toolbox entries | Deferred from GRILL-TRAP Q7 — needs new grill session |

---

## SRD-AUDIT-12 — Runtime congruence sweep (2026-06-27)

Grep + manual review of **apps/**, **packages/engine**, **packages/llm**, and user-visible **apps/web** copy. Goal: no **PHB**, **2014**, **SRD 5.1**, or non-SRD selectable content in runtime paths.

### Clean ✅

| Area | Finding |
|---|---|
| **Codex / Creation UI** | Labels reference **SRD 5.2** or **5E SRD 5.2**; species picker **9 PDF species**; subclasses **12 SRD only** |
| **Spell/creature ingest** | `OPEN5E_SRD_DOCUMENT_KEY = srd-2024`; prod spells **339 × srd-2024** post-R1 |
| **LLM prompts** | `generator.ts`, `recap.ts` — **SRD 5.2** only |
| **Class features / choices** | 2024 Ranger, Champion-only Fighter, no EK/AT/third-caster |
| **Codex footer** | SRD 5.2 OGL attribution |

### Fixed in this slice ✅

| File | Was | Now |
|---|---|---|
| `packages/engine/src/combat/attack.ts` | PHB comment | SRD 5.2 |
| `packages/engine/src/entities/abilities.ts` | PHB comment | SRD 5.2 |
| `apps/web/.../creation-wizard.tsx` | "Character Creator · 5E SRD" | "Character Creator · SRD 5.2" |

### Acceptable / non-runtime (no change)

| Pattern | Location | Rationale |
|---|---|---|
| `srd-2014`, `SRD 5.1`, `PHB` | `docs/srd-version-audit.md`, `docs/deferrals.md` | Audit provenance / historical rows |
| `5.1 / srd-2014` contrast | `open5e-items.ts` comment | Explains why items use 2024 key |
| `5.1→5.2` | `purge-all-characters.ts` comment | One-off CLI provenance |
| `§5.1` | `realms.ts`, `types.ts`, `events/types.ts` | **Doc section** refs (product-spec / arch), not SRD version |
| `Advanced Form` | Realms generator UI | Generator UX label — not Codex Advanced rules |
| `Advanced:` Smithy prefix | `smithy-categories.ts` | Legacy copy slug mapping → Toolbox |
| `HAZARD_KINDS` / `hazard-definitions` | engine re-exports | Deprecated aliases; canonical `toolbox-definitions` |
| `codex_advanced_rules` table | schema + deprecated ingest | Orphan rows; GA drop tracked |
| `RoundAdvanced` event | engine combat | Unrelated to Codex Advanced |

### Out of scope (tracked elsewhere)

| Item | Deferral |
|---|---|
| Full PDF toolbox entry coverage (samples only) | INFRA-6 |
| Exploration hazards | GRILL-EXPLORATION |
| Live Play toolbox resolution | GRILL-LIVE-TOOLBOX (was GRILL-TRAP Q7 defer) |
| Stale roadmap copy (`docs/02-implementation-roadmap.md` P1 `srd-2014` note) | Doc hygiene — update when editing roadmap |

---

## Verification checklist

| # | Check | Status |
|---|---|---|
| 1 | Codex: spells on `srd-2024`; count **339** | ✅ SRD-AUDIT-10-R1 (2026-06-27 prod re-ingest) |
| 2 | Creation: L1 + L5 walkthrough — 2024 class features (Ranger etc.) | ⏳ prod verify |
| 3 | Species picker shows **9** PDF species only | ✅ seeded |
| 4 | Subclass picker: 12 SRD subclasses only | ✅ |
| 5 | Sheet: fighting styles + origin feats from Codex | ✅ AUDIT-5 |
| 6 | `npm run srd-audit:db` — toolbox **44** rows; legacy advanced **30** orphan | ✅ |
| 7 | Engine + relevant unit tests green | ✅ CI |
| 8 | Codex **Gameplay Toolbox** nav; no **Advanced** surface | ✅ SRD-AUDIT-10 |

---

## Key files

| Area | Path |
|---|---|
| Audit script | `packages/db/src/scripts/srd-audit-db.ts` |
| Spell ingest | `packages/db/src/ingest/open5e-spells.ts` (`srd-2024`) |
| Creature ingest | `packages/db/src/ingest/open5e-creatures.ts` (`srd-2024`) |
| Species/classes seed | `packages/db/src/ingest/srd-character-options.ts` (9 species, 5.2.1) |
| Class feature stubs | `packages/engine/src/entities/class-features.ts` (5.2) |
| Subclasses | `packages/db/src/ingest/srd-subclasses.ts`, `srd-subclass-features.ts` |
| Spell registry generator | `packages/db/src/scripts/generate-spell-registry.ts` |
| Spell handlers | `packages/engine/src/content/spell-registry.ts` + `spell-registry-open5e.generated.ts` |
| Character purge CLI | `packages/db/src/scripts/purge-all-characters.ts` |
| Nightly Codex job | `apps/web/src/trigger/ingest-spells.ts` (spells/creatures/items/bg/feats/rules + character seed; **no** advanced rules) |
| Gameplay Toolbox seeds | `packages/db/src/ingest/srd-toolbox-*.ts`, `seed-toolbox-*.ts` |
| Legacy advanced (deprecated) | `packages/db/src/ingest/open5e-advanced-rules.ts` |
| Canonical PDF | `SRD_CC_v5.2.1.pdf` (user Downloads) |
| Ingest policy | `docs/data-sources.md` §1 |
