# Deferrals — Single Source of Truth

This is the **one canonical local home for every deferred item** in Loreforge: things
intentionally cut, postponed, stubbed-at-tracer-depth, or scoped out of the current
milestone. If something is "we'll do it later," it belongs here.

**Status (2026-06-21):** local-canonical. This file is the source of truth. GitHub
issues are mirrored **opportunistically** (not required) — see "Tracking" below. Issues
#1–#50 are closed (prior milestones). The **M5-frontier slices are mirrored to GitHub
issues #54–#68** (rows with a `#NN` in Tracking); the rest are `doc-only`. PRs #52
(docs), #53 (generator pipeline), and #69 (#54 rich Settlement schema) are merged.
**#54 done** (rich Settlement schema + tabbed detail); **#56 done** (character schema
extension — XP/equipment/spells/portrait/notes + character↔campaign membership);
**#64 done** (rich Tavern generator on the #54 pattern, cascade-enabled);
**#65 done** (rich Shop generator on the #54 pattern, cascade-enabled);
**#66 done** (rich Building generator on the #54 pattern, cascade-enabled);
**#67 done** (rich Faction generator on the #54 pattern, cascade-enabled);
**#68 done** (rich Dungeon generator on the #54 pattern, cascade-enabled) —
all 7 descriptive Realms types are now rich/sectioned except Region (GENR-6);
**#55 done** (campaign workspace shell + Overview tab at `/campaigns/[id]`);
**#61 done** (campaign workspace Party tab on the membership link);
**#60 done** (campaign workspace World tab + per-campaign discovery, migration `0009`);
**#59 done** (campaign workspace Plot Hook Kanban + accept-from-Realms lifecycle, migration `0010`);
**#62 done** (campaign creation flows — Quick Forge / Guided Setup / Empty World);
**#57 done** (Live Play narrative chat + player input modes, server-authoritative chat on the shared Yjs doc);
**#63 done** (Live Play character HUD right rail with engine-routed quick-attack);
**#58 done** (Live Play full combat loop: map target picker + range rings, combat overlay, engine-resolved attack/cast, timed opportunity-attack reaction prompt);
**CHAR-7/CHAR-9 done** (tabbed character sheet with Equipment + Spells + Notes tabs; XP-gated level-up with engine XP-threshold helpers);
**#98 done** (Live Play ↔ character-sheet bridge: persisted campaign roster seeds the live encounter via `buildPartyBattleCommands`; HUD + combat action bar driven by real weapons / spells / consumables from the sheet via `campaigns.partyLoadout` + `lib/sheet-loadout.ts`);
**#96 done** (Live Play chat: real AI-GM narration via `@app/llm` env-gated in the WS server with the stub as fallback; chat persisted to a dedicated `chat_messages` table and re-hydrated on room load; GM-referenced on-scene entities render as `@Entity` chips);
**#97 done** (Live Play input: AI "thinking" indicator broadcast around AI-GM turns; Check mode routed through the engine via a new deterministic `ability_check` command + `decideCheck` orchestrator; `LiveRoom.apply` surfaces command summaries);
**#99 done** (Live Play combat: AoE aim picker — area spells place an `origin` cell with a live caught-target preview via the engine's `withinBurst`/`withinCone`, resolved authoritatively; engine-event chat rows enriched with resolution detail (roll-vs-AC, damage, save failures/DC) from the command summary);
**#111 done** (Live Play combat: autonomous enemy/NPC turns — a `runEnemyTurns` WS-server driver runs every non-player turn through a deterministic `planMonsterTurn` planner (engine-validated move-to-reach + basic melee), with an optional #97-style LLM target pick (`decideMonsterTarget`) + per-turn GM narration (`narrateEnemyTurn`); combat is now two-sided even without an API key);
**#104 partial** (Live Play reactions — (1) AI-reactor opportunity attacks: a `runEnemyReactions` WS-server driver auto-takes the engine `opportunity_attack` for every AI-controlled reactor when a PC flees its reach; (2) Ready actions: a "Ready ▾" action-bar control arms a pick-any-foe target picker that holds a strike via the engine `ready_action` (trigger encodes the weapon range as `in_range:<ft>`), and a `runReadiedTriggers` WS-server driver fires it via `trigger_readied` the instant that foe advances into range on its turn (can interrupt the foe's own attack) — both with enriched resolution rows (`Readied — …`) + narration; pacing controls remain — issue stays open).

## How to use this file

- **Adding a deferral:** append a row to the relevant table with a stable `ID`. Don't
  delete rows when an item ships — change its **Status** to `Done` (so history is kept).
- **Tracking column:** `doc-only` = tracked here only. An issue number (e.g. `#57`)
  means it's also mirrored to GitHub. Use the `to-issues` skill to mirror a batch.
- **Phase tags** point at `docs/02-implementation-roadmap.md` §6 (P0–P7) and the
  milestones M1–M10. They are **best-effort** placement, not commitments.
- **Don't restate locked cuts** — v1.5+/v2 product cuts live in
  `docs/product-spec.md` §6 and `docs/00-consolidated-plan.md`; §6 below links to them
  rather than copying.
- This file supersedes scattered "What Is Open" / deferral prose. `AGENTS.md` and
  `CONTEXT.md` should point here for the live backlog.

**Legend — Status:** `Deferred` (planned, not started) · `Partial` (started, materially
incomplete) · `Stub` (placeholder/tracer-depth only) · `Done` (shipped; kept for history).

---

## 1. Generator pipeline (Realms AI) — plan `realms_generator_pipeline_50e6bfcd` (D1–D11)

