# Gameplay Toolbox + exploration hazards — grill backlog (DATA-1b)

**Status:** **Traps v1 shipped** (DATA-1b). **All five Gameplay Toolbox sibling topics seeded** (Codex + Smithy). Smithy forge forms are best-effort Q3 editors — complex PDF mechanics may use prose in effects/duration/repeat fields; full structured edit fidelity deferred.

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

## Post–GRILL-TRAP deliverable: SRD-AUDIT-10 ✅

**Complete (Jun 2026).** Full audit recorded in `docs/srd-version-audit.md` § SRD-AUDIT-10.

After GRILL-TRAP (and sibling grill sessions), the project audit against SRD 5.2 PDF confirmed:

- Codex nav **Gameplay Toolbox** (replaces **Advanced**)
- Hand-seeded `codex_toolbox_entries` with `srd-2024_*` slugs (44 sample rows across 5 topics)
- Legacy `codex_advanced_rules` retired from nightly ingest and Codex tRPC
- Exploration hazards remain **out of scope** for toolbox → **GRILL-EXPLORATION**

**Follow-ups:** SRD-AUDIT-10-R1 (prod spell doc_key), INFRA-6 full PDF ingest, GA migration to drop orphan `codex_advanced_rules`.

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

## GRILL-LIVE-TOOLBOX — locked (2026-06-27)

Deferred from GRILL-TRAP Q7. **Traps-only v1** for Live Play resolution.

| Q | Decision |
|---|---|
| **Q1 Scope** | **Traps only** — detect / disable / trigger; other toolbox topics later |
| **Q2 Attachment** | **Scene-placed** — trap instances on map tiles (`SceneState.traps`) |
| **Q2b Map scope** | **Indoor / encounter scenes only** — traps may be placed on **encounter**, **dungeon**, **building**, **shop**, and **tavern** scene maps. **Never** on **settlement** or **region** (overland) maps. Engine gates via optional `SceneState.sceneKind`. |
| **Q3 Commands** | **`detect_trap`**, **`disable_trap`**, **`trigger_trap`** — engine owns DC/save/damage |
| **Q4 Trigger timing** | **Auto on enter** — `move_entity` onto trapped tile fires `trigger_trap` if not disabled/spent |

### Implementation status

