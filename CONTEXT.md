# Loreforge — Project Context

**Loreforge is a modern, AI-GM 5E SRD 5.2 web experience.** Humans play characters; an AI runs the world. Combines deterministic mechanical fidelity, cascading-stub worldbuilding, and an always-on visual map for solo and multiplayer 5E play.

## Status

**Design phase complete (19 architectural decisions locked).** Roadmap locked (May 2026). Engineering started May 2026 (solo engineer).

**Code progress (Jun 2026): P0–P5 substantially complete ahead of calendar.** Milestones reached: **M1 Hello Codex, M2 First Character, M3 First Fight, M4 First World, M5 First Campaign (tracer depth), M6 Tutorial E2E.** Memory tier (MEM-1–MEM-8) is Done. **`docs/deferrals.md` is the single source of truth for everything deferred.**

Highlights of what's built:
- **Engine (`packages/engine`, E1–E3):** deterministic dice, event-sourced state, combat pipeline (conditions, action economy, initiative, movement/LOS, rests, concentration, OA reactions, weapon range, Multiattack), spell registry (**120** top-120 spells + golden harness), **ENG-13 active effects** (Bless/Shield/Hunter's Mark/Blur/Faerie Fire). ~452 engine tests.
- **Tier 4 sync:** `@app/ws-server` Hocuspocus Yjs server + PixiJS battle map; persisted per-campaign live play. Invite links shipped at tracer depth (#211, CAMP-14); **multiplayer depth parked** until solo prod polish.
- **Product surfaces:** six-item nav; Codex (spells, species/classes, backgrounds/feats, monsters, items, rules); Characters; Smithy; Realms (7 rich generators + AI pipeline); **9-tab Campaign workspace** (all tabs at tracer+ depth, World Map included); Live Play (chat/HUD/combat/AoE/enemy AI/reactions/party rail/top bar).
- **Tutorial:** *Lantern's Last Flicker* E2E (#169–#178) with launch gate.
- **Memory tier (P5):** rolling summaries, recaps, pins, RAG, live-turn context — shipped.
- **Quest system (Phases A–D):** structured `QuestTemplate` on Realms entities; tease/offer/briefing runtime; Realms + Campaign editors; prerequisite gates, step advance, XP on Resolve — see `docs/quests.md`.
- **Background jobs:** nightly Open5e ingest + re-embed via Trigger.dev.

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

## Current Goal

**M6.5 — Solo prod polish** (Jun 2026). Jordan dogfoods in **Vercel prod as a solo player**. Multiplayer seat auth, ws-server hosting for guests, and Stripe/billing are **explicitly parked** until the single-player loop feels production-grade.

**Active tracks** (priority order):

| Track | Focus | Key IDs |
|---|---|---|
| **1 — Engine + spells** | Top-120 push, effect riders, known/prepared gate | ENG-2, ENG-13 (tracer), ENG-12 |
| **2 — LLM observability** | Usage audit, adherence harness, model routing | ENG-6, `llm_usage_events` (#212) |
| **3 — UI production depth** | Live Play, Campaign, Characters, Codex, Realms polish | PLAY-3/6/12, CAMP-2/6/8, CHAR-7, REALM-2 |
| **4 — Generator depth** | Settlement tabs, dungeon→encounter, shop transactions | GENR-7, GENR-5, GENR-2 |

**Recently shipped (Jun 2026, post-#245):** Characters dashboard sweep (⋯ menu, XP bars, Play Now, 10-step creation wizard) · sheet Features + Personality tabs · 3-step level-up · PLAY-3 party-rail HUD **statsOnly** dedup (turn controls stay on combat bar).

**Recently shipped (#244, Jun 2026):** ENG-2 batch 11 — registry **103 → 120** (top-120 declarative curation complete) + golden snapshots.

**Recently shipped (#243, Jun 2026):** ENG-2 batch 10 — registry **92 → 103** (Hold Monster, Dominate Person, Fear, Suggestion, Wall of Fire, Chain Lightning, Otto's Irresistible Dance, Power Word Stun, Sleep, Greater Restoration, Crown of Madness) + golden snapshots.

**Recently shipped (#212–214, Jun 2026):** `llm_usage_events` + Settings AI usage panel · ENG-6 fixture expansion · ENG-2 batches 4–9 · ENG-12 prepared-cast gate · ENG-13 active effects · mid-campaign **roster → live sync** · PLAY-4 party sheet peek · Bless multi-target + Shield reaction tracer · CAMP-6 Sessions deep view · Characters Combat tab · migration 0030 · **Rung 1 dogfood fixes**.

**Recently shipped (#211, merged Jun 2026):** PLAY-15 Multiattack · ENG-10 reach OA · ENG-2 spell batch 3 · CAMP-14 invite tracer · CAMP-7 World Map tab · REP-1 reputation tracer · migration 0029.

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