The shared generator pipeline shipped at **tracer depth** (commits `90d7a9b`,
`230d97d` on `feat/realms-generator-pipeline`). `@app/llm` package, `generation_events`
audit table (migration `0007`), `realms.generate` / `expandStub` / `regenerate`
(field-subset capable) / `generateCascadeAsync` / `cascadeRun`, and the Advanced Form at
`/realms/generate/[type]` are all built. The items below are the parts deliberately
deferred from that design.

| ID | Item | Source | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|---|
| GEN-1 | Rich per-type schemas (replace thin `REALM_FIELDS` with rich per-tab schemas) | D1 | P4 / M5 | #54 | Partial | **Settlement done (#54)**: descriptor model extended with `section` + `list`/`group` kinds; one source of truth drives form/tabbed-detail/zod/generator. Remaining six descriptive types still thin — author rich descriptors per type (GENR-*). |
| GEN-2 | Name-match dedup on cascade child-stub insertion | D6 | P4 / M5 | doc-only | Deferred | Cascade currently inserts every `children[]` entry as a new stub; no dedup against existing entities. |
| GEN-3 | OpenAI fallback provider (resilience) | D9 | post-M5 | doc-only | Deferred | Anthropic-only for v1; provider seam exists in `@app/llm` for later wiring. |
| GEN-4 | Full pgvector RAG grounding for generation | D11 | P5 | doc-only | Deferred | Today: schema-driven enums + curated SRD species/class lists + parent context. Full RAG lands with the memory tier (P5). |
| GEN-5 | Auto-link / conflict detection on generated entities | D6 / roadmap P4 | P4 / M5 | doc-only | Deferred | No conflict modal or auto-relationship inference beyond deterministic cascade edges. |

---

## 2. Unbuilt generators

Roadmap P4 prescribes 7 rich generators. NPC + Region + Settlement exist at **tracer
depth on thin schemas**. The generic Advanced Form can emit any type onto thin schemas,
but there are **no dedicated rich generators** for the five below. Build order per
roadmap §6 P4 (Tavern → Shop → Building → Faction → Settlement → Region → Dungeon).

| ID | Item | Source | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|---|
| GENR-1 | Tavern generator (menu + floor plan patterns) | roadmap P4 #2 | P4 / M5 | #64 | Done | **#64**: rich sectioned Tavern schema (Overview/Atmosphere/Menu group/Patrons & Amenities/Lore & Rumors) on the #54 pattern; tavern is now a cascade parent (emits tavernkeeper + patron NPC stubs + edges); generate/expand/regenerate + tabbed detail + per-section regenerate all work. Interactive floor-plan map deferred (REALM-5 / maps track). |
| GENR-2 | Shop generator (inventory ↔ engine transactions) | roadmap P4 #3 | P4 / M5 | #65 | Partial | **#65**: rich sectioned Shop schema (Overview/Inventory group/Quirks/Loot & Security/Lore & Rumors) on the #54 pattern; shop is now a cascade parent (emits shopkeeper + supplier/apprentice NPC stubs + edges); generate/expand/regenerate + tabbed detail + per-section regenerate all work. Inventory items model the buy/sell seam but **engine transactions (currency/inventory mutation), CUSTOM→Smithy promotion, and price auto-scaling are deferred** to play integration; interactive floor-plan map deferred (REALM-5 / maps track). |
| GENR-3 | Building generator (floor plans, custom sections) | roadmap P4 #4 | P4 / M5 | #66 | Partial | **#66**: rich sectioned Building schema (Overview/Architecture/History/Lore & Secrets) on the #54 pattern; building is now a cascade parent (emits owner + occupant NPC stubs + edges); generate/expand/regenerate + tabbed detail + per-section regenerate all work. Interactive floor-plan map deferred (REALM-5 / maps track). |
| GENR-4 | Faction generator (crest, relational graph) | roadmap P4 #5 | P4 / M5 | #67 | Partial | **#67**: rich sectioned Faction schema (Overview/Goals & Methods/Organization/Relationships/Lore & Secrets) on the #54 pattern; faction is now a cascade parent (emits leader + key-member NPC stubs via `member_of` edges); ally/rival lists complement the existing Realms relationship graph; generate/expand/regenerate + tabbed detail + per-section regenerate all work. Bespoke crest/emblem art deferred (art track). |
| GENR-5 | Dungeon generator (rooms as entities, Dyson map, encounter promotion) | roadmap P4 #8 | P4 / M5 | #68 | Partial | **#68**: rich sectioned Dungeon schema (Overview/Atmosphere & Lore/Rooms group/Hazards & Monsters/Secrets & Hooks) on the #54 pattern; dungeon is now a cascade parent (emits boss + denizen NPC stubs + edges); generate/expand/regenerate + tabbed detail + per-section regenerate all work. Rooms are modeled as a structured group (each with an encounter field that seams to combat) rather than separate sub-entities — **rooms-as-entities, the Dyson-style map render, and live encounter promotion (room → runnable combat) are deferred** to play/maps integration (the locked 8-type taxonomy has no room type). |
| GENR-6 | Rich Region generator (deepest cascade, rich tabs) | roadmap P4 #7 | P4 / M5 | #116 | Partial | Tracer-depth Region cascade exists on thin schema; rich version pending GEN-1. Last of the 7 descriptive types still thin (spine slice A2). |
| GENR-7 | Rich Settlement generator (richest tab set) | roadmap P4 #6 | P4 / M5 | doc-only | Partial | Settlement now has a rich sectioned schema (#54) — generate/expand/regenerate run against it. Full ~19-tab vision + per-district map still pending. |

---

## 3. UI-flow gaps (per-surface audit, 2026-06-21)

