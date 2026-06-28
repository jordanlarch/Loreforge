# Gameplay Toolbox + exploration hazards — grill backlog (DATA-1b)

**Status:** **Traps v1 shipped** (DATA-1b). Codex **Gameplay Toolbox** + Smithy toolbox entries live for traps. Sibling topics (poison/curse/env/fear) have locked grill decisions; seeds deferred per topic slice.

## SRD 5.2 PDF taxonomy (canonical — do not conflate)

| PDF location | Content | Loreforge target |
|---|---|---|
| **Gameplay Toolbox** | Traps; Poisons; Curses and Magical Contagions; Environmental Effects; Fear and Mental Stress | Codex **Gameplay Toolbox** nav; `codex_toolbox_entries`; mandatory structured definitions per entry |
| **Playing the Game → Exploration** | Exploration play guidance incl. **hazards** (distinct topic) | Separate from Gameplay Toolbox — glossary-backed |
| **Rules Glossary** | Expanded hazard definitions | Engine reference / Codex glossary cross-links |

**Traps are not "hazards" in SRD terms.** Current code (`HAZARD_KINDS`, `codex_advanced_rules`, Codex **Advanced** nav) reflects 5.1/Open5e drift — fix in **SRD-AUDIT-10** (full PDF alignment audit post–GRILL-TRAP).

---

## GRILL-TRAP — locked decisions

### Q1 — Source of truth ✅ (2026-06-28)

**Hybrid C**, with these locks:

| Layer | What | Required `definition`? | Editable in Smithy? |
|---|---|---|---|
| **Toolbox rules** | How traps/poisons/etc. work (SRD prose) | No — prose only | No — compiled into engine backend |
| **Trap entries** | Individual traps (Falling Net, Poison Needle, …) | **Yes — mandatory `TrapDefinition`** | Yes — copy from Codex, edit like items |
| **Codex display** | Player-facing reference | Entries show prose + data-definition panel (like Codex Items) | Copy → Smithy |

Rules prose is **not** optional overlay on entries; it lives separately from entry records.

### Q2 — Codex IA under Gameplay Toolbox ✅ (2026-06-28)

**Option A — Two-tier per topic.**

- Rename Codex nav **`Advanced` → `Gameplay Toolbox`**
- Each topic (Traps, Poisons, …) shows:
  1. **Rules article** at top (read-only; engine-authoritative, Codex mirror)
  2. **Entry list** below (individual traps with mandatory `TrapDefinition` + data-definition panel)

### Q3 — `TrapDefinition` required fields ✅ (2026-06-28)

**Option B — PDF-faithful.**

Every trap entry **must** include:

| Field | Required | Notes |
|---|---|---|
| `trigger` | Yes | When the trap fires |
| `effect` | Yes* | Structured: `save`, `damage[]`, `conditions[]` — **or** `effectProse` for edge cases |
| `detect` | When PDF lists it | `{ dc, ability, skill? }` |
| `disable` | When PDF lists it | `{ dc, ability, tool? }` |
| `reset` | Default `once` | `once` \| `manual` \| `timed` |

### Q4 — Database storage ✅ (2026-06-28, taxonomy corrected)

**Option B — new entry table (not `codex_advanced_rules`).**

- Table: **`codex_toolbox_entries`** (not `codex_hazard_entries`)
- Columns: `slug`, `name`, `description`, **`topic`** (`trap` \| `poison` \| `curse` \| `environmental_effect` \| `fear_stress`), **`definition jsonb NOT NULL`**, `source`, `raw`, `sort_index`
- Toolbox **rules** prose → `codex_rule_sections` under Gameplay Toolbox chapter + engine constants
- Retire `codex_advanced_rules` for entry data after 5.2 re-ingest
- Smithy mirror: **`homebrew_toolbox_entries`** (or per-topic naming TBD in GRILL-POISON)

### Q5 — Exploration hazards scope ✅ (2026-06-28)

**Option A — Separate program.**

- GRILL-TRAP + DATA-1b v1 = **Gameplay Toolbox → Traps** only
- **Playing the Game → Exploration** hazards + **Rules Glossary** → **GRILL-EXPLORATION** after **SRD-AUDIT-10**
- Do not put exploration hazards in `codex_toolbox_entries`

### Q6 — Trap entry ingest at v1 ✅ (2026-06-28)

**Option C — Hybrid.**

