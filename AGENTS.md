# AGENTS.md — Handoff for the Next Agent

You are picking up Loreforge — a modern AI-GM 5E SRD 5.2 web app. Design phase and v1 roadmap are complete (May 2026); P0–P4 substantially shipped, P5 (Tutorial + Memory) largely shipped early (Jun 2026). This document tells you what to read, what is settled, what is open, and how to work with the human (Jordan).

## Read in This Order

1. **`CONTEXT.md`** (root) — project elevator pitch, tech stack, current status, doc map
2. **`docs/00-consolidated-plan.md`** — every architectural decision, locked
3. **`docs/product-spec.md`** — personas, success metrics, consolidated v1 out-of-scope, assumptions (read this before scoping or sequencing decisions)
4. **`docs/02-implementation-roadmap.md`** — v1 phased roadmap, milestones, beta gates, locked delivery decisions (read before starting engineering)
5. **`docs/01-tech-stack.md`** — when you need rationale for any stack choice (frontend, DB, sync, hosting, etc.) or alternatives considered
6. **`docs/data-sources.md`** — when you're working with external services (LLM, embeddings, TTS, image gen, SRD ingest, map libraries)
7. The specific drill-down doc for whatever surface you're touching:
   - **Building / discussing UI?** → the matching file in `docs/ui-flows/`
     - **Campaign prep or play?** → `docs/ui-flows/unified-campaign-ux.md` first (canonical IA); then `campaigns-workspace.md` / `live-play-surface.md` for drill-down
   - **Building the engine?** → `docs/engine/architecture.md` *(§16 solo phasing + top-120 are locked; other sections may still be proposals — see "Where Things Came From")*
   - **Building a generator?** → `docs/generators/forms-and-pages.md`; sample outputs live in `docs/generators/samples/`
   - **Working on onboarding?** → `docs/onboarding/tutorial-adventure.md`

Do **not** read the entire docs tree linearly — it is large. Use the doc map in `CONTEXT.md` to jump.

## What Is Locked (Do Not Re-Litigate)

The 19 decisions in `docs/00-consolidated-plan.md` are settled. Specifically:

| Topic | Decision | Source |
|---|---|---|
| Product model | **AI-GM** — no human DM tier; the AI is the GM for every campaign | Q10 |
| Mechanics | **Deterministic engine** — LLM never does math; only narrates | Q12 |
| Tech stack | Next.js / tRPC / Postgres + pgvector / Drizzle / Yjs / Anthropic Claude | Q17 |
| Navigation | Six items: Home / Characters / Campaigns / Codex / Smithy / Realms | — |
| Maps | Attribute of entities; always-on above chat during play; **no** top-level "Maps" nav | Q3 |
| Spell coverage | Full SRD 5.2 (~360 spells); declarative schema + imperative escape hatch | Q18b |
| Combat | **Tier 4** — real-time multiplayer sync via Yjs CRDT; combat auto-routes to Live Mode | Q9 |
| Generator UX | Single-page input form → inline-editable detail page → per-section regenerate | Q6 |
| Realms IA | Flat-by-type sidebar + Grid/List/Graph view toggle + relationship panels | Q5 |
| Plot Hooks | Embedded on Realms entities until accepted into a Campaign; then first-class Campaign-scoped | Q7 |
| NPCs | First-class; auto-created by every generator | Q4 |
| Cascading stubs | Higher-tier generators auto-create child stubs; child generators expand them | Q6 |
| State model | Event-sourced; full retcon with ghost-timeline branches preserved | Q15, Q19a |
| Memory | Multi-tier: engine state + hot context + rolling summary + RAG + auto-recaps | Q15 |
| Discovery | Realms entities have per-campaign discovered-by-party state; auto-revealed on AI narration | Q11 |
| Play tempo | **Hybrid** — async default, opt-in Live Session Mode for combat | Q19c |
| TTS | Optional; per-NPC voices; STT deferred to v1.5 | Q19c |
| Art | Campaign-level style lock; hybrid token/portrait pipeline (library + on-demand AI + upload) | Q16 |
| Onboarding | 30-min "Lantern's Last Flicker" tutorial micro-campaign with first-time tooltips | Q19d |
| Mobile | Desktop-first; responsive degraded view; no native apps in v1 | Q19e |