Each built surface was audited against its `docs/ui-flows/*.md`. Most surfaces are honest
**vertical slices** aligned with P1/P2/P3 scaffolding, not the production-complete flows
the docs describe. Gaps are grouped per surface; rows are deferral-worthy clusters, not
every micro-item (read the flow doc for full detail).

> **P4 backlog is now mirrored to GitHub issues #85–#105** (2026-06-21). The per-row
> `Tracking` cells below still say `doc-only`, but the live queue is on GitHub. Mapping:
> CHAR-3 → #85 · CHAR-7 (Combat/Features/Personality) → #86 · SMITH-5 → #87 ·
> REALM-2 → #88 · REALM-3 → #89 · REALM-5 → #90 · REALM-6 → #91 · REALM-7 → #92 ·
> CAMP-12 → #93 · CAMP-14 → #94 · CAMP-15 (Add-to-Campaign) → #95 ·
> PLAY-1 → #96 · PLAY-2 → #97 · PLAY-3/PLAY-6 sheet bridge → #98 ·
> PLAY-6 (AoE/resolution) → #99 · PLAY-4 → #100 · PLAY-5 → #101 · PLAY-7 → #102 ·
> PLAY-8 → #103 · PLAY-9 (Ready/AI reactions) → #104 · PLAY-13 → #105 ·
> PLAY-15 (enemy AI turns) → #111.
> (CHAR-9 is Done; not ticketed.)
>
> **M5-completion batch mirrored to GitHub (Jun 2026, see `docs/03-m5-completion-plan.md`):**
> CAMP-8 → #115 · GENR-6 → #116 · CAMP-10 → #117 · CAMP-9 → #118 · CAMP-6 → #119 ·
> CAMP-7 → #120.

### 3.1 Home — `docs/ui-flows/home.md`

Built page is a P1 dev dashboard (surface cards + system status), not the cinematic
marketing/landing experience.

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| HOME-1 | Cinematic hero (imagery, AI-GM pitch, primary CTAs, scroll indicator) | P6 (pre-beta polish) | doc-only | Missing | Page is dev surface launcher. |
| HOME-2 | Marketing feature grid (Build Characters / Generate World / Run Campaign / Codex+Smithy) | P6 | doc-only | Partial | Current grid is dev links with "soon" badges. |
| HOME-3 | Logged-in personalization (Continue Your Adventure, recent character/campaign, Quick Level Up, Resume Session) | P4–P6 | doc-only | Missing | "Welcome back" is static. |
| HOME-4 | CTA banner, footer (app links + SRD attribution), Featured Builds carousel, SRD Fidelity badge | P6 | doc-only | Missing | — |
| HOME-5 | Global search, notifications bell, profile avatar dropdown, crest logo | P4–P6 | doc-only | Missing | App-shell nav chrome (shared across surfaces). |
| HOME-6 | Mobile hamburger nav fallback (nav links hidden < md with no fallback) | P6 (mobile pass) | doc-only | Missing | Shared app-shell gap. |

### 3.2 Codex — `docs/ui-flows/codex.md`

Spells-only MVP with search/filters/grid/slide-over detail. 9 of 10 categories stubbed;
no Smithy copy loop, deep links, right pane, or global search.

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| CODEX-1 | Non-spell category browsers (Rules, Species, Backgrounds, Classes, Animals, Monsters, Items, Feats, Advanced) | P3+ / ongoing | doc-only | Missing | Category pills are decorative; `listSpecies`/`listClasses` exist but wizard-only. |
| CODEX-2 | "Copy to The Smithy" from spell detail (+ bulk multi-select copy) | P2 (deepen) | doc-only | Missing | No copy mutation; Smithy `CopyFromCodexButton` is a stub. Pairs with SMITH-6. |
| CODEX-3 | Deep links / bookmarkable detail (`/codex/spells/[slug]`, `?search=`, category routes) | P3+ | doc-only | Missing | Detail is client state only. |
| CODEX-4 | Right pane (Recently Viewed, Quick Copy suggestions, Your Characters) + footer (SRD attribution, export) | P3+ | doc-only | Missing | — |
| CODEX-5 | Richer spell filters (ritual, concentration, class-list) + List/Table view toggle + sorting | P3+ | doc-only | Partial | Level + school only today. |
| CODEX-6 | Detail action buttons (Use in Character, Bookmark, Share, View SRD Source) | P3+ | doc-only | Missing | — |
| CODEX-7 | Global cross-app Codex+Smithy search bar | P4–P6 | doc-only | Missing | Shared app-shell gap (see HOME-5). |

### 3.3 Characters — dashboard / creation-wizard / inline-view / level-up

Functional P1/P2 vertical slices (create → view → edit basics → level up). Schema is
minimal (no XP, equipment, spells, portrait, notes, campaign links), which blocks several
features regardless of UI work. Router exposes only `list/get/create/update/levelUp`.