- **Hand-seed** SRD 5.2 PDF sample traps as authoritative v1 rows with mandatory Q3 `TrapDefinition`
- **Rewrite** Open5e ingest for 5.2 toolbox keys in parallel — prose/superset only
- **Hard gate:** ingest must not write a trap row without a valid `TrapDefinition` (no prose-only trap entries)
- **SRD-AUDIT-10** reconciles Open5e vs PDF and expands coverage

### Q7 — v1 implementation slice ✅ (2026-06-28)

**Option B — Codex + Smithy.**

| In v1 | Deferred |
|---|---|
| Gameplay Toolbox nav rename; `codex_toolbox_entries` migration | Live Play trap resolution (detect/disable/effect) |
| Hand-seed PDF sample traps + two-tier Traps UI + data-definition panel | Campaign/dungeon scene attachment |
| `homebrew_toolbox_entries` + Copy to Smithy + forge/edit form (Q3 fields) | SRD-AUDIT-10 execution (separate program after v1 verify) |
| Engine `TrapDefinition` validation + rename `hazard-definitions` → `toolbox-definitions` | Open5e ingest rewrite (parallel, not blocking v1) |

### Q8 — Traps rules article source ✅ (2026-06-28)

**Option B — DB rule section.**

- Hand-seed **`codex_rule_sections`** row under **Gameplay Toolbox → Traps** chapter (PDF prose)
- Codex renders read-only at top of Traps two-tier page
- Engine references same content via **shared seed module** (single authoring source until SRD-AUDIT-10 ingest)

### Q9 — Entry slug scheme ✅ (2026-06-28)

**Option A — `srd-2024_<kebab-name>`.**

- Aligns with spells, items, feats (`srd-2024_poison-needle`, …)
- Hand-seed v1 traps use this pattern; legacy `srd_traps_*` slugs retired on migrate
- SRD-AUDIT-10 maps Open5e keys to same scheme

---

## GRILL-TRAP — COMPLETE ✅

All nine decisions locked. **DATA-1b v1** implementation slice is unblocked.

### Implementation checklist (v1 — Option B) ✅

1. **Engine** — ✅ `toolbox-definitions.ts`; Q3 `TrapDefinition`; deprecated `hazard-definitions` re-exports
2. **DB** — ✅ migration `0039`; seed PDF sample traps + Traps rules section (`npm run seed:toolbox-traps`)
3. **Codex** — ✅ **Gameplay Toolbox** nav; Traps two-tier UI; data-definition panel
4. **Smithy** — ✅ `homebrew_toolbox_entries`; Copy from Codex; trap forge/edit form
5. **Defer** — Live Play resolution; campaign scene attachment; sibling topic seeds; Open5e ingest rewrite; SRD-AUDIT-10; GRILL-EXPLORATION

### Code rename ✅

`hazard-definitions.ts` re-exports from `toolbox-definitions.ts` with deprecated aliases.

---

## Post–GRILL-TRAP deliverable: SRD-AUDIT-10

After GRILL-TRAP (and sibling grill sessions), run a **complete project audit** against SRD 5.2 PDF:

- Codex nav labels vs PDF chapter names
- Every ingest corpus (`srd-2024` vs legacy `srd_*` prefixes)
- Engine/UI terminology ("Advanced", "hazard", "disease" vs "Curses and Magical Contagions", …)
- Row counts and missing Gameplay Toolbox entries
- Glossary + Exploration hazards coverage

Track in `docs/srd-version-audit.md` + `docs/deferrals.md`.

---

## Proposed grill order (one session each)

| Session | PDF section | Status |
|---|---|---|
| **GRILL-TRAP** | Gameplay Toolbox → Traps | **COMPLETE** (Q1–Q9, 2026-06-28) |
| **GRILL-POISON** | Gameplay Toolbox → Poisons | **COMPLETE** (inherits TRAP; Q3 locked) |
| **GRILL-CURSE** | Gameplay Toolbox → Curses and Magical Contagions | **COMPLETE** (inherits TRAP; Q3 locked) |
| **GRILL-ENV-EFFECT** | Gameplay Toolbox → Environmental Effects | **COMPLETE** (inherits TRAP; Q3 locked) |
| **GRILL-FEAR** | Gameplay Toolbox → Fear and Mental Stress | **COMPLETE** (inherits TRAP; Q3 locked) |
| **GRILL-EXPLORATION** | Playing the Game → Exploration hazards + Glossary | Pending — **separate from toolbox** |