## What Is Open

> **Live backlog / deferrals: `docs/deferrals.md` is the single source of truth.** Every
> deferred, postponed, stubbed-at-tracer-depth, or scoped-out item lives there with a phase
> tag. This section keeps only the high-level status; do not re-scatter deferrals.

- **Code status (Jun 2026)** — **P0–P4 substantially complete; P5 (Tutorial + Memory) largely shipped early.** Milestones: **M1–M4** at vertical-slice/tracer depth; **M5 "First Campaign" ~complete** per `docs/03-m5-completion-plan.md` (Workstreams A/B/C ✅); **M6 Tutorial E2E shipped** (TUT-1 #169–#178, user verified). All 7 rich generators shipped (Settlement tab depth partial). Campaign workspace **7/9 tabs** built (World Map missing — CAMP-7). Live Play substantial (chat/HUD/combat/enemy-AI/reactions/party-rail/top-bar/scene-transitions). Memory tier MEM-1–8 Done. **SRD 5.1→5.2 audit (AUDIT-0–9) complete** — see `docs/srd-version-audit.md`. **Gameplay Toolbox Live Play v1 complete** (traps → fear, #292–#305); **Smithy toolbox removed** (#306). **GRILL-EXPLORATION complete** (Q1–Q9); **active slice: Exploration hazards Codex (Slice 1)**. **Active frontier:** PLAY-15, ENG-10, ENG-2 batch 3, CAMP-14, CAMP-7, INFRA-1, REP-1 — see `docs/deferrals.md`. Branch **`main`**, clean. Package manager is **npm** (not pnpm).
- **Hosting / infra setup** — Supabase provisioned (Auth + Postgres in use); GitHub + CI live; Trigger.dev project live (nightly Open5e ingest deployed to prod). Still to provision when needed (see `docs/deferrals.md` §5): Trigger.dev `tr_prod_` runtime key (for runtime task triggers / P4 cascades), Vercel deploy, Sentry/PostHog accounts (env-gated stubs already in code).
- **SRD content ingestion pipeline** — **PDF-first policy** (SRD 5.2.1 PDF canonical; Open5e `srd-2024` for machine ingest). **Nightly Open5e ingest** via Trigger.dev (spells, creatures, items, backgrounds, feats, rules → `codex_*`). Curated species/classes/subclasses seeded in-repo. Full registry: **339** Open5e catalog entries + **124** hand-authored combat overrides (`npm run generate:spell-registry`). Custom PDF parse deferred to GA (`docs/deferrals.md` INFRA-6; `docs/data-sources.md` §1). **5e-bits API not used** (2014-only; rejected Jun 2026).
- **Pricing price points** — commercial from closed beta with 10 free DM chats is locked (`docs/product-spec.md` §5); flat vs usage vs hybrid **rates** lock before M8 closed beta. See `docs/02-implementation-roadmap.md` §2.

**Recently locked (May 2026):** v1 roadmap (`docs/02-implementation-roadmap.md`), solo engineer + top-120 spells + all 7 generators, Supabase Auth, Tier 4 from day one, three-stage beta, tutorial gate (strict open beta/GA), engine §16 solo calendar. Product locks in `docs/product-spec.md` §5. **(Jun 2026: background-jobs provider switched from Inngest to Trigger.dev — see `docs/01-tech-stack.md` §9.)**

## Considered And Rejected

The following alternatives came up during design and were explicitly considered then ruled out. They are recorded here so the next agent doesn't waste cycles re-pitching them. If you want to re-open one, the bar is: new information that wasn't available when the decision was made, plus an explicit update to `docs/00-consolidated-plan.md`.

| Considered | Rejected because |
|---|---|
| Human-DM tier alongside AI-GM | Splits product focus; AI-GM is the wedge. Possible v2, not v1. |
| Top-level "Maps" navigation item | Maps are attributes of entities (regions, settlements, dungeons, scenes), not their own surface. |
| Tier 1 or Tier 2 combat (turn-based with manual roll entry / chat-driven moves only) | Tier 4 (real-time multiplayer with token sync) is the experience that makes the product feel like a VTT and is locked from day one. |
| Collapsing Codex / Smithy / Realms into one library | SRD reference, homebrew rules, and worldbuilding entities are distinct concepts with different IA needs. Three libraries, locked. |
| LLM does the math (paraphrases dice rolls, HP changes, conditions) | Mechanical fidelity is the wedge. Deterministic engine owns mechanics; LLM proposes structured tool calls and narrates only. Non-negotiable. |
| Custom SRD 5.2 ingest from day one | High up-front cost. Hybrid approach: Open5e `srd-2024` ingest now, custom PDF parse at GA. Details in `docs/data-sources.md` §1. |
| **5e-bits / dnd5eapi.co API** | 2014-only corpus (`/api/2024/` → 404); never integrated in code. Open5e `srd-2024` covers v1 ingest. Rejected Jun 2026 (SRD-AUDIT-9). |
| Top-120 spells only in v1 (partial coverage) | Full SRD 5.2 (~360 spells) is locked because partial coverage produces an inconsistent "what works / what doesn't" experience. The engine architecture (declarative schema + imperative escape hatch) is designed to make full coverage tractable. |
| Native mobile apps in v1 | Desktop-first; responsive degraded view only. Native mobile is a v2 consideration. |
| STT (speech-to-text) in v1 | Deferred to v1.5. TTS only in v1 (optional, per-NPC voices). |
| AI image generation in v1 | Deferred to v1.5. Hybrid token/portrait pipeline only in v1 (library + manual upload; AI gen later). |
| Plot Hooks as top-level nav | Plot Hooks live embedded on Realms entities until accepted into a Campaign, then become first-class Campaign-scoped. Not a top-level surface. |
| Pure-async or pure-live play tempo | Hybrid: async by default, opt-in Live Session Mode, combat auto-routes to Live. |
| Ghost-timeline branches as user-facing feature | Retcon preserves ghost-timeline branches as audit/undo data, but they are not a surfaced user-facing feature in v1. |

## What NOT to Do

- **Do not re-architect the tech stack.** It was deliberated and approved wholesale. Substitutions require an explicit decision change with rationale + update to `00-consolidated-plan.md`.
- **Do not propose a human-DM mode** for v1. The product is AI-GM-first. A human-DM mode could be a v2 feature; do not add it to v1 scope.
- **Do not move Plot Hooks, Maps, or NPCs to top-level nav.** Six items, locked.
- **Do not propose paraphrasing the LLM into engine math.** The engine owns mechanics; the LLM proposes tool calls only. This is non-negotiable.
- **Do not collapse the three libraries.** Codex / Smithy / Realms are distinct. SRD reference ≠ homebrew rules ≠ worldbuilding entities.

## Repository Conventions

- All design docs live under `docs/`. Code (when written) lives under `apps/` or `src/`.
- **All deferrals go in `docs/deferrals.md`** — the single source of truth for deferred/backlog/scoped-out items. When you punt a feature or leave a TODO, add a row there first; don't re-scatter deferrals across docs. Mark shipped items `Done` (don't delete). GitHub-issue mirroring is opportunistic (local file is canonical).
- **Post-implementation ship workflow:** after code is done, follow `.cursor/skills/ship-it/SKILL.md` — verify CI, commit, PR, merge, migrations (if any), and update `deferrals.md` / `CONTEXT.md` when applicable.
- **Slice verify gate (strict):** UI/workspace slices must **ship → prod verify (1–3 checklist steps) → only then next slice**. Engine-only slices: **CI/tests = verify**; prod verify only when the change touches Live Play or a campaign workspace tab (or other user-visible surface). Do not start the next slice until verify for the current one is complete.
- Architectural changes that contradict the consolidated plan require an explicit decision update + bump to `docs/00-consolidated-plan.md` with rationale.
- New design docs should follow the structure of existing ones: clear headings, wireframe-style ASCII mockups where useful, concrete examples over abstractions, engineering effort estimates at the end.
- The transcripts that produced these docs are not in this repo (they live in the user's local Cursor session history). The docs in `docs/` are canonical; the transcripts are background.

## Working With the User

- **Jordan** is the product owner and (currently) the only contributor.
- **Slice sequencing:** one slice at a time. **UI/workspace slices** — ship, then run a **1–3 step prod verify checklist** on Vercel prod (or report blockers); **do not** start the next slice until verify passes or Jordan explicitly defers. **Engine-only slices** — green CI + relevant unit tests count as verify; prod dogfood only when the diff touches Live Play, a workspace tab, or another user-visible surface.
- The design work was done via the `grill-me` skill — one-question-at-a-time interview style with the assistant providing recommended answers.
- For new design decisions, prefer the same `grill-me` skill — it produced this design baseline.
- Jordan's tools of choice: Cursor IDE, PowerShell (Windows), GitHub. Do not assume Bash.
- Workspace path: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`

## Connecting to the GitHub Repo

If the local repo is not yet connected to GitHub (Shell tool may have failed during initial setup), Jordan should run the following from the repo root:

```powershell
git init
git remote add origin https://github.com/jordanlarch/Loreforge.git
git fetch origin
# If the GitHub repo has existing content (e.g. a README), merge/rebase:
git pull --rebase origin main
# Then commit the docs:
git add CONTEXT.md AGENTS.md docs/
git commit -m "Add design baseline: 19 locked decisions + UI flows + engine + generators + tutorial"
git push -u origin main
```

If the GitHub repo is fresh / empty:

```powershell
git init
git add CONTEXT.md AGENTS.md docs/
git commit -m "Add design baseline: 19 locked decisions + UI flows + engine + generators + tutorial"
git branch -M main
git remote add origin https://github.com/jordanlarch/Loreforge.git
git push -u origin main
```

## Where Things Came From

Three provenance categories for the docs in this repo:

**1. User-authored canonical sources, copied verbatim:**
- `docs/onboarding/tutorial-adventure.md` — Jordan's canonical "Lantern's Last Flicker" tutorial spec
- `docs/generators/forms-and-pages.md` — Jordan's canonical "7 Generators" spec
- `docs/generators/samples/*.md` — seven generator sample outputs Jordan provided; transcribed verbatim with the `source:` URLs blanked out

**2. User-authored drafts, transcribed with light editorial polish (rich-text export noise stripped, nav labels normalized to current six-item nav):**
- `docs/ui-flows/home.md`
- `docs/ui-flows/characters-dashboard.md`
- `docs/ui-flows/character-creation-wizard.md`
- `docs/ui-flows/level-up-wizard.md`
- `docs/ui-flows/character-view-inline-editing.md`
- `docs/ui-flows/codex.md`
- `docs/ui-flows/smithy.md`
- `docs/ui-flows/realms-library.md`
- `docs/ui-flows/campaigns-workspace.md`
- `docs/ui-flows/live-play-surface.md`
- `docs/ui-flows/unified-campaign-ux.md` *(canonical campaign prep/play IA — Jun 2026 grill)*

**3. Authored from chat decisions and project context during the design phase:**
- `CONTEXT.md`
- `AGENTS.md` (this file)
- `docs/00-consolidated-plan.md` (consolidated record of the 19 locked decisions)
- `docs/01-tech-stack.md` (written from stack decisions, with rationale and alternatives drafted to match)
- `docs/data-sources.md` (written from external-services decisions)
- `docs/product-spec.md` (gap-filler for the four product concerns not captured in other docs: personas, success metrics, consolidated out-of-scope, assumptions — written from chat context and the existing docs; targets in §2 are best-guess starting points, not committed numbers)
- `docs/engine/architecture.md` (per "What Is Open" above: some sections are concrete proposals rather than fully-locked decisions; revisit before committing to specifics)

The original chat transcripts that produced category 3 are in Jordan's Cursor session history, not in this repo. If a section in any category-3 doc conflicts with what Jordan remembers deciding, Jordan's memory wins and the doc should be updated.