| ID | Item | Source | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|---|
| CHAR-1 | Character schema extension: XP, equipment/inventory, spells/slots, portrait, notes, campaign links | dashboard+view docs | P2 (deepen) / P4 | #56 | Partial | **Schema done (#56)**: migration `0008` adds xp/portrait/notes/equipment(rich)/spells(unified) + `campaign_characters` membership table; router handles new fields + add/remove/list membership; sheet round-trips XP + notes + portrait-URL stub. Full Equipment/Spells/Personality tab UIs are CHAR-7; portrait upload pipeline deferred. Unblocks CHAR-3/7/9, CAMP-3, SMITH-5. |
| CHAR-2 | Dashboard filter+sort bar, Grid/List toggle, card ⋯ menu (Duplicate/Export/Share/Archive/Delete), search | characters-dashboard.md | P2 (deepen) | doc-only | Missing | List is create + view only. |
| CHAR-3 | Dashboard XP bars, Last Played, campaign grouping + Play Now, right sidebar, bulk select | characters-dashboard.md | P4 | doc-only | Missing | Depends on CHAR-1 + campaigns. |
| CHAR-4 | Creation wizard steps 1,4,7,8,9 (Concept, Background, Equipment, Features/Spells, Flavor) — 5 of 10 built | character-creation-wizard.md | P2 (deepen) | doc-only | Partial | Built: Species, Class, Abilities, Skills, Review. |
| CHAR-5 | Wizard polish: full layout (right preview pane, footer), drafts/auto-save, undo stack, randomizers, 4d6 roll, success toast | character-creation-wizard.md | P2 (deepen) | doc-only | Missing | — |
| CHAR-6 | Inline sheet: tabbed layout (8 tabs), right Live Stats HUD, left summary card, floating Save/Cancel toolbar, auto-save | character-view-inline-editing.md | P2 (deepen) | doc-only | Partial | **Tabbed layout shipped** (Overview / Equipment / Spells / Notes) over the inline sheet. Still deferred: full 8-tab set (Combat/Features/Personality), right Live Stats HUD on the view, left summary card, floating Save/Cancel toolbar, auto-save. |
| CHAR-7 | Inline sheet tabs requiring schema: Combat (attacks/death saves), Equipment, Features, Spells, Personality, Notes | character-view-inline-editing.md | P4 | doc-only | Partial | **Done**: Equipment tab (rich item editor — qty/equipped/slot/rarity/weight/attunement/description + carried weight; local draft → `characters.update`), Spells tab (known/prepared list grouped by level + per-level slot pools), and a Notes tab. **Deferred**: Combat tab (attacks/death saves), Features tab, Personality tab, and Smithy "Equip from library" (SMITH-5). |
| CHAR-8 | Level-up: 5-step wizard parity, Spells & Magic step, Review/confirm + celebration, feature/ASI/subclass application, version history | level-up-wizard.md | P2 (deepen) | doc-only | Partial | Today: single-screen HP + class-level increment; features listed as stubs, not applied. |
| CHAR-9 | XP-gated level-up (threshold check + post-level reset) | level-up-wizard.md | P4 | doc-only | Done | **Done**: engine `XP_THRESHOLDS` / `xpForLevel` / `levelForXp` / `xpProgress` (5E DMG table, 1–20); the sheet shows an XP progress bar toward the next level and **gates the Level Up button** until the threshold is met ("Level Up (locked)" with a "need X more XP" hint; "Max level" at 20). Standard cumulative thresholds (no XP reset); milestone-mode override is not offered. |

### 3.4 Smithy — `docs/ui-flows/smithy.md`

P1/P2 slice: owner-scoped CRUD for homebrew **items** + declarative **spells** (create,
list, read, delete). Spells integrate with the engine (`validateSpellDefinition`); items
are metadata-only. Diverges sharply from the full "homebrew forge."

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| SMITH-1 | Edit existing homebrew (`update`/`updateSpell` mutations + edit UI/modal) | P2 (deepen) | doc-only | Missing | Detail pages are read-only + Delete; create-only forms. |
| SMITH-2 | Full Codex-mirror category sidebar (Species, Backgrounds, Classes, Animals, Monsters, Feats, Advanced) + unified "All My Homebrew" landing | P2 (deepen) | doc-only | Missing | Today: Items (6 subtypes) + Spells only. |
| SMITH-3 | Browse-card actions (Edit, Duplicate, Delete-on-card, Use in Character) + timestamps + description snippets | P2 (deepen) | doc-only | Missing | Cards link to detail only. |
| SMITH-4 | Text search + filters (Last Edited, Source Copied/Original) + Grid/List/Table toggle | P2 (deepen) | doc-only | Missing | — |
| SMITH-5 | Character integration ("Use in Character" / Equip / Learn / Apply) | P4 | doc-only | Missing | Depends on CHAR-1 schema. |
| SMITH-6 | Copy-from-Codex flow (real picker, `source`/`copiedFromSlug` populate, toast, Reset-to-SRD) | P2 (deepen) | doc-only | Missing | DB provenance fields ready but unused; pairs with CODEX-2. |
| SMITH-7 | Item engine mechanics (`EffectTemplate`, damage/stats, sandbox handlers) beyond metadata | P3/P6 | doc-only | Missing | QuickJS sandbox is roadmap E5/P6. |
| SMITH-8 | Right pane (Recently Forged, Quick Copy, Your Characters), folders/tags, color-coded rarity | P3+ | doc-only | Missing | — |
| SMITH-9 | Export/Import homebrew JSON, auto-save drafts, version history, undo | P3+ | doc-only | Missing | — |
| SMITH-10 | Forge theming/hero (imagery, animations, "Forged" badge, empty-state illustration) + monster/animal stat-block builders | P6 | doc-only | Missing | — |

### 3.5 Realms — `docs/ui-flows/realms-library.md`

Audited in the previous chat. Grid/List/Graph toggle, type sidebar, stub badges, full-page
detail, Expand-with-Generator, generate→navigate, Advanced Form at the spec path +
"Surprise Me", per-section regenerate are **Followed**. Gaps below.

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| REALM-1 | Rich tabbed detail pages (currently flat field list / stat block) | P4 / M5 | #54 | Partial | Tabbed-detail shell built (#54): Settlement renders sectioned tabs with per-tab + per-field regenerate. Single-section types stay flat; remaining types get tabs as their rich schemas land. |
| REALM-2 | Hero stats strip on detail pages | P4 | doc-only | Missing | — |
| REALM-3 | Detail right pane (Recently Forged / Used in Campaigns / Quick Cascade / Style) | P4 | doc-only | Missing | — |
| REALM-4 | Per-tab Quick Generate bars with type-specific fields (today: one generic panel) | P4 / M5 | #54 | Partial | Advanced Form now skips list/group and seeds scalar preferred-values; per-tab Quick Generate bars still pending. |
| REALM-5 | Live Map Preview right rail | P4 | doc-only | Missing | — |
| REALM-6 | Cinematic multi-stage generation loader | P4 | doc-only | Missing | — |
| REALM-7 | Bulk ops; conflict/auto-link modal; auto-art; global search | P4 | doc-only | Missing | Auto-link = GEN-5; auto-art = ART-1 (v1.5 for AI gen). |
| REALM-8 | JSON import/export; World Anvil import | v1.5 | doc-only | Missing | World Anvil import is v1.5 per `realms-library.md`. |

