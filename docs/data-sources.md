# Data Sources & External Services

*External content, libraries, and services that Loreforge depends on at runtime. This document is the counterpart to [`./01-tech-stack.md`](./01-tech-stack.md), which covers the application stack itself. Six sections cover: SRD content ingest, procedural map libraries, the art generation pipeline, TTS providers, LLM providers, and the embeddings + RAG layer.*

> **Versioning**: provider model names (e.g., `claude-sonnet-4-5`, `gpt-4o`) drift faster than this document. Treat any specific model name below as a snapshot of the **current pick at decision time** — the operational model registry lives in code (`@app/llm/providers.ts` or similar) and is the source of truth.
>
> **Failure posture**: every external service has a documented fallback or graceful-degradation path. The product must remain usable when any single provider is down.
>
> **Status conventions**: locked decisions are marked **Locked**. Items still open are marked **Open**. Items deferred to v1.5+ are marked **v1.5+**.

---

## 1. SRD Content Ingest

**Status**: Hybrid — Locked.

The product runs on the 5E SRD 5.2 (System Reference Document). We need every species, class, subclass, background, spell, item, monster, feat, condition, and rule available as structured data for the Codex, the Creation Wizard, the engine's spell registry, and the AI-GM's grounding context.

### Phase 1 — Open5e + 5e-bits APIs (v0.1 through v1.0)

For the initial build, we ingest from two community-maintained, free, API-accessible SRD sources:

