# Loreforge — Product Spec (Gap-Filler)

*This document captures the four product-level concerns that do not live in other design docs: target personas, success metrics, consolidated out-of-scope, and assumptions. It is intentionally short. The functional specification of v1 lives across `00-consolidated-plan.md`, the `ui-flows/` directory, `generators/forms-and-pages.md`, `engine/architecture.md`, and `onboarding/tutorial-adventure.md` — this doc does not re-state any of that.*

---

## 1. Target Personas

Loreforge is built for **five concrete users**, listed in priority order. Every v1 design decision should be defensible against at least one of them.

### P1 — The Solo Lapsed Player *(primary)*
- **Who**: 25-45, played D&D in college / with old friends, can't sustain a regular group anymore (kids, schedules, geography, the DM moved away).
- **Wants**: To play D&D again — *now*, alone, on a weeknight, without scheduling four other adults.
- **Why Loreforge**: An AI-GM unblocks them. No need to find a group or a DM.
- **Loreforge for them**: A single-player campaign. Async tempo. Tutorial → first solo campaign → ongoing.
- **Failure mode for them**: Tutorial feels stilted or AI mechanics break trust within the first hour.

### P2 — The Small Friend Group *(primary)*
- **Who**: 2-4 friends who want to play together but none of them want to DM (or the one who did burned out).
- **Wants**: A shared campaign with their friends where the GM workload doesn't fall on a person.
- **Why Loreforge**: AI handles the GM seat. Their friend group brings the social glue.
- **Loreforge for them**: A shared campaign with Tier 4 multiplayer combat, party progression, scheduled sessions ("Tuesday night Loreforge night").
- **Failure mode for them**: Real-time combat sync feels janky, or AI loses thread between sessions.

### P3 — The Worldbuilder *(secondary, broad)*
- **Who**: Loves D&D as a *creative medium* more than as a game. Has notebooks full of homebrew settings, half-finished campaigns, NPC sketches.
- **Wants**: Worldbuilding leverage — generate a region, a city, a faction, a tavern, a dungeon; iterate; layer; export.
- **Why Loreforge**: The seven generators with cascading stubs + Smithy + inline editing give them more compositional creative leverage than any existing tool.
- **Loreforge for them**: Realms-first usage. May rarely run sessions; the world is the product.
- **Failure mode for them**: Generators feel like Mad Libs (shallow / generic). Inline editing is clunky. Outputs don't compose across generators.

### P4 — The Returning Veteran *(activation funnel)*
- **Who**: Played D&D 10+ years ago. Knows the vibe but not the current rules.
- **Wants**: A low-commitment way to dip back in. Doesn't want to read the PHB cold.
- **Why Loreforge**: The 30-minute tutorial adventure ("Lantern's Last Flicker") demonstrates every primary feature through play.
- **Loreforge for them**: Tutorial is the make-or-break moment. If it works, they convert to P1 or P2.
- **Failure mode for them**: Tutorial feels too long, too rules-heavy, or AI screws up an obvious mechanic.

### P5 — The DM-in-Training *(emerging)*
- **Who**: Wants to *learn* to DM. Treats Loreforge as a reference for how a good GM handles encounters, plot hooks, NPC voices, pacing.
- **Wants**: To watch the AI work and copy the moves.
- **Why Loreforge**: AI-GM produces inspectable GM behavior on every turn.
- **Loreforge for them**: Plays a campaign as both player and observer; may run a parallel real-table game informed by what they see.
- **Failure mode for them**: AI behavior is opaque or inconsistent (no "good GM" instincts to copy).

### Personas We Are NOT Building For (v1)

- **Tournament / convention-play 5E communities** — want strict rules-lawyering and certified neutral GMs; AI-GM is not that.
- **Hardcore optimizer minmaxers** — want every variant rule and supplement; SRD 5.2 only is too small a sandbox.
- **Existing DMs running real tables** — Loreforge is not a DM-assist tool in v1 (no human-DM seat exists). Could be a v2 product surface.
- **Non-5E system players** — Pathfinder, OSR, narrative-first systems are explicitly out of scope. The engine is 5E-shaped.
- **Children / family play** — content moderation and onboarding pacing are not tuned for under-13 players in v1.

---

## 2. Success Metrics

Metrics organized by the funnel stage they measure.

### 2.1 Activation (does a new user get to value?)