### 3.6 Campaigns workspace — `docs/ui-flows/campaigns-workspace.md`

**The `/campaigns/[id]` workspace shell now exists** (#55): nine-tab bar with the
Overview tab populated from real data; the other eight tabs are stubbed and land
in their own slices. Opening a campaign (from the browser or after create) goes
to the workspace, not straight to `/play`.

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| CAMP-1 | Workspace shell at `/campaigns/[id]` (header, sidebar, tab bar, right pane, footer) | P4 / M5 | #55 | Partial | **#55**: shell built — header (back link, Live:Off indicator, title, pinned Start Live Session) + nine-tab bar with `?tab=` deep links; non-Overview tabs stubbed. Collapsible left sidebar, contextual right pane, and footer/toast layer deferred to later tab slices. |
| CAMP-2 | Tab 1 Overview (continue/next session, party/world/hooks/NPC/session widgets, activity feed, pinned memory) | P4 / M5 | #55 | Partial | **#55**: Overview shows hero (name + pitch with inline edit via `campaigns.update`), Start Live Session + Continue entry points, a party summary + count from the membership link (`campaigns.party`), world/hooks/sessions stat cards (stubbed), and created/updated metadata. Activity feed, pinned AI-memory highlights, and AI next-step hints deferred (memory tier is P5, CAMP-13). |
| CAMP-3 | Tab 2 Party (campaign-scoped character dashboard, companions, shared resources, bench) | P4 / M5 | #61 | Partial | **#61**: Party tab on the `campaign_characters` link — add owned characters (as PC or companion) via `characters.addToCampaign`, remove via `removeFromCampaign`, roster split into PCs / Companions & Allies / Bench with engine-derived stat cards, and a "Play Now" entry into Live Play. Party-composition analysis, NPC-companion generator, shared currency/inventory pool, and the per-character ⋯ menu (bench/deceased) are deferred. |
| CAMP-4 | Tab 3 World (campaign-scoped Realms IA, discovery states, graph, add-from-Realms) | P4 / M5 | #60 | Partial | **#60**: World tab on a new `campaign_world_entities` table (migration `0009`) — add owned Realms entities into the campaign (`addWorldEntity`), per-campaign discovered/undiscovered toggle (`setWorldEntityDiscovered`, Q11), list + campaign-scoped relationship graph (`worldGraph`, edges filtered via shared `edgesWithin`), and a first-class `revealWorldEntity` auto-reveal seam for the AI narration pipeline. Flat-by-type sidebar IA, grid/list/graph filters, and live auto-reveal wiring deferred. |
| CAMP-5 | Tab 4 Hooks (Plot Hook Kanban: Suggested/Open/Active/Resolved/Abandoned, timeline, detail panel) | P4 / M5 | #59 | Partial | **#59**: Hooks tab on a new `plot_hooks` table (migration `0010`) — five-column Kanban with drag-to-restage (`hooks.setStatus`), author-a-hook form (`hooks.create`), a hook detail panel (title/summary/linked entity/move/delete), and the Q7 accept-from-Realms lifecycle (`hooks.acceptFromRealms` promotes a Realms-embedded `data.hooks` entry into a first-class campaign hook tagged with its source entity). Timeline view and richer hook metadata (difficulty/reward/linked-entity multiselect) deferred. |
| CAMP-6 | Tab 5 Sessions (log, recap cards, per-session Recap/Transcript/Combat/Events/Loot/Media) | P4 / M5 | #119 | Missing | Depends on the P5 memory tier (auto-recaps); sequenced late. |
| CAMP-7 | Tab 6 World Map (strategic pannable canvas, layers, edit mode, party token, discovery mirror) | P4 / M5 | #120 | Missing | Heaviest remaining tab; sequenced late. |
| CAMP-8 | Tab 7 Combat (encounter library + builder, difficulty, battle map, Run Now → Live) | P4 / M5 | #115 | Partial | **Spine slice A1 shipped at tracer depth:** `encounters` table + `campaigns.activeEncounterId` (migration 0012); `campaigns.encounters`/`createEncounter`/`deleteEncounter`/`runEncounter`; `MONSTER_TEMPLATES` catalog + `expandEncounterFoes`; the live room seeds the armed authored encounter (`getCampaignEncounter` → `CampaignRoom`); a Combat tab (catalog foe-roster builder + Run Now → Live). **Still deferred:** difficulty/CR budgeting, battle-map authoring/placement, encounter-from-dungeon (GENR-5), in-place switch while a `/play` tab is connected (use Reset). |
| CAMP-9 | Tab 8 Notes (editor, DM-only/shared, pin-to-memory, convert-to-hook, `@Entity` links) | P4 / M5 | #118 | Missing | Spine slice A4. |
| CAMP-10 | Tab 9 Settings (GM persona, art-style lock, play mode, members/invites, memory export, danger zone) | P4 / M5 | #117 | Missing | Art-style lock = Q16. Spine slice A3. |
| CAMP-11 | Campaign creation flows (Quick Forge, Guided 6-step Setup, Empty World, template picker) | P4 / M5 | #62 | Partial | **#62**: three-path creation modal from the campaigns browser. **Empty World** creates a bare workspace; **Quick Forge** + **Guided Setup** (6-step stepper) create the campaign then run a synchronous Realms **region** (and optional faction) cascade via `campaigns.forge`, attaching the parent + cascade children to the World tab as undiscovered (reuses `generateNewEntity`/`persistChildren`). Forging is gated on `campaigns.forgeStatus` (ANTHROPIC_API_KEY) and degrades gracefully to an empty world when unconfigured; failures still land the user in the workspace. **Deferred:** durable Trigger.dev cascade with cinematic progress (needs `tr_prod_` key, INFRA-1) — currently synchronous; GM-preset/art-style fields; party-slot reservation; opening-scene narration generation; template picker. |
| CAMP-12 | Campaigns list: filter bar, rich cards (banner/roster/stats), card actions, templates section | P4 | doc-only | Partial | Today: name/description grid → play. |
| CAMP-13 | AI Memory panel (pins, recaps, entity awareness, drift detection) | P5 | doc-only | Missing | Memory tier is P5. |
| CAMP-14 | Multiplayer invite/seat flow (email/link invites, permissions, player-mode subset UI) | P4 | doc-only | Missing | — |
| CAMP-15 | Cross-surface entry ("Add to Campaign" from Characters/Realms; "Back to Workspace" from play); deep links `?tab=` | P4 | #55 | Partial | **#55**: "Back to Workspace" link added to Live Play; workspace tabs deep-linkable via `?tab=<slug>`. "Add to Campaign" from Characters/Realms still pending (Party tab #61 covers the in-workspace add). |

### 3.7 Live Play — `docs/ui-flows/live-play-surface.md`

Early tactical-map slice (~15–20% of doc): PixiJS grid, Yjs sync, move + end-turn,
server-authoritative engine. Narrative chat, HUD, and most of the 5-zone shell absent
(explicit code stub: "...arrive with the Live Play surface (P4)").

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| PLAY-1 | Chat / narrative zone (GM/player entries, dice widgets, engine-event rows, entity chips) | P4 | #57 / #96 | Partial | **#57**: server-authoritative narrative chat on a top-level `chat` Y.Array in the shared Hocuspocus doc (clients are observers; `useLiveSession` exposes `chat` + `sendChat`). Renders GM / player / engine-event / `roll` / OOC rows; accepted battle commands emit `event` rows; `/roll NdM±K` renders a structured dice widget. **#96**: the stubbed GM echo is replaced by **real AI-GM narration** — the WS server calls `@app/llm` (env-gated on `ANTHROPIC_API_KEY`; falls back to the echo when unconfigured or on failure) with the live scene + recent chat, and the GM is a storyteller only (the deterministic engine still owns all mechanics, Q12). **Chat is now persisted** to a dedicated `chat_messages` table (per-campaign `seq` ordering) and re-hydrated on room load, so the conversation survives a cold reload; sandbox rooms stay ephemeral. The GM's referenced on-scene entities render as **`@Entity` chips**. **Deviation:** chat is persisted to its own table, *not* the deterministic `engine_events` log, because AI narration is non-deterministic and would break replay. **Deferred:** narration is synchronous (no "GM is thinking…" indicator — #97), mentions are limited to live on-scene entity names (no Realms/campaign-world-entity linking or auto-reveal — that rides the CAMP-4 reveal seam), and the engine isn't yet given narration context back as memory (rolling summary / RAG is P5). |
| PLAY-2 | Player input modes (Speak/Action/Check/Cast/Attack/Use Item, slash commands, OOC) + AI "thinking" state | P4 | #57 / #97 | Partial | **#57**: composer with the six mode buttons, slash commands (`/roll`, `/help`), and OOC `((…))`. **#97**: the **AI "thinking" indicator** is live — the WS server broadcasts a transient `{t:"thinking"}` stateless signal around every real AI-GM turn and the chat zone shows an animated "GM is weaving the tale…" row. The **Check mode now routes through the engine via the orchestrator**: a new deterministic `ability_check` engine command (d20 + ability mod + optional proficiency vs DC, emitting `CheckRolled`); the server asks the LLM (`decideCheck`) which ability/skill + DC a free-text attempt needs, the engine rolls it (the model never sees/invents the result), the outcome is shown as an engine-event row, and the GM narrates honouring the dice. `LiveRoom.apply` now returns the engine command summary so the server can read mechanical results. **Deferred:** Action/Cast/Attack/Use-Item composer modes still narrate (mode-aware) rather than emitting structured commands — Attack/Cast already have the mechanical path via the combat action bar (#58/#98); free-text→combat-command orchestration (LLM proposing attack/cast/use-item tool calls) is the remaining piece. The check is resolved against the active PC (or first PC in scene); per-skill proficiency is the orchestrator's call (the live entity doesn't carry skill lists). Check routing requires `ANTHROPIC_API_KEY`; unconfigured, Check narrates via the stub. |
| PLAY-3 | Character HUD right rail (abilities, HP/AC, conditions, resources, attacks, inventory quick-use) | P4 | #63 / #98 | Partial | **#63**: Live Stats HUD for the active combatant in the play surface right rail, driven entirely by the synced `WorldState` so it updates live as engine events resolve — abilities + mods, HP bar/temp/AC/speed/prof, action-economy chips, conditions, concentration, spell slots, death saves, active-turn highlight, and a compact mode. Quick-attack routes through the engine against a hostile-target picker. **#98**: the HUD's primary attack + quick-use are now driven by the character's real equipped weapon (best of the sheet's weapons) and real consumables (potions/scrolls/etc.); item quick-use is still a narrative `sendChat` until item effects route through the engine (SMITH-7). **Deferred:** portrait, quick-roll buttons, and HP-change toasts. |
| PLAY-4 | Party rail (collapsed chips, hover mini-HUD, assist pulses) | P4 | doc-only | Missing | — |
| PLAY-5 | Full top bar (scene breadcrumb, dual clocks, Pause, tools row: pacing/TTS/memory/inventory) | P4 | doc-only | Missing | — |
| PLAY-6 | Combat overlay (round banner, horizontal initiative on map, range rings) + full combat loop (attacks/spells/reactions/targeting/resolution) | P4 | #58 / #98 / #99 | Partial | **#58**: combat overlay above the map (round banner + horizontal initiative strip + movement radius + targeting range square); a combat **action bar** on a controllable turn (Attack + Cast menu) that arms the map's **target picker** (range ring + tap-to-pick highlighted enemies); attack + single-target spell cast resolved by the **engine** (`attackAction`/`castAction` added to the live `BattleAction` set, validated server-side). **#98**: the action bar now lists the active PC's **real equipped weapons** (multi-weapon dropdown; SRD weapon catalog × live ability mods/prof, with ranged weapons setting the picker range) and the **real castable spells** from the sheet (sheet spells ∩ the single-target registry subset, slot-gated); opportunity-attack reactions also use the reactor's sheet weapon. **#99**: **AoE aim picker** — area spells (Fireball sphere, Burning Hands cone) arm an aim mode where the player taps a cell to place the blast and the map previews the covered cells + caught creatures (friend and foe) using the engine's own `withinBurst`/`withinCone` math, then **Confirm** sends a `cast_spell` with an `origin` cell the engine resolves authoritatively (`isBattleAction` now accepts `origin`; `castSpell`/`useLiveSession` thread it). **Resolution detail**: the engine-event chat row is now enriched from the command summary (`LiveRoom.apply` surfaces it) — attacks show roll-vs-AC + damage (+ crit/downed), save spells show failed-saves/total damage + the save DC, spell attacks show hit/damage — replacing the terse "an attack was resolved" line. **Deferred:** weapon proficiency is assumed for equipped weapons; the single-target cast subset is still the registry spells (Fire Bolt / Sacred Flame / Guiding Bolt) and area casts are Fireball / Burning Hands; AoE preview ignores line of sight (the engine still enforces it on resolution, so a behind-a-wall creature may preview as caught yet be spared); Ready action; HP-change toasts. The foes are still the fixed goblin ambush (only the party is sheet-seeded); scaled/authored encounters are a later slice. |
| PLAY-7 | Map zoom levels L0–L4 + layer toggles + Edit Map + fog of war + token interaction menus + text-driven movement | P4 | doc-only | Missing | Today: single tactical grid, drag-only. |
| PLAY-8 | Scene transitions (cross-fade, location banner, auto-forge stubs on travel) | P4 | doc-only | Missing | — |
| PLAY-9 | Tier 4 reaction windows (timed prompts, auto-pass), pacing controls | P4 | #58 / #104 | Partial | **#58**: timed opportunity-attack prompt — when the engine opens a reaction window (`encounter.reactionWindow`) for a party-controlled reactor, a 12s countdown prompt offers Opportunity Attack (engine `opportunity_attack`) or Pass; auto-passes on timeout; dismissed windows stay dismissed. **#104 (AI-reactor reactions)**: when a PC flees an **AI-controlled** reactor's reach, the orchestrator now takes the opportunity attack automatically — a `runEnemyReactions` driver in the WS server resolves every AI-eligible reactor in the open window via the engine's `opportunity_attack` (attack/damage from the reactor's `monsterAttackProfile`), emits the enriched resolution row, and narrates it under the "GM is thinking" signal; runs after any accepted player command, bounded by a guard. Pairs with enemy AI movement (PLAY-15/#111), so fleeing now has a cost both ways. **#104 (Ready actions)**: the combat action bar gains a "Ready ▾" control that arms a target picker over **every** hostile in the scene (not just those in range — a readied strike is for a foe that hasn't closed yet); picking one holds the strike via the engine `ready_action`, encoding the weapon's range in the trigger (`in_range:<ft>`). A `runReadiedTriggers` WS-server driver (mirroring `runEnemyReactions`) evaluates held actions after every enemy move and fires the one whose target has entered range via `trigger_readied` — *before* the foe's own attack resolves, so a readied blow can drop the attacker first. Resolution rows render `Readied — …`; a held action shows a confirmation banner on the owner's turn (engine clears it at their next turn). **Deferred (still #104):** broader pacing controls (e.g. round timers, initiative-delay/hold). |
| PLAY-10 | TTS (toggle, per-NPC voices, Listen, queue) | P4 (TTS) | doc-only | Missing | TTS in v1; STT is v1.5 (V15-*). |
| PLAY-11 | Inline memory & retcon (panel, per-entry "Retcon from here", ghost-timeline confirm) | P5 | doc-only | Missing | Retcon UI is P6/E5. |
| PLAY-12 | End-session flow (stats summary, auto-recap, memory pin, redirect to workspace) | P4/P5 | doc-only | Missing | — |
| PLAY-13 | Async-play affordances (async badge, "X joined — Switch to Live?" prompt, resume banner) | P4 | doc-only | Missing | — |
| PLAY-14 | Live-play resilience/polish (reconnect banner, lag indicator, AI retry, cost meter, idle timeout, crash recovery, mobile play tabs) | P6 | doc-only | Missing | — |
| PLAY-15 | Combat AI Orchestrator — autonomous enemy/NPC turns | P4 | #111 | Partial | **#111**: combat is now two-sided. A `runEnemyTurns` driver in the WS server runs every non-player combatant's turn after any accepted command (a player's `end_turn` flows into the foes' turns), after `reset`, and on room load (so a foe that won initiative acts first). The authoritative tactic is a pure, LLM-free planner (`planMonsterTurn` in `enemy-ai.ts`): move toward the nearest hostile PC within the movement budget (engine square-move legality) and make a basic melee strike when in reach (lowest-HP target; attack/damage derived from the monster's own scores + proficiency), else end turn — every step still validated by the engine. Reuses the **#97 pattern**: when `ANTHROPIC_API_KEY` is set the LLM (a) picks the target among engine-legal candidates (`decideMonsterTarget`) and (b) narrates the turn (`narrateEnemyTurn`) under a "GM is thinking" signal; both best-effort, deterministic core runs without a key. Bounded by an iteration guard. **Deferred:** monster spells/special abilities (basic melee only); encounter `AI tactics hint` plumbing (encounter authoring); multiattack/legendary/lair actions; pacing/step controls; smarter pathfinding. |

---

## 4. Engine / spells

| ID | Item | Source | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|---|
| ENG-1 | Postgres-backed per-campaign event persistence behind engine tRPC router | roadmap P1→P2 (old #2) | P2 | #2 (closed) | Done | Shipped: `engine_events` table + `PgEventStore`; `engine.submit`/`state` append + rebuild scoped to owned campaign. Kept for history. |
| ENG-2 | Top-120 spell authoring + golden tests (full curation) | roadmap E3–E5 | P3–P5 | doc-only | Partial | Spell cast pipeline + several spell families shipped (#40–#43); full top-120 list pending. |
| ENG-3 | Remaining ~240 SRD spells (toward full ~360) | roadmap §11 | post-GA / v1.x | doc-only | Deferred | Registry expansion, no schema break. |
| ENG-4 | QuickJS Smithy sandbox (imperative escape hatch execution) | roadmap E5 | P6 | doc-only | Deferred | "Sandbox deferred" in P2 Smithy MVP note. |
| ENG-5 | Retcon UI (ghost-timeline surfaced as undo/audit) | roadmap E5 | P6 | doc-only | Deferred | Event store is retcon-ready; UI not built. |
| ENG-6 | LLM tool-adherence harness (>98% on fixtures) | roadmap §7 alpha gate | P6 | doc-only | Deferred | — |

---

## 5. Infra / setup (provision-when-needed)

| ID | Item | Deferred-to | Tracking | Status | Notes |
|---|---|---|---|---|---|
| INFRA-1 | Trigger.dev `tr_prod_` runtime secret key | when app triggers tasks at runtime (P4 cascades) | doc-only | Deferred | Nightly cron works on existing setup; `tr_dev_` present. |
| INFRA-2 | Vercel deploy | when needed | doc-only | Deferred | Repo pushed, unblocked. |
| INFRA-3 | Sentry / PostHog account provisioning | P6 (alpha funnels) | doc-only | Deferred | Env-gated stubs already in code. |
| INFRA-4 | Pricing rate lock (flat vs usage vs hybrid) | before M8 closed beta | doc-only | Deferred | Commercial-from-closed-beta + 10 free DM chats already locked (`product-spec.md` §5). |
| INFRA-5 | `gh` on PATH permanently (per-user) | done | doc-only | Done | `C:\Program Files\GitHub CLI` added to the user PATH (Jun 2026, via PowerShell `SetEnvironmentVariable`). `gh` resolves in new terminals; authed as `jordanlarch`. |
| INFRA-6 | Full normalized SRD ingest pipeline + scheduling (beyond nightly Open5e spell job) | P5–P7 | doc-only | Deferred | Migrate Open5e → custom SRD 5.2 ingest at GA (`data-sources.md` §1). |

---

## 6. v1.5+ / out-of-scope (linked, not restated)

These are **locked product cuts**, not backlog. Do not re-pitch without an explicit
decision update. Full lists:

- `docs/product-spec.md` §6 — consolidated v1 out-of-scope.
- `docs/00-consolidated-plan.md` — per-decision cuts.
- `AGENTS.md` "Considered And Rejected" — alternatives ruled out (human-DM tier, top-level
  Maps nav, lower combat tiers, collapsing the three libraries, LLM-does-math, etc.).

Quick index of the v1.5+ deferrals referenced by rows above:

| ID | Item | Source | Notes |
|---|---|---|---|
| ART-1 | AI image generation (tokens/portraits/maps on-demand) | Q16 | v1.5+. v1 = library + manual upload only. Referenced by REALM-7 auto-art, CAMP-10 art-style-lock. |
| V15-1 | STT (speech-to-text input) | Q19c | v1.5. TTS-only in v1 (see PLAY-10). |
| V15-2 | AI-styled / painterly map overlay | data-sources §AI-Styled Maps | v1.5+. Procedural geometry only in v1. |
| V15-3 | World Anvil import (Realms) | realms-library.md | v1.5. Referenced by REALM-8. |
| V15-4 | Spectator mode, highlight reel | live-play-surface.md | v1.5. |
| V15-5 | Deep-dive tutorials (Smithy/Realms/multiplayer) | roadmap §11 | v1.5+. |

---

## 7. Maintenance

- When you ship an item, set its **Status** to `Done` (and add the merge commit/PR in
  Notes) rather than deleting the row.
- When you add a new deferral anywhere (a code TODO you're punting, a scoped-out feature),
  add it here first; that's the rule.
- To mirror a batch to GitHub issues, run the `to-issues` skill against the relevant
  section (only if Jordan wants GitHub mirroring for that batch).