- **[Open5e](https://open5e.com/)** — REST + GraphQL API; comprehensive SRD 5.1 coverage with searchable, filterable endpoints for spells, monsters, classes, races, and rules. Self-describing JSON output.
- **[5e-bits / D&D 5e API](https://www.dnd5eapi.co/)** — REST API with strict SRD scoping; simpler shape than Open5e, well-documented, MIT-licensed source.

The two are complementary: 5e-bits has cleaner mechanical data for spells and monsters; Open5e has richer descriptive text and better filter parameters. Our ingest pipeline runs nightly (later: on-demand only), normalizes both into our canonical `@app/srd` schema, and persists into Postgres. The normalized schema is what the engine, Codex, and Smithy all consume — we never call these APIs from a hot user request path.

### Phase 2 — Custom SRD 5.2 Parse (v1.x migration target)

The community APIs above are still on SRD 5.1. As SRD 5.2 settles and we want full fidelity (every paragraph, every edge case for spell handlers, every monster trait), we'll migrate to a custom ingest from the official SRD 5.2 source documents. This is a one-time engineering investment: a structured parse of the PDF/markdown release, normalization into the same `@app/srd` schema, and a regression check that no entity from Phase 1 disappears.

The migration is invisible to the rest of the system because the consuming layer only ever sees the normalized schema. We keep both pipelines until parity is verified, then retire the API ingest as a backup.

### Storage & Caching

- Normalized SRD content lives in dedicated Postgres tables (`srd_spells`, `srd_monsters`, `srd_classes`, etc.) with stable IDs we own.
- Codex and Smithy queries hit Postgres directly; no runtime API calls.
- Smithy "Copy from Codex" duplicates an SRD row into the user's `homebrew_*` tables, preserving the original SRD ID as `derived_from`.

### Licensing & Attribution

Both source APIs respect the SRD's Creative Commons / OGL licensing. Loreforge will display SRD attribution in the Codex footer and any exported content (PDF character sheets, JSON exports). When we migrate to direct SRD 5.2 ingest, we follow the upstream license terms as published by Wizards of the Coast / the SRD steward at the time.

### Alternatives Considered

- **Hand-author every SRD entry** — infeasible (hundreds of spells, hundreds of monsters). Quality would be inconsistent.
- **Pay a commercial 5E data provider** — adds cost and licensing complexity for content that's openly available.
- **Scrape D&D Beyond** — TOS violation, and the SRD subset is what we need anyway.

---

## 2. Procedural Map Libraries

**Status**: Locked at the library layer; specific algorithm choices per map type still being tuned.

The product produces three classes of maps procedurally: **regional hex maps** (Region detail page; biome-tinted hex grid with settlement/dungeon pins), **settlement / building / tavern / shop floor plans** (top-down architectural sketches), and **dungeon maps** (Dyson-style line-drawn vector maps). All of them are vector SVG at generation time, rendered through PixiJS for interactive editing in the app.

### Libraries

- **[rot-js](https://github.com/ondras/rot.js)** — A roguelike toolkit. Provides battle-tested dungeon generation algorithms (Digger, Uniform, Rogue) that we adapt for our 5E-room-keying flow. Also includes pathfinding and FOV (field-of-view) utilities we use for fog-of-war computation on tactical maps.
- **[honeycomb-grid](https://github.com/flauwekeul/honeycomb)** — Pure-TypeScript hex grid math. Coordinate conversion (axial / cube / offset), neighbor calculation, range queries, line drawing. Underpins the regional hex map and the Region travel hex overlay.
- **[d3-voronoi](https://github.com/d3/d3-voronoi)** (or the newer `d3-delaunay`) — Voronoi diagrams for biome region generation, settlement district outlines, and territory boundaries on Faction influence maps. Combines naturally with rot-js noise functions for biome-tinted regions.
- **Custom Watabou-style ports** — [Watabou](https://watabou.itch.io/) publishes well-known procedural town and dungeon generators (Medieval Fantasy City Generator, One Page Dungeon, etc.). We're not using his hosted tools, but several open-source ports and reimplementations of his algorithms exist (procedural city block layout, Lloyd-relaxed Voronoi for districts). We'll port or reimplement the specific algorithms we need under MIT-compatible licensing, keeping the visual style as a target.

### Pipeline

For each generator output that includes a map:
1. The generator's structured output (number of rooms, district count, biome distribution, etc.) is the input.
2. A pure-function map builder (deterministic given a seed) produces a vector representation (rooms as polygons, walls as line segments, pins as labeled points).
3. The vector representation is persisted with the entity (so re-renders are stable; user edits diff against the deterministic baseline).
4. PixiJS renders the vector into the interactive canvas, with layers for fog-of-war, tokens, and overlays.

Every map ships with a `seed` so users can re-roll the layout while preserving the keyed content (room descriptions, NPCs, treasure). This is the same pattern as the rest of the generators.

### AI-Styled Maps (v1.5+)

A long-term goal is to overlay AI-generated artistic styling on top of the procedural geometry (a Dyson-style ink wash, a Watabou-painted town, a Skyrim-style regional map). This is gated to v1.5+ because (a) it depends on the art pipeline below being mature, and (b) image-to-image models that respect a vector underlay are still maturing. The procedural geometry is the source of truth either way; the AI styling is a render layer.

### Alternatives Considered

- **Buy commercial map assets / generators** — expensive, doesn't compose with our entity model.
- **Render maps as static PNGs at generation time** — loses interactivity, can't add fog-of-war or tokens.
- **Use Three.js for 3D maps** — over-scoped; 2D top-down is the 5E convention and what users expect.
- **Mapbox or Leaflet** — designed for real-world geo maps; the math doesn't fit fantasy worldbuilding.

---

## 3. Art Generation Pipeline

**Status**: Hybrid pipeline locked (per consolidated plan Q16); AI on-demand generation deferred to **v1.5+**.

Every Realms entity gets a token, portrait, or map at creation time. The locked v1 approach is a three-tier hybrid:

1. **Curated default library** (v1, **Locked**) — A hand-curated library of token art, portrait art, and entity badge art bundled with the app. Categorized by species, class, role, and tone. Default for every newly-generated entity; the user never sees a "missing art" placeholder. Asset count target: 200-400 portraits, 100-200 tokens, 50-100 entity badges.
2. **User upload** (v1, **Locked**) — Every entity art slot accepts a user-uploaded image. The upload pipeline runs through standard image transforms (crop, resize, format normalization) and stores in object storage (Supabase Storage or equivalent).
3. **AI generation on-demand** (**v1.5+**) — User clicks "regenerate" on an art slot; backend dispatches a prompt to an image model and streams the result. Locked decision (Q16) is to defer this to v1.5+ so the v1 launch isn't gated on prompt engineering and content-moderation work.

### AI Providers (when v1.5+ unlocks)

- **Black Forest Labs Flux (Flux.1 [pro] / [dev])** — Strong on illustrated fantasy aesthetics, controllable style transfer, available via API. Likely primary.
- **OpenAI DALL-E 3** — Strong on prompt adherence and safety filtering, reliable API. Likely fallback or secondary stylistic option.
- **Stable Diffusion XL via Replicate or fal.ai** — Cheapest option, broader style range with LoRAs, but more moderation work on our side.

### Campaign Art Style Lock

Per the consolidated plan, each campaign has an **art style lock** (painterly ink / pencil sketch / hand-painted / cartographic / etc.) chosen at campaign creation. Every art generation in that campaign — token, portrait, map, faction crest — uses the locked style. This prevents the visual chaos of mixing styles within one game and keeps generated content cohesive.

The style lock is implemented as a base prompt prefix and a small style-image reference attached to every generation request.

### Content Moderation (when v1.5+ unlocks)

AI image generation requires moderation: prompts pre-filtered for disallowed content, outputs post-checked via the provider's safety API plus a lightweight NSFW classifier. The campaign-level "adult content" flag (default off) determines the moderation threshold. Generation requests blocked by moderation fall back to the curated library asset with a quiet UI notification.

### Alternatives Considered

- **Skip the curated library, go straight to AI** — too risky for v1 launch (cold-start cost, latency, moderation, content variability).
- **Allow only user uploads** — bad first-run experience; users want to start playing immediately.
- **Use Midjourney** — no programmatic API at decision time.

---

## 4. TTS (Text-to-Speech)

**Status**: Locked providers; per-NPC voice mapping flow locked; off by default.

The AI-GM optionally narrates with synthesized voice. Per consolidated plan Q18, TTS is **off by default** (user opts in per campaign or per NPC), with voice selection per NPC.

### Providers

- **[ElevenLabs](https://elevenlabs.io/)** — Primary. Best-in-class voice quality for narrative work, voice cloning support (locked away behind extra approval gates for safety), streaming API for low-latency playback. Pay-per-character.
- **[OpenAI TTS](https://platform.openai.com/docs/guides/text-to-speech)** — Fallback. Lower quality than ElevenLabs, but cheaper, and we already integrate OpenAI for other reasons (embeddings, LLM fallback). Useful when ElevenLabs is rate-limited or budget-capped.

### Flow

- Each NPC entity has a `voice_id` field that maps to one of N curated ElevenLabs preset voices (we ship ~20-30 preset voices across vocal ranges, age, accent, gender).
- Users can change an NPC's voice from the NPC detail page; the change applies to all future generations for that NPC.
- During live play, every AI message tagged as a specific NPC's dialogue is queued through the TTS pipeline. The audio streams back over the same WebSocket as the text, played client-side via the Web Audio API.
- For purely narrative GM voice (not in-character), a default "narrator" voice is used.

### Cost & Budget Controls

TTS is the most expensive recurring cost per active campaign. Mitigations:
- **Per-campaign monthly TTS budget** with a UI indicator and a soft cap (auto-falls-back to OpenAI when ElevenLabs budget exceeded).
- **Cache TTS audio per (text, voice) pair** — repeat narration of the same line costs nothing.
- **Pre-generate** TTS for known-canonical lines (tutorial narration, common system messages).

### Alternatives Considered

- **Browser-native Web Speech API** — free, but quality is poor and consistency across browsers is unreliable.
- **Azure / Google Cloud TTS** — solid, but neural voices are less expressive than ElevenLabs for narrative work.
- **Self-hosted Coqui TTS / XTTS-v2** — viable for power-users (cost goes to compute, not per-char), but adds GPU infra burden we don't want pre-launch. Revisit if ElevenLabs cost becomes a blocker.

---

## 5. LLM Providers

**Status**: Locked — Anthropic Claude primary, OpenAI fallback. **Partially implemented (Jun 2026):** Anthropic is live for the Realms generators via the `@app/llm` package (see `01-tech-stack.md` §14 "LLM generation package"). The OpenAI fallback is a provider seam, not yet wired (`docs/deferrals.md` GEN-3). AI-GM in-play turns, dialogue, and recaps are not yet built (P4/P5).

The LLM is the single largest operational cost and the single largest quality lever in the product. Every AI-GM turn, every generator output, every NPC dialogue line, every session recap routes through an LLM call.

> **Implemented today:** generator calls go through `@app/llm` with **forced `emit_entity` tool use** (schema derived from per-type zod), **server-side re-validation** (`parseData`) and ~2× validate-and-retry, an **injectable fake client** for tests, and a **`generation_events` audit row per run** (model, token usage, cost estimate, status) for cost observability. `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) is env-gated in `@app/config`.

### Providers

- **[Anthropic Claude](https://www.anthropic.com/api)** — Primary. We use **Claude Sonnet** as the default model for almost everything (AI-GM in-game responses, generators, dialogue, recaps). We use **Claude Opus** (or the largest available Anthropic model) for the highest-stakes calls: campaign-level secret generation, multi-entity cascade resolution, dungeon generation, tutorial narration polish.
- **[OpenAI](https://platform.openai.com/)** — Fallback. **GPT-4o** (or current flagship) is the equivalent fallback model when Anthropic is rate-limited, unavailable, or for users who explicitly prefer the OpenAI voice/style. We also use OpenAI for embeddings (see §6).

### Why this split

Claude's instruction-following, long-context handling, and prose quality consistently win on creative narrative tasks at the time of decision. OpenAI is reliable, ubiquitous, has the broader tool-use ecosystem, and historically has had better availability at peak. Having both in the orchestrator means we can fail over without user-visible degradation and we can A/B model choices per surface as new models ship.

### Tool-Use Surface

Both providers expose function-calling / tool-use APIs that we use heavily. The orchestrator sends the engine's tool surface (every `Command` from [`./engine/architecture.md`](./engine/architecture.md) §4 expressed as a JSON-schema function) along with the engine state and chat context. The LLM responds with either prose or a structured tool call; tool calls route to the engine, which validates and executes; the result feeds back into the LLM for narration.

### Prompt Management

- **Versioned prompts** stored in the repo (`@app/prompts/`); every prompt change ships as a code change with a PR.
- **Per-surface system prompts**: AI-GM (live play), Generator (with type-specific variants), Recap Writer, NPC Persona, etc.
- **A/B harness** for evaluating prompt changes against a fixture set of scenarios before rollout.

### Cost & Budget Controls

- **Per-campaign monthly LLM budget** with soft caps and user-visible spend.
- **Context window discipline** — the engine state JSON is kept under ~4KB; we use the multi-tier memory architecture (engine state + hot chat + rolling summaries + RAG retrieval) to keep total prompt size well below model limits.
- **Streaming** wherever possible — the Live Play Surface streams every AI-GM message token-by-token for perceived responsiveness.
- **Caching** common system prompts via Anthropic's prompt caching feature when the prompt prefix repeats across many calls.

### Privacy

LLM calls send campaign content (chat history, NPC details, character state) to the provider. We use API endpoints (not consumer apps), which under Anthropic's and OpenAI's API terms do not train on the data. We disclose this in our privacy policy. No user content is shared across campaigns or across users.

### Alternatives Considered

- **Google Gemini** — viable, but at decision time Anthropic and OpenAI cover our needs and adding a third provider triples the prompt-tuning surface. Revisit when Gemini's tool-use story matures.
- **Self-hosted Llama / Mistral** — interesting for cost, but quality on long-context creative GM work isn't there yet at the model sizes we could affordably host.
- **xAI Grok** — not yet evaluated.

---

## 6. Embeddings & RAG

**Status**: Locked — OpenAI embeddings, pgvector storage, retrieval at every relevant LLM call.

Retrieval-Augmented Generation (RAG) is how the AI-GM stays grounded in everything the player has built or experienced. Every NPC detail, plot hook, session recap, journal entry, pinned memory, and Realms entity gets embedded; relevant chunks are retrieved at LLM call time and added to the prompt.

### Embedding Model

- **[OpenAI `text-embedding-3-small`](https://platform.openai.com/docs/guides/embeddings)** for the default embedding model. 1536 dimensions, $0.02/1M tokens, fast.
- Upgrade path to `text-embedding-3-large` (3072 dimensions, higher quality) if retrieval quality measurements warrant it.

### Storage

`pgvector` columns on Postgres tables. Each embeddable entity (Realms NPC, Realms location, session message, session recap, pinned memory, journal entry, plot hook) has an `embedding vector(1536)` column with an HNSW index. Queries use cosine similarity.

We chose pgvector over a dedicated vector DB (Pinecone, Weaviate, Qdrant) because: (a) the data already lives in Postgres, (b) we can JOIN vector retrieval against relational filters ("most-similar pinned memories from this campaign that mention this NPC"), (c) one less ops surface. Per [`./01-tech-stack.md`](./01-tech-stack.md) §6, if scale ever forces a split, the abstraction layer makes the swap manageable.

### Retrieval Pipeline

Every AI-GM call constructs its prompt context as:

1. **Engine state JSON** (compact, always included; ~2-4KB) — see [`./engine/architecture.md`](./engine/architecture.md) §12.
2. **Hot chat context** — last N exchanges in the current session, verbatim.
3. **Rolling session summary** — periodically-regenerated condensed summary of the current session (~500 tokens).
4. **RAG retrieval** — top-k similar chunks from:
   - This campaign's past session recaps
   - This campaign's pinned memories
   - Realms entities linked to this campaign (NPCs, locations, factions, plot hooks)
5. **System prompt** — GM persona + SRD rule reminders + tool surface.

Retrieval k typically 4-8 per source category, with reranking based on recency, pinning status, and explicit cross-link relevance.

### Chunk Strategy

- **NPCs and locations**: one chunk per entity, embedding the short description + name + key facts. Detail pages are too long for a single embedding; we either chunk them or embed only the summary fields.
- **Session messages**: not embedded individually; the rolling session summary handles intra-session retrieval. Past sessions are embedded as full recap documents (typically <2K tokens each).
- **Pinned memories**: one chunk per pinned fact (they're already short, by user design).
- **Plot hooks**: one chunk per hook, including status and description.

### Re-embedding & Drift

When an entity is significantly edited (auto-detected by diff length), we re-embed on the next background pass. Embeddings refresh nightly for any entity that changed; pinned memories refresh immediately on change since they're user-curated and high-stakes.

### Alternatives Considered

- **Cohere Embed v3** — competitive quality, slightly better multilingual; we'll stay on OpenAI for ecosystem consistency and the existing API account.
- **Local embedding models (BGE, e5)** — viable for cost optimization later, but the latency/quality of hosted models wins at our scale.
- **Skipping RAG and relying on long context alone** — works for short campaigns, breaks down at 50+ sessions; RAG is what makes long campaigns coherent.

---

## 7. Cross-Cutting: Operational Concerns

- **Provider keys**: every external provider's API key lives in the platform secret manager (Vercel env vars / Supabase secrets). Never in the repo, never in client bundles. The frontend talks to our backend; the backend talks to providers.
- **Rate-limit handling**: every provider integration includes retry-with-exponential-backoff, per-user rate limiting at our edge to prevent abuse, and circuit breaker that surfaces a graceful UI message when a provider is down.
- **Cost telemetry**: every provider call emits a structured log including campaign ID, surface (AI-GM / generator / TTS / etc.), tokens or characters used, and dollar cost. Aggregated in PostHog and surfaced in an internal admin dashboard.
- **PII**: minimal PII reaches providers. Character names, dialogue, world content — yes; user emails, payment info, real names — no.
- **Provider deprecation**: when a provider deprecates a model or endpoint, the orchestrator's model registry shifts to the replacement and a PR notes the change. We avoid hard-coding model strings outside the registry.

---

That's the data sources surface. The application-stack counterpart lives in [`./01-tech-stack.md`](./01-tech-stack.md); the engine that consumes most of these (especially LLM tool calls and embeddings) lives in [`./engine/architecture.md`](./engine/architecture.md).