| Metric | v1 Target | Why |
|---|---|---|
| **Tutorial completion rate** | ≥ 60% of users who start the tutorial finish it | P4 conversion gate |
| **First-session-after-tutorial rate** | ≥ 40% of tutorial completers start a real campaign within 7 days | Confirms the tutorial sells the product |
| **Time-to-first-meaningful-action** | ≤ 5 minutes from signup to first dice roll | Onboarding friction |
| **Character creation completion** | ≥ 80% of users who open the wizard finish it | Wizard UX quality |
| **First generator use** | ≥ 50% of users invoke at least one generator within 14 days | Realms surface adoption |

### 2.2 Engagement (do users come back?)

| Metric | v1 Target | Why |
|---|---|---|
| **D7 retention** | ≥ 25% | Industry baseline for a game-adjacent product |
| **D30 retention** | ≥ 12% | Indicates a sustainable habit forming |
| **Sessions per active user per week** | ≥ 1.5 (avg over weekly actives) | Healthy weekly engagement |
| **Session duration median** | 25-90 minutes | Below this, the product isn't sticky; above this, may indicate stuck users |
| **Weekly active campaigns** | grows linearly with WAU | Campaign abandonment isn't pathological |
| **Multiplayer session attempt rate** | ≥ 15% of campaigns have ≥ 2 distinct human participants | P2 persona validation |

### 2.3 Quality (does the AI do its job?)

| Metric | v1 Target | Why |
|---|---|---|
| **Engine command rejection rate** | < 2% of LLM-issued commands rejected (post-warmup) | LLM tool-call adherence health |
| **Player-reported AI mistake rate** | < 1 per session (self-reported via in-app flag) | Trust signal |
| **Retcon usage rate** | < 1 per 5 sessions (avg) | If higher, AI/engine is breaking trust |
| **Concentration-break correctness** | 100% on regression suite | Mechanical fidelity flagship |
| **Spell-resolution test pass rate** | 100% on the 1,400+ spell test suite | Engine quality bar |

### 2.4 Technical Health *(cross-ref `engine/architecture.md` §10.4, §15)*

The engineering KPIs (latency P50/P95, throughput per node, storage growth, LLM cost per command) are defined in `engine/architecture.md` and are not re-stated here. Treat those as the technical success bar; the metrics in this doc are the *product* success bar.

### 2.5 Commercial

| Metric | v1 Target | Why |
|---|---|---|
| **LLM cost as % of revenue** | < 40% at steady-state | Unit economics |
| **Conversion from tutorial to first paid action** | ≥ 8% of tutorial completers | Funnel viability |
| **Monthly ARPU** | $8-15 range | Sustainable for the LLM-cost profile |
| **Voluntary referral rate** | ≥ 5% of MAU invite at least one new user | P2 multiplayer growth flywheel |
| **Free-trial → paid conversion** | ≥ 15% of accounts that exhaust 10 free DM chats start a paid plan within 14 days | Validates commercial-from-day-one |

> Monetization is **commercial from day one** at closed beta (see §5). Exact price points (usage-based vs flat vs hybrid) remain open; targets assume usage-based or hybrid above a free allowance.

---

## 3. Consolidated Out-of-Scope (v1)

The product surfaces and capabilities below are **explicitly not in v1**. Some are v1.5 candidates; others are v2+ or never. This list is the union of cuts declared across `00-consolidated-plan.md`, `AGENTS.md`, and `engine/architecture.md` §1 — consolidated here so a reviewer doesn't have to assemble the picture.

### 3.1 Product surfaces NOT in v1

| Cut | Status | Source |
|---|---|---|
| Human-DM tier (a human in the GM seat) | v2 candidate | Q10, `AGENTS.md` |
| Top-level "Maps" navigation | Never (maps are entity attributes) | Q3 |
| Top-level "Plot Hooks" navigation | Never (hooks live on Realms entities + campaigns) | Q7 |
| Native mobile apps (iOS/Android) | v2 candidate | Q19e |
| STT (speech-to-text input) | v1.5 candidate | Q19c |
| AI image generation in v1 | v1.5 candidate (Flux/DALL-E later) | Q16 |
| Voice/video chat between players | Never (use Discord) | — |
| Marketplace / user content sharing | v2 candidate | — |
| Spectator / stream mode for sessions | v2 candidate | — |
| Cross-system support (Pathfinder, OSR, narrative-first) | Never (engine is 5E-shaped) | Q12 |
| Collapsed library (single content surface) | Never (Codex / Smithy / Realms stay distinct) | `AGENTS.md` |

### 3.2 Engine capabilities NOT in v1 *(cross-ref `engine/architecture.md` §1)*