| Layer | Status |
|---|---|
| Engine registry | ✅ `srd-trap-seeds.ts` + `TRAP_REGISTRY` (8 PDF samples) |
| Engine commands | ✅ handlers + projection + `engine.traps.test.ts` |
| WS / Live Play UI | ✅ #293 — detect/disable affordances + `sceneKind` gate |
| Scene trap placement (GM prep) | ⏳ deferred — CAMP / map editor |
| Poisons+ siblings | ✅ **GRILL-LIVE-POISON** (#296–#297), **GRILL-LIVE-CURSE** (#298–#299); **GRILL-LIVE-ENV-EFFECT** next |

---

## GRILL-LIVE-POISON — COMPLETE ✅

Traps v1 locks **scene-placed** resolution. Poisons attach via **entity state + item metadata** — not map tiles. **Contact + inhaled** delivery deferred to **GRILL-EXPLORATION** (Q1).

### Q1 — v1 delivery scope ✅ (2026-06-28)

**Option A — Injury + ingested only.**

| In v1 Live Play | Deferred |
|---|---|
| **Injury** — poison on weapon hit (coat → deliver via attack/damage) | **Contact** — smeared objects (→ **GRILL-EXPLORATION**) |
| **Ingested** — swallow dose via Use Item / item use command | **Inhaled** — powder/gas clouds (→ **GRILL-EXPLORATION**) |

### Q2 — Attachment model ✅ (2026-06-28)

**Option A — Entity instances + weapon coat flag.**

| State | Purpose |
|---|---|
| `EntityState.activePoisons[]` | Ongoing poison instances (slug, instance id, repeat counter, applied turn) — injury **and** ingested after delivery |
| `coatedPoisonSlug` (optional on entity / weapon slot) | Pending **injury** delivery — cleared when next qualifying hit lands |

Do **not** overload generic `conditions[]` for repeat-save poisons.

### Q3 — Engine commands ✅ (2026-06-28)

**Option A — Minimal trio** (mirrors trap command pattern).

| Command | Purpose | Invoked by |
|---|---|---|
| `coat_weapon` | Set `coatedPoisonSlug` on attacker (pending injury delivery) | Player / WS |
| `apply_poison` | Resolve save, damage, conditions; push to `activePoisons[]` if `repeat` | Engine on injury hit; ingested via Use Item; GM tool later |
| `resolve_poison_tick` | Repeat save + damage per `PoisonDefinition.repeat`; remove when done | Engine at turn boundary (see Q4) |

### Q4 — Trigger timing & action economy ✅ (2026-06-28)

**All Option A.**

| Topic | Decision |
|---|---|
| **Injury delivery** | Auto `apply_poison` inside attack resolution on next qualifying pierce/slash hit; clear `coatedPoisonSlug` after one delivery |
| **Ingested delivery** | Auto `apply_poison` when Use Item resolves an item tagged with `poisonSlug` |
| **Repeat saves** | Auto `resolve_poison_tick` at **start of poisoned entity's turn** |
| **Coat weapon** | Costs **Action** in combat; free out of combat |

### Q5 — Live Play UI ✅ (2026-06-28)

**All Option A.**

| Surface | Decision |
|---|---|
| **Coat weapon** | **Coat** chip on action rail when PC has injury poison in inventory + weapon equipped; picker of available injury poisons |
| **Ingested** | Existing **Use Item** rail + chat only — items carry `poisonSlug` metadata |
| **Active poison feedback** | Party rail / HUD chip (e.g. "Poisoned — Assassin's Blood") |
| **Repeat saves** | Silent engine tick at turn start; events in narrative log |

### Q6 — Registry & item bridge ✅ (2026-06-28)

**Option A — Engine seeds + item field** (mirrors trap registry pattern).

| Layer | Decision |
|---|---|
| **Poison registry** | `srd-poison-seeds.ts` in `@app/engine`; DB ingest imports same module |
| **Item link** | Optional `toolboxPoisonSlug?: string` on `ItemDefinition` |
| **Demo** | Full verify matrix — see Q8 |

### Q7 — v1 delivery phasing ✅ (2026-06-28)

**Option A — Two PRs** (mirror traps #292 → #293).

| Slice | Scope | Verify |
|---|---|---|
| **PR 1 — Engine** | Registry, state fields, `coat_weapon` / `apply_poison` / `resolve_poison_tick`, projection, tests | CI green |
| **PR 2 — WS + Live Play** | Coat chip, Use Item hook, HUD chip, injury auto-on-hit | Prod verify |

### Q8 — Demo fixtures ✅ (2026-06-28)

**Option C — Full verify matrix.**

| Fixture | Poison slug | Delivery | Purpose |
|---|---|---|---|
| Coated weapon on dungeon bootstrap | `srd-2024_serpent-venom` | Injury | Pre-coated foe weapon or PC coat + hit path |
| Inventory vial 1 | `srd-2024_assassins-blood` | Ingested | Con save, 1d12 poison, poisoned 24h |
| Inventory vial 2 | `srd-2024_pale-tincture` | Ingested | High DC, 3d6 + repeat max-HP reduction (repeat-save edge) |

**Prod verify checklist:** coat → hit delivers Serpent Venom; Use Item ×2 (Assassin's Blood, Pale Tincture); HUD chip; turn-start `resolve_poison_tick` on repeat poisons.

### Implementation checklist (v1 — two PRs)

| PR | Scope |
|---|---|
| **Engine (#296)** | `srd-poison-seeds.ts`, `POISON_REGISTRY`, `EntityState.activePoisons[]`, `coatedPoisonSlug`, `toolboxPoisonSlug` on `ItemDefinition`, handlers + projection + tests (incl. Pale Tincture repeat) | ✅ merged |
| **WS + Live Play (#297)** | `coat_weapon` battle action, Coat chip on action rail, Use Item → `apply_poison`, injury hook in attack resolution, HUD chip, demo fixtures (Q8) | ✅ merged |

**Deferred:** contact / inhaled delivery → **GRILL-EXPLORATION**; partial doses (SRD DM discretion); max-HP reduction UI on sheet (engine events only in v1 if needed).

---

## GRILL-LIVE-CURSE — COMPLETE ✅

Curses attach via **entity state + item metadata** — not map tiles. **Proper grill session** confirmed Q1–Q8 after #298–#299 shipped on assumed defaults. Bestow Curse / Remove Curse use the **spell pipeline**; Live Play v1 is passive exposure + HUD feedback only (Q5 A′).

### Q1 — v1 delivery scope ✅ (grill confirmed)

**Option A — Direct infection only.**

| In v1 Live Play | Deferred |
|---|---|
| **`apply_curse`** — initial save + structured conditions (Use Item / GM hook) | **Contagion spread** — radius/carrier rules (→ **GRILL-EXPLORATION**) |
| **`remove_curse`** — engine command; Remove Curse / Lesser Restoration spell bridge deferred | **Environmental auto-apply** on scene enter |
| Turn-start **`resolve_curse_tick`** for **Demonic Possession** only | **Demonic possession nat-1** hijack (narrative-only in v1) |
| | Long-rest / daily recovery (Cackle Fever, Sewer Plague) |

### Q2 — Attachment model ✅ (grill confirmed)

**Option A + A2 — Entity instances; one active instance per slug per entity.**

| State | Purpose |
|---|---|
| `EntityState.activeCurses[]` | Ongoing curse instances (slug, instance id, recovery counter) — **dedupe: reject or refresh if slug already active** |
| Optional `conditions[]` on `CurseDefinition` | Structured engine effects (e.g. Sight Rot → blinded); cleared on `remove_curse` |

Do **not** overload generic entity `conditions[]` for recovery-tracked curses without an `activeCurses[]` instance.

**Follow-up ✅:** one-instance-per-slug enforced in `apply_curse` handler (`CURSE_ALREADY_ACTIVE`).

### Q3 — Engine commands ✅ (grill confirmed)

**Option A — Minimal trio** (mirrors poison / trap command pattern).

| Command | Purpose | Invoked by |
|---|---|---|
| `apply_curse` | Initial save, conditions, push to `activeCurses[]` when ongoing (dedupe per Q2) | Use Item; GM tool later |
| `resolve_curse_tick` | Recovery save per turn-start rules | Engine at turn boundary |
| `remove_curse` | End curse instance + clear linked definition conditions | Remove Curse / Lesser Restoration spell bridge later; GM tool |

### Q4 — Trigger timing ✅ (grill confirmed)

**All Option A.**

| Topic | Decision |
|---|---|
| **Direct apply** | Auto `apply_curse` when Use Item resolves an item tagged with `toolboxCurseSlug` |
| **Turn recovery (Demonic Possession)** | Auto `resolve_curse_tick` at **start** of cursed entity's turn when `pendingRecovery` (poison-consistent; not SRD end-of-turn) |
| **Long-rest / daily recovery** | Deferred (Cackle Fever, Sewer Plague → GRILL-EXPLORATION or v1.1) |
| **`remove_curse` Live Play** | Engine command only in v1; spell / scroll bridge deferred |

### Q5 — Live Play UI ✅ (grill confirmed)

**Option A′ — Passive exposure + feedback only (no curse action rail).**

SRD curses are exposure → save → ongoing state, not a third action economy. Bestow Curse / Remove Curse live in the **spell pipeline**; Live Play v1 has no dedicated curse buttons.

| Surface | Decision |
|---|---|
| **How curses arrive** | Engine `apply_curse` on exposure: environment, creature/NPC, GM hook; contagion deferred (Q1) |
| **Consumables** | **Use Item** for normal potion use only (demo vials = tainted water narrative) — not a curse-specific affordance |
| **Spells** | Bestow Curse → `apply_curse`; Remove Curse → `remove_curse` — spell cast handlers own UI (bridges deferred) |
| **Active curse feedback** | Party rail violet HUD chip (passive state) |
| **Recovery saves** | Silent turn-start `resolve_curse_tick`; narrative log only |

**Out of v1 UI:** Inflict / Break curse chips, curse picker on action rail, manual save-vs-curse button.

### Q6 — Registry & item bridge ✅ (grill confirmed)

**Option A — Engine seeds + item field** (mirrors poison / trap registry pattern).

| Layer | Decision |
|---|---|
| **Curse registry** | `srd-curse-seeds.ts` in `@app/engine`; DB ingest imports same module |
| **Item link** | Optional `toolboxCurseSlug?: string` on `ItemDefinition` |
| **Demo fallback** | Name map in `live-curses.ts` when Smithy metadata absent (prod verify only) |

### Q7 — v1 delivery phasing ✅ (grill confirmed)

**Option A — Two PRs** (mirror traps / poison).

| Slice | Scope | Status |
|---|---|---|
| **PR 1 — Engine** | Registry, `activeCurses[]`, commands, projection, tests | ✅ **#298** |
| **PR 2 — WS + Live Play** | Use Item exposure path, HUD chip, demo loot | ✅ **#299** |
| **Post-grill follow-ups** | Slug dedupe, spell bridges, prod verify | ✅ **#300** (dedupe + spell bridges); prod verify after deploy |

### Q8 — Demo fixtures ✅ (grill confirmed)

**Option A — Simple pair** (matches #299 dungeon demo loot).

| Fixture | Curse slug | Purpose |
|---|---|---|
| Inventory vial | `srd-2024_sight-rot` | Use Item (tainted water) → Con save → blinded + violet HUD |
| Inventory scroll | `srd-2024_demonic-possession` | Use Item → Cha save → turn-start `resolve_curse_tick` |

**Prod verify checklist:** Use Item Sight Rot → HUD chip + blinded; Use Item Demonic Possession → turn-start recovery tick in combat. Remove Curse / Lesser Restoration via spell bridge deferred.

### Decision record (GRILL-LIVE-CURSE)

| # | Decision |
|---|---|
| **Q1** | Direct infection only — `apply_curse` + `remove_curse` command; defer contagion spread, environmental auto-apply, nat-1 hijack, long-rest/daily recovery |
| **Q2** | `activeCurses[]` + definition `conditions[]`; **one instance per slug per entity** (dedupe on apply) |
| **Q3** | `apply_curse` / `resolve_curse_tick` / `remove_curse` |
| **Q4** | Use Item auto-apply; turn-**start** recovery tick; defer long-rest/daily and remove UI |
| **Q5** | **A′** — passive exposure + violet HUD only; no curse action rail; spells own Bestow/Remove |
| **Q6** | Engine `srd-curse-seeds.ts` + `toolboxCurseSlug`; demo name-map fallback |
| **Q7** | Two PRs (#298 → #299); post-grill gaps as targeted follow-ups |
| **Q8** | Sight Rot vial + Demonic Possession scroll demo pair |

### Implementation checklist (v1 — two PRs)

| PR | Scope |
|---|---|
| **Engine (#298)** | `srd-curse-seeds.ts`, `CURSE_REGISTRY`, `EntityState.activeCurses[]`, `toolboxCurseSlug`, handlers + projection + tests | ✅ merged |
| **WS + Live Play (#299)** | `apply_curse` battle action, Use Item hook, HUD chip, demo fixtures (Q8) | ✅ merged |

**Deferred:** contagion spread → **GRILL-EXPLORATION**; long-rest recovery ticks (Cackle Fever, Sewer Plague); nat-1 possession hijack; Bestow/Remove Curse spell → command bridges.

**Post-grill follow-ups ✅:** slug dedupe in `apply_curse`; spell cast → `remove_curse` / `apply_curse` (Bestow/Remove Curse); prod verify on dungeon campaign after merge.

---

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
- `PoisonDefinition`, `CurseDefinition`, `EnvironmentalEffectDefinition`, `FearStressDefinition` — ✅ validation + seeds shipped per sibling slice; Smithy forge forms best-effort (see deferrals DATA-1b)

## Related deferrals

- **DATA-1c** — monsters
- **DATA-1d** — consumables without weapon shape
- **SRD-AUDIT-10** — ✅ audit complete (Jun 2026); see `docs/srd-version-audit.md`
