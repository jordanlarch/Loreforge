# Loreforge — Project Context

**Loreforge is a modern, AI-GM 5E SRD 5.2 web experience.** Humans play characters; an AI runs the world. Combines deterministic mechanical fidelity, cascading-stub worldbuilding, and an always-on visual map for solo and multiplayer 5E play.

## Status

**Design phase complete (19 architectural decisions locked).** Roadmap locked (May 2026). Engineering started May 2026 (solo engineer).

**Code progress (Jun 2026): P0–P5 substantially complete ahead of calendar.** Milestones reached: **M1 Hello Codex, M2 First Character, M3 First Fight, M4 First World, M5 First Campaign (tracer depth), M6 Tutorial E2E.** Memory tier (MEM-1–MEM-8) is Done. **`docs/deferrals.md` is the single source of truth for everything deferred.**

Highlights of what's built:
- **Engine (`packages/engine`, E1–E3):** deterministic dice, event-sourced state, combat pipeline (conditions, action economy, initiative, movement/LOS, rests, concentration, OA reactions, weapon range, Multiattack), spell registry (**339** catalog + **126** combat-authored + golden harness on hand-authored set), **ENG-13 active effects** (Bless/Shield/Hunter's Mark/Blur/Faerie Fire). ~570 engine tests (75 files).
- **Tier 4 sync:** `@app/ws-server` Hocuspocus Yjs server + PixiJS battle map; persisted per-campaign live play. Invite links shipped at tracer depth (#211, CAMP-14); **multiplayer depth parked** until solo prod polish.
- **Product surfaces:** six-item nav; Codex (spells, species/classes, backgrounds/feats, monsters, items, rules); Characters; Smithy; Realms (7 rich generators + AI pipeline); **7-tab Campaign prep workspace** (Overview / Map / Locations / Party / Quests / Notes / Settings — Map = overworld grid; CAMP-7 partial) + a unified Live Play shell (sessions/memories as lightboxes); Live Play (chat/HUD/combat/AoE/enemy AI/reactions/right party rail/top bar).
- **Tutorial:** *Lantern's Last Flicker* E2E (#169–#178) with launch gate.
- **Memory tier (P5):** rolling summaries, recaps, pins, RAG, live-turn context — shipped.
- **Quest system (Phases A–D):** structured `QuestTemplate` on Realms entities; tease/offer/briefing runtime; Realms + Campaign editors; prerequisite gates, step advance, XP on Resolve — see `docs/quests.md`.
- **Background jobs:** nightly Open5e ingest (`srd-2024`) + re-embed via Trigger.dev; spell registry catalog via `npm run generate:spell-registry`.
- **SRD 5.2 audit (Jun 2026):** AUDIT-0–9 complete — PDF-first policy, Open5e-only ingest, 339-spell registry catalog, 9 species seed, legacy character purge. See `docs/srd-version-audit.md`. **Feature/fidelity coverage map (does the engine implement each rule, correctly?):** `docs/srd-feature-coverage-audit.md` + `deferrals.md` §12 (`SRD-FID-*`).

## What This Is

A web app at the intersection of:

- **AI Dungeon Master** — an LLM-driven GM that narrates, runs NPCs, and improvises
- **Roll20 / Foundry VTT** — real-time multiplayer with a battle map, tokens, and dice
- **D&D Beyond** — SRD reference, character sheets, level-up wizards
- **World Anvil / Char-Gen** — procedural worldbuilding generators
- **A 5E rules engine** — deterministic mechanics for HP, AC, conditions, and spells

**The wedge**: a server-authoritative deterministic engine owns all mechanical state; the LLM proposes commands via tool calls and owns prose only.

## Tech Stack (Approved Wholesale)

- **Frontend**: Next.js (App Router) · React · Tailwind · shadcn/ui · PixiJS (maps)
- **Backend**: Node + tRPC · Drizzle ORM · Postgres + pgvector
- **Sync**: Yjs CRDT over WebSocket · Supabase Auth
- **LLM**: Anthropic Claude (Sonnet narration / routing) · OpenAI embeddings
- **Jobs**: Trigger.dev · **Hosting**: Vercel + Supabase (+ ws-server on Railway/Fly when needed)

Full rationale in `docs/01-tech-stack.md`. Locked decisions in `docs/00-consolidated-plan.md`.

**Implemented packages:** `@app/engine`, `@app/ws-server`, `@app/llm`, `@app/db`, `@app/config`, `@app/memory`.

## Documentation Map

Read `docs/00-consolidated-plan.md` first, then drill into `docs/deferrals.md` for the live backlog.

**Campaign prep + play IA (canonical, Jun 2026):** `docs/ui-flows/unified-campaign-ux.md` — supersedes conflicting sections in `campaigns-workspace.md` and `live-play-surface.md`. Tracking: **CAMP-UX** in `deferrals.md`.

**Dungeon exploration (locked Jun–Jul 2026):** `docs/engine/dungeon-exploration.md` — one scene per floor, zone + connection model, detection triggers, implementation phasing DUN-1–8 (**DUN-1–4 shipped**). Supersedes PR #356 per-room scene design.

## Current Goal

**M6.5 — Solo prod polish** (Jun 2026). Jordan dogfoods in **Vercel prod as a solo player**. Multiplayer seat auth, ws-server hosting for guests, and Stripe/billing are **explicitly parked** until the single-player loop feels production-grade.

**Active tracks** (priority order):

| Track | Focus | Key IDs |
|---|---|---|
| **1 — Engine + spells** | Deepen combat handlers for catalog-only spells, effect riders (top-120 declarative curation + ENG-12 prepared-cast gate are Done) | ENG-2, ENG-13 |
| **2 — LLM observability** | Usage audit, adherence harness, model routing | ENG-6, `llm_usage_events` (#212) |
| **3 — UI production depth** | Live Play, Campaign, Characters, Codex, Realms polish | PLAY-3/6/12, CAMP-2/6/8, CHAR-7, REALM-2 |
| **4 — Generator depth** | Settlement tabs, dungeon→encounter, shop transactions | GENR-7, GENR-5, GENR-2 |

> Live status/IDs for every track item live in `docs/deferrals.md`; the rows above are orientation only.

**Recent ships + full backlog:** see **`docs/deferrals.md`** — the single source of truth for every shipped/`Done`/`Partial`/deferred item (PR-numbered). Do not maintain a duplicate shipped-list here. Most recent frontier (Jun 2026): **FID-21** product wiring (#336 — Live Play class-feature controls + WS seed); GRILL-EXPLORATION exploration hazards (#307–#309); TUT-1 tutorial E2E (#169–#178).

**Parked until polish pass done:** CAMP-14 multiplayer depth · PLAY-9 multi-client reaction sync · INFRA-4 billing · M8 closed beta.

**Branch:** `main`. Package manager is **npm**.

## Critical Risks (Acknowledged)

1. **Full SRD spell automation** — largest engineering subproject (~4–6 engineer-months)
2. **LLM cost per session** — observability in progress; pricing deferred to M8
3. **Combined v1 scope** — realistic 12–18 months with a small team for full v1 as designed

## Repository

- **GitHub**: https://github.com/jordanlarch/Loreforge
- **Local**: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`
- **Owner**: Jordan Larch (`@jordanlarch`)