---

## GRILL-POISON — locked (inherits GRILL-TRAP Q1–Q2, Q4–Q9)

Same architecture as traps unless noted. **Q3 topic-specific:**

| Field | Required | Notes |
|---|---|---|
| `poisonType` | Yes | `contact` \| `ingested` \| `inhaled` \| `injury` |
| `save` | When PDF lists it | `{ dc, ability, onSuccess }` |
| `damage` | When PDF lists it | `damage[]` |
| `conditions` | When PDF lists it | e.g. poisoned |
| `repeat` | When PDF lists interval | Prose interval, e.g. "every 24 hours" |

**Q8 rules slug:** `srd-2024_poisons-rules` under Gameplay Toolbox chapter.  
**Q9 entry slugs:** `srd-2024_<kebab-name>` (e.g. `srd-2024_assassins-blood`).  
**v1 slice:** Codex + Smithy only (no Live Play resolution). Hand-seed PDF sample poisons after traps v1 verify.

---

## GRILL-CURSE — locked (inherits GRILL-TRAP Q1–Q2, Q4–Q9)

**Q3 topic-specific (`CurseDefinition`):**

| Field | Required | Notes |
|---|---|---|
| `contagion` | When PDF lists spread rules | Prose or structured label |
| `save` | When PDF lists it | `{ dc, ability, onSuccess }` |
| `effects` | Yes* | String[] effect lines — or prose in `description` for edge cases |
| `recovery` | When PDF lists removal | Prose (e.g. remove curse spell, quest) |

**Q8 rules slug:** `srd-2024_curses-rules`.  
**Q9 entry slugs:** `srd-2024_<kebab-name>`.  
**Terminology lock:** PDF section is **Curses and Magical Contagions** — not "disease" nav label.

---

## GRILL-ENV-EFFECT — locked (inherits GRILL-TRAP Q1–Q2, Q4–Q9)

**Not** Playing the Game → Exploration hazards (see GRILL-EXPLORATION).

**Q3 topic-specific (`EnvironmentalEffectDefinition`):**

| Field | Required | Notes |
|---|---|---|
| `area` | When PDF lists extent | Prose, e.g. "30-foot radius" |
| `duration` | When PDF lists it | Prose |
| `save` | When PDF lists it | `{ dc, ability, onSuccess }` |
| `damage` | When PDF lists it | `damage[]` |
| `conditions` | When PDF lists it | e.g. blinded |
| `repeat` | When PDF lists interval | Prose |

**Q8 rules slug:** `srd-2024_environmental-effects-rules`.  
**Q9 entry slugs:** `srd-2024_<kebab-name>`.

---

## GRILL-FEAR — locked (inherits GRILL-TRAP Q1–Q2, Q4–Q9)

PDF section: **Fear and Mental Stress**.

**Q3 topic-specific (`FearStressDefinition`):**

| Field | Required | Notes |
|---|---|---|
| `save` | When PDF lists it | `{ dc, ability, onSuccess }` — often Wisdom |
| `effects` | Yes* | String[] (frightened, incapacitated, …) |
| `duration` | When PDF lists it | Prose |

**Q8 rules slug:** `srd-2024_fear-stress-rules`.  
**Q9 entry slugs:** `srd-2024_<kebab-name>`.

---

## Sibling grills — COMPLETE ✅

All four inherit GRILL-TRAP storage (Q4 `codex_toolbox_entries` / `homebrew_toolbox_entries`), IA (Q2 two-tier), ingest gate (Q6 hand-seed + mandatory definition), and v1 scope (Q7 Codex + Smithy). Implementation sequenced **after traps v1 prod verify** — one topic seed + forge form extension per slice.

---

## Current engine shapes

File: `packages/engine/src/content/toolbox-definitions.ts` (canonical).  
`hazard-definitions.ts` — deprecated re-exports only.

- `TrapDefinition` — ✅ Q3 shipped in DATA-1b v1
- `PoisonDefinition`, `CurseDefinition`, `EnvironmentalEffectDefinition`, `FearStressDefinition` — validation stubs; sibling grill Q3 locked above

## Related deferrals

- **DATA-1c** — monsters
- **DATA-1d** — consumables without weapon shape
- **SRD-AUDIT-10** — full PDF alignment audit (post-grill)