- 3D / vertical line-of-sight (2D only)
- Optional/variant SRD rules (encumbrance variants, flanking rules, etc.) — settings-gated if added at all
- Real-time animation interpolation (engine ticks; UI animates from state diffs)
- Mid-flight spell modification by LLM (LLM picks spell + targets; engine executes deterministically)
- Tactical AI optimization for NPCs (NPC tactical choice is the LLM's job, not the engine's)

### 3.3 Spell coverage scope

- Full SRD 5.2 spell list (~360 spells) IS in scope, locked.
- Non-SRD spells (Tasha's, Xanathar's, Fizban's, etc.) are NOT in v1.
- Homebrew spells are in scope via Smithy.

### 3.4 SRD content scope

- SRD 5.2 only.
- Non-SRD official content (subclasses, monsters, items from supplements) is NOT in v1.
- Homebrew content is in scope via Smithy.

### 3.5 Accessibility scope (v1 minimum bar, not aspirational)

- Keyboard navigation: yes, all primary surfaces
- Screen reader: best-effort on text content; map surface is not screen-reader-accessible in v1
- Colorblind safe palette: yes, on chips/states
- Full WCAG AA audit: NOT in v1 (target for v1.x)

---

## 4. Explicit Assumptions

Assumptions that must hold for v1 to succeed. Each one is a place a future agent should challenge if reality drifts.

### 4.1 Technical assumptions

- **LLM tool-call adherence is reliable enough.** Current-generation Claude (Sonnet for narration, Opus for generation) and OpenAI fallbacks can be constrained to tool-first behavior at >98% adherence with the right system prompt. If this assumption breaks, the entire "deterministic engine + LLM proposes commands" model is at risk.
- **LLM cost stays in the $0.005-$0.05 per turn band.** This makes a 3-hour session $1-$10 in LLM cost (`engine/architecture.md` §15.3). If model prices invert and a session jumps to $20+, monetization breaks.
- **Yjs CRDT over WebSocket is sufficient for Tier 4 combat sync** at 6 players. We treat clients as advisory and re-sync from server on detected divergence (`engine/architecture.md` §10.1), which buys us robustness against CRDT subtleties.
- **pgvector + OpenAI `text-embedding-3-large` is good enough for v1 RAG.** No need for a dedicated vector DB (Pinecone, Weaviate, Qdrant) in v1. May revisit at scale.
- **A solo engineer ships v1 in ~28–34 months** with top-120 spells in v1.0, all seven generators, and tutorial as open-beta/GA gate. See `docs/02-implementation-roadmap.md`. Full ~360-spell registry ships in v1.x without schema break.
- **SRD 5.2 will be released and substantially compatible** with what we've designed against. We have a hybrid ingest path (Open5e/5e-bits first, custom SRD 5.2 later — `data-sources.md` §1) that absorbs minor incompatibility, but a major schema break would force significant rework of the Codex.
- **Open5e and 5e-bits APIs remain available** during the early hybrid-ingest period (~6-12 months). If both APIs disappear simultaneously, we accelerate the custom SRD 5.2 ingest with cost we'd planned for later.

### 4.2 Product assumptions

- **Players will accept engine-mediated mechanics.** That is, they'll accept that "I sneak past the guard" goes through a structured stealth check rather than pure LLM improvisation. If players prefer pure-improv games (AI Dungeon style), Loreforge is the wrong product for them.
- **Players will accept some narrative latency** for mechanical fidelity. Combat turns will be ~2-5 seconds per action (engine + LLM narration round-trip). Faster is better; if it's ≥10 seconds per turn, the experience falls apart.
- **The "wedge" is real.** The combination of *deterministic mechanical fidelity + AI-GM + multiplayer + worldbuilding generators* is differentiated enough to compete with AI Dungeon (no mechanics), Roll20/Foundry (no AI-GM), D&D Beyond (no GM/play), and World Anvil (no play). If any one of those competitors substantially closes the gap, the wedge narrows.
- **30-minute tutorial is the right length.** Long enough to demonstrate the product, short enough to finish in one sitting on a weeknight. If completion rate is < 40% we cut it; if it's > 80% we lengthen it.
- **Solo play is the primary acquisition surface** (P1), even though multiplayer (P2) is the higher-lifetime-value cohort. Onboarding pacing assumes solo-first usage.
- **Asynchronous-default play tempo with opt-in Live Mode** matches how lapsed players want to play. If they actually want synchronous-only, Live Mode is the better default and async is the secondary.
- **Voice/portrait audio (TTS) is a delight, not a requirement.** Users opt in; baseline is silent text. If TTS is universally expected (à la modern AI assistants) we need to budget for always-on TTS cost.

### 4.3 Business assumptions

- **Usage-based pricing is viable.** Players will accept a per-session or per-token billing model rather than flat-rate. If they revolt and only flat-rate works, the LLM-cost budget tightens significantly.
- **A solo or small-team distribution model can find P1/P2 cohorts** through D&D-adjacent communities (r/DnD, r/LFG, podcast sponsorships, Critical Role-adjacent audiences) without paid acquisition at first. If organic doesn't move the needle, paid CAC must stay below LTV.
- **No formal licensing of D&D 5E branding is required**, because everything we use comes from SRD (open license). We may *not* call the product "Dungeons & Dragons," reference WotC trademarks, or use copyrighted monster names outside the SRD list.

---

## 5. Locked Product Decisions (Roadmap)

*Resolved May 2026. Canonical sequencing lives in `docs/02-implementation-roadmap.md`.*

| Decision | Locked choice |
|---|---|
| **Team** | Solo engineer |
| **Spell coverage (v1.0)** | Top-120 most-played SRD spells; full ~360 in v1.x (same `SpellDefinition` schema) |
| **Generators** | All seven in v1 (Region, Settlement, Building, Tavern, Shop, Dungeon, Faction) |
| **Multiplayer** | Tier 4 (Yjs CRDT) from day one — no Tier 1/2 throwaway |
| **Auth** | Supabase Auth |
| **Background jobs** | Trigger.dev (cloud; was Inngest, swapped Jun 2026 — see `01-tech-stack.md` §9) |
| **Tutorial launch gate** | Strict for open beta and GA; closed alpha may ship without a polished tutorial |
| **Beta cohort** | Three-stage: closed alpha → closed beta → open beta → GA |
| **Commercial model** | Paid from closed beta onward; every new account gets **10 free DM chats** (see below) |

### 5.1 Free trial — 10 DM chats

Every new account receives **10 free DM chats** to try the product before paywall or plan selection.

**Definition — one DM chat:**
- One **player-authored message → AI-GM response** round-trip inside an **active campaign play session** (async or Live Session Mode).
- Counts when the orchestrator completes a full GM turn in response to player input (including tool calls + narration).

**Does not count as a DM chat:**
- Character creation wizard steps
- Codex / Smithy / Realms browsing
- Generator runs (Quick Forge, Realms generate, per-section regenerate)
- Tutorial-only pre-canned narration steps with no player message (splash, graduation modal)
- Account signup, password reset, billing pages
- `/skip` time-jump or meta "talk to GM" overrides that do not advance play

**Behavior:**
- Counter is **per account, lifetime** on the free tier (does not reset monthly unless a paid plan explicitly includes a monthly DM allowance — TBD at pricing lock).
- At **0 remaining**, starting or continuing campaign play prompts upgrade (closed beta validates copy and conversion).
- **Closed alpha** cohort is unpaid and may use unlimited internal chats (no Stripe); counter logic can ship in beta without charging alpha users.

**Rationale:** Aligns trial with the wedge (AI-GM play), not library/generator tooling. Ten chats ≈ one short session or two micro-sessions — enough to hit a check, a scene, and optionally combat without giving away full worldbuilding spend.

### 5.2 Beta stages

| Stage | Audience | Paid? | 10 free DM chats | Tutorial |
|---|---|---|---|---|
| **Closed alpha** | 10–50 hand-picked (D&D-adjacent communities, friends) | No | N/A (unlimited for testing) | Optional / WIP OK |
| **Closed beta** | 100–300 waitlist | Yes — billing live in test mode | Enforced | Must pass E2E internally; cohort tutorial completion ≥ 40% |
| **Open beta** | Public signup | Yes | Enforced | Mandatory first-run path (skip still allowed per tutorial spec) |
| **GA** | Public + marketing | Yes | Enforced | ≥ 60% tutorial completion target (product metric) |

**Invite mechanics (alpha):** Single-use invite codes; no public signup URL until open beta.

**What closed beta validates:** LLM cost per session ($0.50–$3 band), tool-adherence under real load, free-trial → paid conversion, and support load for a solo maintainer.

### 5.3 Still open (product-layer)

- **Price points** — flat-rate (e.g., $15/mo) vs usage-based (per-session / per-token) vs hybrid above the 10-chat allowance. Lock before closed beta billing goes live.
- **Paid-plan DM allowance** — unlimited vs monthly cap vs usage-metered above included chats.

---

*This document is the home for product-layer concerns. If you're writing a feature spec, put it in `ui-flows/` or `generators/forms-and-pages.md`. If you're writing a technical spec, put it in `engine/architecture.md` or `01-tech-stack.md`. Sequencing: `docs/02-implementation-roadmap.md`.*
