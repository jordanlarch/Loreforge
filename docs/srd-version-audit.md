# SRD 5.1 → 5.2 Version Audit

**Status:** **SRD-AUDIT-0–9 complete** (Jun 2026) — prod Codex on `srd-2024`; 339-spell registry catalog; docs PDF-first.  
**Date:** 2026-06-28  
**Branch baseline:** `main` (post PR #281 / #282)

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

**Remaining v1 work outside this audit:** deepen combat handlers for catalog-only spells (ENG-2), custom PDF ingest at GA (INFRA-6), background ASI wiring in creation wizard.

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
| **Rule sections** | nested under rulesets | *(no doc key on row)* | 56 | — | Codex Rules | ✅ |
| **Advanced rules** | `open5e-advanced-rules.ts` | `srd-2024` prefix filter | 30 | — | Codex Advanced | ✅ |
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

## Prod DB audit (post-migration, 2026-06-28)

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

**Suggested order:** 0 ✅ → 1 ✅ → 2 ✅ → 3 ✅ → 4 ✅ → 5 ✅ → 6 ✅ → 7 ✅ → 8 ✅ → 9 ✅ — **audit complete.**

---

## Verification checklist

| # | Check | Status |
|---|---|---|
| 1 | Codex: no `srd-2014` in spells/monsters; spell count **339** | ✅ |
| 2 | Creation: L1 + L5 walkthrough — 2024 class features (Ranger etc.) | ⏳ prod verify |
| 3 | Species picker shows **9** PDF species only | ✅ seeded |
| 4 | Subclass picker: 12 SRD subclasses only | ✅ |
| 5 | Sheet: fighting styles + origin feats from Codex | ✅ AUDIT-5 |
| 6 | `npm run srd-audit:db` — zero `srd-2014`; characters **0** | ✅ |
| 7 | Engine + relevant unit tests green | ✅ CI |

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
| Nightly spell job | `apps/web/src/trigger/ingest-spells.ts` |
| Canonical PDF | `SRD_CC_v5.2.1.pdf` (user Downloads) |
| Ingest policy | `docs/data-sources.md` §1 |
