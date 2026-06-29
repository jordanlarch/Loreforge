# Deterministic Engine & Spell Automation Architecture

*The mechanical heart of the AI-GM. A code-side 5E rules engine that owns ALL mechanical state; the LLM proposes actions via structured tool calls and owns prose; the engine validates, executes, and emits events. This document covers data model, event-sourcing, tool surface, effect system, spell automation, concurrency, retcon, and a phased implementation plan.*

> **As-built vs proposed (Jun 2026).** This doc mixes the **shipped** engine with **design proposals** that were scoped down for v1.0 (per §16, which is locked). Quick map so readers don't mistake aspiration for reality:
>
> | Section | Status | As-built location |
> |---|---|---|
> | §2 architecture, §4 command/event API | **Built** | `packages/engine/src/commands/handlers.ts`, typed `Command` union, `CommandResult` |
> | Event-sourcing + projection | **Built** | `EventStore` / `InMemoryEventStore` / `PgEventStore` (`packages/db/src/engine/pg-event-store.ts`); `engine_events`; `projections/world-state.ts` |
> | §3.2 `WorldState` shape | **Partial** — slimmer than doc | built projection = `entities` + `scenes` + optional `encounter`; per-entity `effects[]` (no global `characters`/`npcs`/`fogOfWar`/`partyTime`) |
> | §6 full effect/modifier pipeline | **Proposal** — tracer subset only | `combat/effects.ts` `ActiveEffect` (Bless/Shield/Hunter's Mark/Blur/Faerie Fire); no full `Modifier[]`/auras/stacking engine |
> | §7.1–7.4 `onCast` handler registry + per-file `engine/spells/srd/*.ts` | **Proposal — not built** | declarative `SpellDefinition` in `content/spells.ts` + merged `spell-registry.ts` (Open5e catalog + **126** hand-authored overrides); special cases are **inline branches** in `handlers.ts`, not a registry |
> | §1 "~360 spells automated" goal vs §16 top-120 | **Reconcile** | v1.0 = **top-120 declarative curation done**; full ~360 is the product target (catalog has 339 lookup entries, 126 combat-authored) |
> | §3.3 snapshots, §11 retcon UI, §13 QuickJS homebrew sandbox | **Proposal — not built** | tables may exist but no hydrate/retcon/sandbox path; retcon truncate is test-only |
> | §5.3 declarative reaction registry | **Partial** | `ReactionWindowOpened` + OA/Counterspell paths shipped (`engine.reactions.test.ts`); not the full declarative `ReactionTrigger` registry |
> | §14 test targets / §16 calendar | **Superseded** | shipped ahead of the calendar; live status in `docs/deferrals.md` |
>
> When a section conflicts with the table above, the table (and the cited code) wins.

---

## 1. Goals & Non-Goals

### Goals

- **Single source of truth** for every mechanical fact: HP, AC, position, slots, conditions, action economy, ability scores, resources, durations, concentration, initiative, currency, inventory.
- **Determinism**: same inputs → same outputs. No LLM in the math path. All randomness via server-side cryptographic RNG with persisted seeds.
- **Validation-first**: every action checked for legality (range, line-of-sight, action economy, slot availability, concentration interruption, condition restrictions) before execution. Illegal actions rejected with structured reasons.
- **Event-sourced**: every state mutation = an immutable event. Full replay, full retcon, full audit log for free.
- **Sync-friendly**: state mutations broadcast deterministically; all clients converge.
- **SRD 5.2 fidelity**: ~360 spells, ~330 monsters, all SRD conditions/skills/saves/feats/class features automated.
- **Smithy-extensible**: homebrew spells/monsters/items/feats use the same schema and run through the same pipeline.
- **Performant**: P50 action resolution ≤ 50ms (engine), P95 ≤ 150ms; spell resolution ≤ 200ms for complex AoE.

### Non-Goals (v1)

- 3D / line-of-sight in three dimensions (2D only)
- Optional rules from outside SRD 5.2 (variant rules, encumbrance variants — gated by setting if added)
- Real-time animation interpolation (engine ticks; UI animates from state diffs)
- Mid-flight spell modification by LLM (LLM picks a spell + targets; engine executes)
- Combat AI tactical optimization (NPC tactics is a *separate* layer — see §7.6)

---

## 2. High-Level Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │                  UI CLIENTS                    │
                  │  (Next.js + PixiJS map + chat + sheet HUD)    │
                  │     - subscribe to projected state             │
                  │     - dispatch player actions (typed)          │
                  └─────────────┬──────────────────┬──────────────┘
                                │                  │
                       Yjs CRDT/WS                tRPC (typed RPC)
                                │                  │
                  ┌─────────────▼──────────────────▼──────────────┐
                  │              AI ORCHESTRATOR                   │
                  │  (LLM call manager + tool dispatcher + memory) │
                  │     - calls Engine via tool API                │
                  │     - reads projected state for LLM context    │
                  │     - never mutates state directly             │
                  └─────────────┬──────────────────────────────────┘
                                │
                                │  proposes Commands via Tool API
                                ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                     5E DETERMINISTIC ENGINE                         │
  │                                                                      │
  │  ┌────────────────┐   ┌──────────────┐   ┌──────────────────┐     │
  │  │ Command API    │──▶│  Validators  │──▶│  Effect Executor │     │
  │  │ (tool schemas) │   │  (legality)  │   │  (state mutations│     │
  │  └────────────────┘   └──────────────┘   └────────┬─────────┘     │
  │                                                     │               │
  │  ┌────────────────────────────────────────────────────▼──────┐     │
  │  │           EVENT STORE (append-only log)                    │     │
  │  │   { id, campaignId, sceneId, encounterId?, type, payload, │     │
  │  │     timestamp, actor, causedByCommandId, version }         │     │
  │  └─────────────────────────┬──────────────────────────────────┘     │
  │                            │                                         │
  │  ┌─────────────────────────▼──────────────────────────────────┐    │
  │  │           PROJECTIONS (read models, materialized)          │    │
  │  │   - WorldState (canonical)                                  │    │
  │  │   - CombatantState (per encounter)                          │    │
  │  │   - InitiativeOrder                                         │    │
  │  │   - ActiveEffects (timed, concentration-bound)              │    │
  │  │   - InventoryState                                          │    │
  │  │   - FogOfWar                                                │    │
  │  └─────────────────────────────────────────────────────────────┘    │
  │                                                                      │
  │  ┌────────────────────────────────────────────────────────────┐    │
  │  │           RULES MODULES (pure functions)                    │    │
  │  │   - Dice    - Conditions  - Spells  - Attacks   - Saves    │    │
  │  │   - Movement- Resources   - Rests   - Initiative- Damage   │    │
  │  └─────────────────────────────────────────────────────────────┘    │
  └────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                                 Postgres (Drizzle ORM)
                                 + pgvector (RAG memory)
```

### Module Boundary

The engine is a single Node package (`@app/engine`) imported by:
- The **AI Orchestrator** (calls Commands as the LLM proposes them)
- The **tRPC server** (UI dispatches player actions through the same Command surface)
- The **sync server** (Yjs document is hydrated from projections)
- The **test harness** (unit + golden tests)

No engine logic lives in the frontend. The frontend is a pure subscriber.

### Why Event-Sourcing

1. **Retcon is free**: rewind to event N, branch, replay forward
2. **Audit is free**: every action has an immutable record
3. **Multiplayer sync is easier**: events broadcast as deltas; clients project them
4. **Bug forensics**: any state anomaly traces back to the exact command
5. **Replay sessions**: a session is a sequence of events; visualization tools can play it back

---

## 3. State Model

### 3.1 The Event Log

```ts
type EngineEvent =
  | DiceRolledEvent
  | AttackResolvedEvent
  | SaveRolledEvent
  | DamageDealtEvent
  | HealingAppliedEvent
  | ConditionAppliedEvent
  | ConditionRemovedEvent
  | EffectAttachedEvent
  | EffectExpiredEvent
  | ResourceConsumedEvent
  | ResourceRecoveredEvent
  | MovementTakenEvent
  | TurnStartedEvent
  | TurnEndedEvent
  | RoundIncrementedEvent
  | EncounterStartedEvent
  | EncounterEndedEvent
  | SceneChangedEvent
  | TimeAdvancedEvent
  | EntityRevealedEvent
  | StubCreatedEvent
  | InventoryChangedEvent
  | CurrencyChangedEvent
  | XpAwardedEvent
  | HookStatusChangedEvent
  | ConcentrationBrokenEvent
  // ... ~50 event types total

type BaseEvent = {
  id: string                    // ULID, sortable
  campaignId: string
  sessionId: string
  sceneId: string
  encounterId?: string
  timestamp: number             // server epoch ms
  actor?: EntityRef             // who caused this (PC, NPC, AI, system)
  causedByCommandId: string     // links to the Command that triggered it
  version: number               // schema version of this event type
}
```

### 3.2 Projections (Read Models)

Projections are pure derivations from the event log. Cached in memory for hot reads; recomputable on demand.

```ts
type WorldState = {
  campaignId: string
  characters: Record<CharacterId, CharacterState>     // PCs + NPC followers
  npcs: Record<NpcId, NpcState>
  monsters: Record<MonsterInstanceId, MonsterState>    // instances in scenes
  scenes: Record<SceneId, SceneState>
  currentSceneId: SceneId
  encounters: Record<EncounterId, EncounterState>
  activeEncounterId?: EncounterId
  inventory: Record<EntityRef, InventoryState>
  effects: ActiveEffect[]                              // all in-flight effects
  partyTime: GameTime
  fogOfWar: Record<MapId, FogState>
  revealedRealms: Record<EntityRef, RevealScope>
}

type CharacterState = {
  id: CharacterId
  name: string
  classes: ClassLevel[]               // multiclass support
  species: SpeciesRef
  abilityScores: AbilityScores
  hp: { current: number, max: number, temp: number }
  ac: ComputedAc                       // derived from armor + dex + effects
  speed: ComputedSpeed
  initiative?: number                  // when in encounter
  position?: GridPosition              // when on a map
  conditions: ConditionInstance[]
  spellSlots: SpellSlotState
  resources: ResourceState              // class-specific resources
  proficiencies: Proficiencies
  features: FeatureRef[]
  inventory: InventoryRef
  concentration?: ConcentrationRef     // what spell, if any
  actionEconomy: ActionEconomyState    // when in encounter
  deathSaves?: { successes: number, failures: number }
  exhaustion: number                   // 0-6
}

type ComputedAc = {
  base: number
  bonuses: { source: string, amount: number }[]
  total: number
}
```

Projections are recomputed when:
- A new event is appended (incremental projection update)
- A retcon truncates the event log (full recompute from genesis)
- The server boots (hydrate from snapshot + incremental tail)

**Snapshots**: every 1,000 events or every session-end, a snapshot of the projection is persisted; restart loads snapshot + replays the tail.

### 3.3 Persistence

```
Tables (Postgres via Drizzle):
- engine_events       (id PK, campaign_id, session_id, type, payload JSONB, ...)
- engine_snapshots    (campaign_id, snapshot_at_event_id, state JSONB, ...)
- engine_command_log  (id PK, campaign_id, command_type, payload, accepted, rejection_reason, events_produced[])
- engine_seeds        (campaign_id, scope, seed) -- deterministic RNG seeds
```

The Command Log is separate from the Event Log: a Command may produce 0 (rejected) or N events.

---

## 4. Command API (LLM Tool Surface + UI Action Surface)

The same typed Command set drives both:
- **LLM tool calls** (AI proposes via OpenAI/Anthropic tool-use API)
- **UI actions** (player clicks `[Attack]`, drags a token, etc.)

This is *crucial*: the player and the AI go through the same gate. Equal validation. Equal events.

### 4.1 Command Types (sample, not exhaustive)

```ts
type Command =
  // Dice & checks
  | RollDiceCommand
  | RequestCheckCommand        // GM asks player to roll
  | ResolveCheckCommand        // Player submits result
  | RequestSaveCommand
  | ResolveSaveCommand
  // Combat actions
  | AttackCommand
  | CastSpellCommand
  | UseAbilityCommand
  | UseItemCommand
  | DodgeCommand
  | DashCommand
  | DisengageCommand
  | HideCommand
  | HelpCommand
  | ReadyCommand
  | SearchCommand
  | InteractWithObjectCommand
  // Movement
  | MoveCommand
  | TeleportCommand
  // Effects
  | ApplyConditionCommand
  | RemoveConditionCommand
  | ApplyEffectCommand          // arbitrary modifier
  | DispelEffectCommand
  | EndConcentrationCommand
  // Reactions
  | TriggerReactionCommand
  | ResolveReactionCommand
  // Turn / encounter
  | StartEncounterCommand
  | EndEncounterCommand
  | RollInitiativeCommand
  | StartTurnCommand
  | EndTurnCommand
  // Scene / world
  | ChangeSceneCommand
  | AdvanceTimeCommand
  | TakeRestCommand              // short / long
  | RevealEntityCommand
  | RevealAreaCommand            // fog of war
  // Resources
  | AwardXpCommand
  | AwardLootCommand
  | TransferItemCommand
  | AdjustCurrencyCommand
  // Meta
  | CreateStubEntityCommand      // cascading auto-creation
  | UpdateHookStatusCommand
  | PinMemoryCommand
```

### 4.2 Command Schema (worked example)

```ts
type AttackCommand = {
  type: 'attack'
  actor: EntityRef               // who's attacking
  target: EntityRef              // who's being attacked
  weapon: WeaponRef              // what they're attacking with
  modifiers?: {
    advantage?: boolean
    disadvantage?: boolean
    bonusToHit?: number
    bonusDamage?: { dice?: string, flat?: number, type?: DamageType }[]
    cover?: 'none' | 'half' | 'three-quarters' | 'full'
  }
  metadata?: {
    sourceCommandId?: string      // for AI traceability
    narrationHint?: string        // 'a desperate, off-balance swing'
  }
}
```

### 4.3 Tool Schema Surfaced to LLM

The LLM sees a clean JSON-schema version of every command. Example:

```json
{
  "name": "attack",
  "description": "Resolve an attack from one combatant against another. The engine handles to-hit, damage, resistance, critical hits, conditional effects, and ammunition. Returns the structured outcome which you should narrate in prose.",
  "input_schema": {
    "type": "object",
    "required": ["actor", "target", "weapon"],
    "properties": {
      "actor":   { "$ref": "#/defs/EntityRef" },
      "target":  { "$ref": "#/defs/EntityRef" },
      "weapon":  { "$ref": "#/defs/WeaponRef" },
      "advantage": { "type": "boolean" },
      "disadvantage": { "type": "boolean" },
      "cover": { "enum": ["none", "half", "three-quarters", "full"] },
      "narration_hint": { "type": "string" }
    }
  }
}
```

The orchestrator validates the LLM's tool-call JSON against the schema BEFORE dispatching to the engine; malformed tool calls are rejected with a structured error fed back to the LLM ("invalid weapon reference; the actor is not holding 'longsword'").

### 4.4 Command Result

Every Command returns:

```ts
type CommandResult =
  | { accepted: true, events: EngineEvent[], summary: CommandSummary }
  | { accepted: false, reason: ValidationFailure, suggestions?: Suggestion[] }

type CommandSummary = {
  // Compact human-readable + machine-parseable summary fed back to LLM
  // e.g. for an attack: { hit: true, crit: false, damage: 8, damageType: 'slashing',
  //                       targetHpAfter: 33, conditionsAdded: [], reactionsTriggered: [] }
}

type ValidationFailure = {
  code: 'OUT_OF_RANGE' | 'NO_SLOT_AVAILABLE' | 'ACTION_ECONOMY_EXCEEDED'
      | 'CONCENTRATION_REQUIRED' | 'INVALID_TARGET' | 'NOT_ON_TURN' | ...
  message: string                  // human-readable
  detail?: Record<string, unknown> // structured detail for AI to course-correct
}
```

The summary is what gets fed back into the LLM context for narration. The LLM never sees raw events; it sees a clean structured outcome.

---

## 5. Action Economy & Combat Loop

### 5.1 Action Economy State

```ts
type ActionEconomyState = {
  turnInProgress: boolean
  action: ResourceAvailability         // primary action
  bonusAction: ResourceAvailability
  reaction: ResourceAvailability       // reset at start of own turn
  movement: { used: number, total: number }
  freeInteractionUsed: boolean         // one free object interaction per turn
}

type ResourceAvailability =
  | { state: 'available' }
  | { state: 'used', usedBy: CommandRef, at: EventId }
  | { state: 'lost', reason: string }  // e.g. stunned
```

Every combat-relevant Command **debits** the appropriate resource and rejects if unavailable:

```
Cast Fireball (action spell, 1 spell slot 3rd)
  ⇒ Validators:
     - On own turn? ✓
     - Action available? ✓        → reserve action
     - Slot 3+ available? ✓      → reserve slot
     - Concentration interrupt?   → no (Fireball is instantaneous)
     - Targets in range? ✓ (150ft from caster)
     - Targets in AoE (20ft radius)?  → engine computes
     - Components available?      → ✓ (V, S, M — has component pouch)
  ⇒ Execute:
     - For each target in AoE:
        - DEX save vs DC 14
        - Half damage on save
        - 8d6 fire damage (rolled once, applied per target)
        - Apply resistance/vulnerability
        - Ignite flammable objects
     - Emit: SaveRolledEvent (per target), DamageDealtEvent (per target), ResourceConsumedEvent (slot)
     - Update action economy
```

### 5.2 Turn Lifecycle

```
StartTurnCommand
   ↓
   emit TurnStartedEvent(actor)
   reset action economy (action, bonus, movement; reaction resets here too)
   trigger "start of turn" effects (regeneration, ongoing damage, condition checks)
     - Poisoned: no effect on turn start
     - Concentrating: no save unless damaged
     - On Fire: 1d4 fire damage at start of turn
     - Bardic Inspiration aura: refresh
   trigger entity-specific class features (Rage end check, etc.)
   ↓
   [Player or AI submits actions via Commands]
   ↓
EndTurnCommand
   ↓
   emit TurnEndedEvent
   trigger "end of turn" effects
   advance initiative pointer
   if back to top of order: emit RoundIncrementedEvent → trigger "start of round" effects
```

### 5.3 Reactions

Reactions are interrupt-driven. When a triggering event fires, the engine evaluates all active reaction triggers and offers them to eligible actors:

```ts
type ReactionTrigger = {
  id: string
  ownerId: EntityRef
  conditions: ReactionCondition[]      // declarative when to fire
  cost: { reaction: true, slot?: number, charge?: ResourceRef }
  handler: ReactionHandlerRef          // identifier into the reaction registry
}

// Example: a wizard prepared Counterspell
{
  id: 'reaction:counterspell:wiz1',
  ownerId: 'pc:elara',
  conditions: [
    { type: 'event_matches', eventType: 'SpellCastDeclared', source: { not: 'self' } },
    { type: 'within_distance', meters: 60 },
    { type: 'has_line_of_sight' }
  ],
  cost: { reaction: true, slot: 3 },  // upcast for higher counter
  handler: 'counterspell:default'
}
```

When the triggering event fires, the engine:
1. Pauses execution at the trigger point (e.g., spell-cast declared, but not yet resolved)
2. Identifies eligible reactors (conditions met, reaction available, resources available)
3. Emits a `ReactionWindowOpenedEvent` with a timeout
4. UI shows the reaction prompt to the owner (per Live Play Surface §"Reactions")
5. Within timeout, owner accepts/declines
6. If accepted, runs the handler (which may emit more events, e.g., a Counterspell vs caster's CON save vs DC = 10 + slot)
7. Continues original execution (modified per reaction outcome)

This applies to: Opportunity Attacks, Counterspell, Shield, Hellish Rebuke, Cutting Words, Sentinel, Polearm Master, Mage Slayer, every reaction-trigger feature.

### 5.4 Initiative

Initiative is rolled at `RollInitiativeCommand` start of encounter:
- Each combatant rolls d20 + DEX mod + any initiative bonuses (Alert feat, etc.)
- Ties broken by DEX score, then random
- Resulting `InitiativeOrder` projection drives turn progression
- Combatants can `Ready` an action, which queues a delayed action with a trigger condition (engine emits trigger evaluation each round)

---

## 6. Effect System

The single hardest correctness-critical subsystem after spells. Effects are *anything that modifies an entity's state for a duration*: conditions, spell effects, item enchantments, environmental hazards, class features.

### 6.1 Effect Model

```ts
type Effect = {
  id: EffectId
  name: string
  source: {
    type: 'spell' | 'condition' | 'feature' | 'item' | 'environment' | 'homebrew'
    ref: string
    casterId?: EntityRef
  }
  target: EntityRef | { type: 'area', mapId: string, region: GridRegion }
  modifiers: Modifier[]            // structured changes to target's stats
  duration: Duration
  concentration?: { holderId: EntityRef }
  stacksWith?: 'never' | 'self' | 'others' | 'always'
  dispelDC?: number
  visibleTo: VisibilityScope        // for fog/intel
  metadata: { addedAt: EventId }
}

type Modifier =
  | { type: 'ac_bonus',  amount: number, kind: 'enhancement' | 'deflection' | 'natural' | 'untyped' }
  | { type: 'ability_score_set', ability: Ability, value: number }
  | { type: 'ability_score_bonus', ability: Ability, amount: number, kind: 'enhancement' | 'untyped' }
  | { type: 'damage_resistance', damageType: DamageType }
  | { type: 'damage_vulnerability', damageType: DamageType }
  | { type: 'damage_immunity', damageType: DamageType }
  | { type: 'condition_immunity', condition: Condition }
  | { type: 'speed_set', value: number }
  | { type: 'speed_bonus', amount: number }
  | { type: 'attack_bonus', amount: number, scope: AttackScope }
  | { type: 'damage_bonus', dice?: string, flat?: number, scope: AttackScope }
  | { type: 'save_bonus', ability: Ability, amount: number }
  | { type: 'check_bonus', skill: Skill, amount: number }
  | { type: 'advantage', scope: AdvantageScope }
  | { type: 'disadvantage', scope: AdvantageScope }
  | { type: 'override_attack', formula: AttackFormula }
  | { type: 'aura', radius: number, applies: Modifier[] }
  | { type: 'on_damage_taken', handler: HandlerRef }     // reactive
  | { type: 'on_turn_start',   handler: HandlerRef }
  | { type: 'on_turn_end',     handler: HandlerRef }
  | { type: 'replace_action_economy', state: Partial<ActionEconomyState> }  // e.g., Stunned

type Duration =
  | { type: 'instantaneous' }
  | { type: 'rounds', count: number, expires: 'start_of_caster_turn' | 'end_of_caster_turn' | 'next_turn_of_target' }
  | { type: 'minutes', count: number }
  | { type: 'hours', count: number }
  | { type: 'until_dispelled' }
  | { type: 'while_concentrating' }
  | { type: 'until_long_rest' }
  | { type: 'until_short_rest' }
  | { type: 'until_event', event: EventMatcher }       // e.g., 'until you take damage'
```

### 6.2 Stat Resolution Pipeline

When the engine needs to compute "Thorin's current AC," it doesn't look at a stored AC number. It runs a **resolution pipeline**:

```
computeAc(actor):
  1. base = armor.acFormula(actor.dexMod, actor.armor)
  2. for effect in actor.activeEffects.where(type='ac_bonus'):
       apply per stacking rules
  3. for effect in actor.activeEffects.where(type='aura' and inRange):
       apply nested modifiers
  4. apply condition-driven modifiers (Prone gives disadvantage to attackers, etc. — handled at attack-resolution)
  5. return ComputedAc { base, bonuses: [...], total }
```

Same pattern for: AC, attack bonuses, damage rolls, save modifiers, check modifiers, speed, ability scores, HP max.

This guarantees that adding/removing an effect updates all derived stats correctly without manual bookkeeping.

### 6.3 Conditions (SRD set)

Each SRD condition is an `Effect` with predefined modifiers:

```ts
const ConditionDefinitions: Record<Condition, EffectTemplate> = {
  blinded: {
    name: 'Blinded',
    modifiers: [
      { type: 'check_bonus', skill: 'any_sight_based', amount: -Infinity }, // auto-fail
      { type: 'disadvantage', scope: { attackRolls: true } },
      { type: 'advantage', scope: { attacksAgainst: true } }
    ]
  },
  charmed: { ... },
  deafened: { ... },
  frightened: {
    name: 'Frightened',
    modifiers: [
      { type: 'disadvantage', scope: { whenSourceInLineOfSight: true } },
      // movement away from source: enforced in MoveCommand validator
    ]
  },
  grappled: { ... },
  incapacitated: {
    name: 'Incapacitated',
    modifiers: [{ type: 'replace_action_economy', state: { action: { state: 'lost', reason: 'incapacitated' }, reaction: { state: 'lost', reason: 'incapacitated' } } }]
  },
  invisible: { ... },
  paralyzed: { ... },
  petrified: { ... },
  poisoned: { 
    modifiers: [
      { type: 'disadvantage', scope: { attackRolls: true } },
      { type: 'disadvantage', scope: { abilityChecks: true } }
    ] 
  },
  prone: { ... },
  restrained: { ... },
  stunned: { ... },
  unconscious: { ... },
  exhaustion: { /* tiered: 1-6 levels with cumulative penalties */ }
}
```

All conditions go through the same `applyConditionCommand` → `Effect` → resolution pipeline. Removing a condition removes its effect; the resolution pipeline naturally returns to the new value.

### 6.4 Concentration

Each character can hold at most one concentration spell. Engine tracks `ConcentrationRef`:

```ts
type ConcentrationRef = {
  spellId: SpellRef
  slotLevel: number
  effects: EffectId[]                 // effects bound to this concentration
  startedAt: EventId
  durationLeft: Duration
}
```

Triggers that may break concentration:
- Taking damage → CON save vs DC = max(10, damage/2)
- Casting a new concentration spell → automatic break of old
- Being incapacitated / unconscious → automatic break
- Dying → automatic break
- Failing a save explicitly mentioned by the spell

On break: all linked effects are removed via the resolution pipeline.

### 6.5 Stacking Rules

The 5E SRD has subtle stacking rules — most bonuses don't stack with themselves; same-source same-type doesn't stack; different sources do.

Engine enforces:
```ts
type StackingMode = 'never' | 'self' | 'others' | 'always'

function selectActiveModifiers(modifiers: Modifier[]): Modifier[] {
  // Group by (type, kind, source identity)
  // For each group, apply stacking rules:
  // - 'enhancement' kind only takes highest
  // - 'untyped' stacks
  // - same-spell-instance doesn't double-apply
  // - SRD rules: e.g., Bless and Bardic Inspiration both apply (different mechanism)
}
```

Stacking rules per spell are encoded in `SpellDefinition.stackingMode`.

---

## 7. Spell Automation Subsystem

The single largest engineering subproject (~4-6 engineer-months). ~360 SRD 5.2 spells, each needing structured automation.

### 7.1 Design Philosophy

A **declarative spell schema** that covers ~80% of spells cleanly + an **imperative escape hatch** (`onCast` handler) for spells with truly unique behavior (Wish, Polymorph, Counterspell, Reincarnate).

### 7.2 SpellDefinition Schema

```ts
type SpellDefinition = {
  id: string                              // 'fireball'
  name: string
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  school: SpellSchool
  classes: ClassRef[]                     // who can learn it
  source: 'srd-5.2' | 'homebrew'
  
  // Casting
  castingTime: { 
    unit: 'action' | 'bonus' | 'reaction' | 'minutes' | 'hours'
    amount: number
    reactionTrigger?: string              // for reaction spells
  }
  range: { type: 'self' | 'touch' | 'feet' | 'miles' | 'sight' | 'unlimited', amount?: number, area?: AreaShape }
  components: { verbal: boolean, somatic: boolean, material?: { description: string, cost?: number, consumed?: boolean } }
  duration: Duration
  concentration: boolean
  ritual: boolean
  
  // Targeting
  targeting: TargetingRule                // single | multi | area | self
  validTargets: TargetFilter              // creatures | objects | self-only | etc.
  
  // Mechanical effects (declarative)
  saveAgainst?: { ability: Ability, dc: 'spellsave' | number, onSuccess: 'half_damage' | 'no_effect' | 'partial' | EffectModifier }
  attackAgainst?: { type: 'spell_attack_melee' | 'spell_attack_ranged' }
  damage?: DamageRoll[]                   // multiple components possible (e.g., Ice Knife)
  healing?: HealingRoll
  appliesConditions?: ConditionApplication[]
  appliesEffects?: EffectTemplate[]
  upcastScaling?: UpcastRule              // damage dice per slot above base
  
  // Custom logic (escape hatch)
  onCast?: SpellHandlerRef                // for Wish, Polymorph, Simulacrum, etc.
  onTurnStart?: SpellHandlerRef           // ongoing area spells (Spike Growth)
  onTurnEnd?: SpellHandlerRef
  onEnterArea?: SpellHandlerRef           // creatures walking into Cloud of Daggers
  onDispel?: SpellHandlerRef
  
  // Metadata
  description: string                     // full SRD text (for UI display)
  flavorText?: string
  stackingMode: StackingMode
}

type DamageRoll = {
  dice: string                            // '8d6'
  type: DamageType
  bonusModifier?: 'spellcasting' | { ability: Ability }
}

type ConditionApplication = {
  condition: Condition
  duration: Duration
  saveToAvoid?: { ability: Ability, dc: 'spellsave' | number }
  saveToRemove?: { ability: Ability, dc: 'spellsave' | number, frequency: 'each_turn' | 'each_round' | 'when_damaged' }
}

type UpcastRule = 
  | { type: 'damage_dice', perLevel: string }         // Fireball: +1d6 per level
  | { type: 'targets', perLevel: number }              // Magic Missile: +1 dart per level
  | { type: 'duration', perLevel: Duration }
  | { type: 'aoe',  perLevel: number, unit: 'feet' }   // Cloudkill: +5ft radius
  | { type: 'custom', handler: SpellHandlerRef }
```

### 7.3 Worked Examples

#### Example A: Fireball (declarative, ~95% of complex spells)

```ts
const Fireball: SpellDefinition = {
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  classes: ['sorcerer', 'wizard'],
  source: 'srd-5.2',
  
  castingTime: { unit: 'action', amount: 1 },
  range: { type: 'feet', amount: 150, area: { shape: 'sphere', radius: 20 } },
  components: { verbal: true, somatic: true, material: { description: 'tiny ball of bat guano and sulfur' } },
  duration: { type: 'instantaneous' },
  concentration: false,
  ritual: false,
  
  targeting: { type: 'point_in_range', then: 'all_in_area' },
  validTargets: 'creatures_and_objects',
  
  saveAgainst: { 
    ability: 'dex', 
    dc: 'spellsave',
    onSuccess: 'half_damage'
  },
  damage: [{ dice: '8d6', type: 'fire' }],
  
  upcastScaling: { type: 'damage_dice', perLevel: '1d6' },
  
  description: 'A bright streak flashes from your pointing finger…',
  stackingMode: 'always'
}
```

When `CastSpellCommand { spell: 'fireball', slot: 4, targets: { point: (X,Y) } }` arrives:

1. Validator: action available ✓, slot 3+ available ✓, range/LOS ✓
2. Compute affected targets: all creatures/objects in 20ft sphere from (X,Y) — engine consults the map
3. Roll damage **once**: `(8+1)d6` for slot 4 upcast → say 27 fire damage
4. For each target:
   - Roll DEX save vs `spellSaveDC(caster)`
   - On success: apply `damage / 2 = 13`, modify by resistance/vulnerability/immunity
   - On fail: apply 27, modified
5. Emit: `SpellCastEvent`, `ResourceConsumedEvent` (slot 4), per-target `SaveRolledEvent` + `DamageDealtEvent`
6. Return `CommandSummary`:
   ```json
   { "spell": "fireball", "slot": 4, "damage_per_target": 27, "targets": [
       { "id": "bandit-1", "save": 12, "result": "failed",   "damage": 27, "hp_after": 0,  "downed": true  },
       { "id": "bandit-2", "save": 18, "result": "succeeded", "damage": 13, "hp_after": 4,  "downed": false },
       { "id": "thorin",   "save": 14, "result": "succeeded", "damage": 13, "hp_after": 21, "downed": false }
     ] }
   ```
7. LLM receives summary, narrates: *"A roiling sphere of fire blooms in the gate's archway. Two bandits are caught fully — one drops where they stand, blackened. Thorin throws his cloak across his face and rides out the worst of it, scorched but standing."*

#### Example B: Counterspell (escape-hatch handler, ~5% of spells)

Counterspell is reactive and has unique triggering rules. It uses `onCast` and the reaction system:

```ts
const Counterspell: SpellDefinition = {
  id: 'counterspell',
  name: 'Counterspell',
  level: 3,
  school: 'abjuration',
  classes: ['sorcerer', 'warlock', 'wizard'],
  source: 'srd-5.2',
  
  castingTime: { 
    unit: 'reaction', 
    amount: 1, 
    reactionTrigger: 'when_creature_within_60ft_casts_spell'
  },
  range: { type: 'feet', amount: 60 },
  components: { somatic: true },
  duration: { type: 'instantaneous' },
  concentration: false,
  ritual: false,
  
  targeting: { type: 'single_creature' },
  validTargets: 'casting_creatures',
  
  onCast: 'counterspell:handler',          // imperative logic in registry
  
  upcastScaling: { type: 'custom', handler: 'counterspell:upcast' },
  
  description: 'You attempt to interrupt a creature in the process of casting a spell.',
  stackingMode: 'always'
}

// Handler registry:
SpellHandlers['counterspell:handler'] = (ctx) => {
  const triggeringSpell = ctx.reactionTrigger.targetSpell
  const triggeringSlotLevel = ctx.reactionTrigger.slotLevel
  const counterSlotLevel = ctx.commandSlotLevel
  
  if (counterSlotLevel >= triggeringSlotLevel) {
    return { 
      events: [{ type: 'SpellCastCancelledEvent', cancelledSpell: triggeringSpell }],
      summary: { countered: true, automatic: true }
    }
  } else {
    const dc = 10 + triggeringSlotLevel
    const checkRoll = ctx.engine.roll('1d20') + ctx.caster.spellcastingModifier
    if (checkRoll >= dc) {
      return { events: [...cancel...], summary: { countered: true, check: { roll: checkRoll, dc } } }
    } else {
      return { events: [], summary: { countered: false, check: { roll: checkRoll, dc } } }
    }
  }
}
```

#### Example C: Polymorph (uses creature-template substitution)

```ts
const Polymorph: SpellDefinition = {
  // ... metadata ...
  onCast: 'polymorph:handler',
}

SpellHandlers['polymorph:handler'] = (ctx) => {
  const target = ctx.targets[0]
  const beastForm = ctx.commandPayload.beastForm   // structured choice from caster
  
  // Validate beast form is a real Beast with CR <= target.CR
  if (!isValidBeast(beastForm, target)) {
    return ctx.reject('INVALID_BEAST_FORM')
  }
  
  // Suspend target's stat block
  const suspendedStats = snapshotEntityStats(target)
  
  // Apply beast template as effect (until concentration ends or beast HP = 0)
  const effect: Effect = {
    name: 'Polymorph: ' + beastForm.name,
    target,
    modifiers: replaceStatBlock(beastForm),
    duration: { type: 'while_concentrating' },
    concentration: { holderId: ctx.caster },
    metadata: { 
      suspendedStats,
      revertOn: ['concentration_broken', 'effect_hp_zero', 'dispelled']
    }
  }
  
  return { events: [{ type: 'EffectAttachedEvent', effect }, ...] }
}
```

### 7.4 Spell Registry & Coverage Plan

The full SRD 5.2 spell list lives as 360 individual `SpellDefinition` files in `engine/spells/srd/*.ts`. Each is:
- Hand-authored from SRD text
- Unit-tested against expected behavior
- Categorized by complexity tier:

| Tier | Description | Count | Approach |
|---|---|---|---|
| **T1 — Pure Damage** | Single roll, single/multi target, optional save for half | ~90 | Pure declarative |
| **T2 — Damage + Condition** | Damage plus condition application (e.g., Hold Person) | ~80 | Declarative |
| **T3 — Buff / Debuff / Effect** | Apply ongoing effect, no damage (e.g., Bless, Haste) | ~70 | Declarative with `appliesEffects` |
| **T4 — Healing / Restoration** | Restore HP / remove conditions (e.g., Cure Wounds, Greater Restoration) | ~30 | Declarative |
| **T5 — Utility / Movement / Sensory** | Misty Step, Pass Without Trace, Detect X, Identify | ~40 | Mostly declarative + light handlers |
| **T6 — Summoning / Conjuration** | Summon Beast, Conjure Animals, Create Undead | ~20 | Handler-driven (spawn template combatants) |
| **T7 — Transformation / Replacement** | Polymorph, Shapechange, True Polymorph | ~10 | Handler-driven (stat block substitution) |
| **T8 — Meta / Spell-on-Spell** | Counterspell, Dispel Magic, Antimagic Field | ~10 | Handler-driven (interact with spell pipeline) |
| **T9 — Reality-Bending** | Wish, Plane Shift, Time Stop, Forcecage | ~10 | Handler-driven + LLM-narrative fallback for Wish's "anything else" branch |

**Test coverage**: every spell ships with:
- A unit test per code path (save success, save fail, upcast variants, edge cases)
- A "golden" integration test: setup → cast → assert engine state → assert summary
- A regression suite that runs all spells against a known fixture campaign

Estimated authoring rate: ~10-15 spells per engineer-week (T1-T4 faster, T6-T9 slower). 360 spells / 12 avg / week = **30 engineer-weeks ≈ 7 engineer-months**. Plan accordingly.

### 7.5 Targeting & Map Integration

Spells with area effects need map-aware targeting:

```ts
type AreaShape =
  | { shape: 'sphere',   radius: number /* ft */ }
  | { shape: 'cube',     side: number }
  | { shape: 'cone',     length: number }              // 60° per SRD
  | { shape: 'line',     length: number, width: number }
  | { shape: 'cylinder', radius: number, height: number }

function entitiesInArea(map: MapState, origin: GridPosition, shape: AreaShape): EntityRef[] {
  // Compute affected grid cells based on shape from origin
  // For each cell, list entities present
  // Apply line-of-sight filters per spell rules
  // Return list
}
```

The map render layer visualizes the AoE in real-time as the caster picks the origin (range ring + AoE preview).

### 7.6 NPC / Monster Spell Use

When the LLM proposes that an NPC casts a spell, it goes through the **same** `CastSpellCommand`. Engine validates the NPC has the spell in their stat block + slot available. NPC stat blocks (from Codex SRD) include their spell lists; the engine knows what they can cast.

Combat tactical AI (NPC "what should I do this turn") is a *separate* concern handled by the AI Orchestrator (the LLM, with prompts informed by the encounter's `AI tactics hint`). The engine doesn't choose actions for NPCs; it executes them.

### 7.7 Homebrew Spells (Smithy Integration)

Spells created in The Smithy use the **same** `SpellDefinition` schema, with `source: 'homebrew'`. The Smithy edit modal (already designed) becomes a structured form: pick from declarative fields; "Advanced" toggle exposes the `onCast` handler as a sandboxed Lua/JS snippet (V8 isolate or QuickJS) for power-user homebrew. Sandbox restrictions: read-only access to engine state, write via the same Command API, capped CPU/time.

---

## 8. Resource Management

```ts
type ResourceState = {
  // Class-specific resources, generic shape:
  resources: Record<ResourceId, {
    name: string
    current: number
    max: number
    recovery: 'short' | 'long' | 'dawn' | 'never' | { custom: string }
    maxScaling?: { perLevel: number, formula: string }
  }>
  
  spellSlots: {
    [level: 1-9]: { current: number, max: number }
  }
  
  pactSlots?: { level: number, current: number, max: number }   // Warlock
  
  hitDice: {
    [die: 'd6'|'d8'|'d10'|'d12']: { current: number, max: number }
  }
}
```

Examples:
- **Fighter** Second Wind: `{ name: 'Second Wind', current: 1, max: 1, recovery: 'short' }`
- **Wizard** Arcane Recovery: `{ ... recovery: 'long' }`
- **Sorcerer** Sorcery Points: `{ name: 'Sorcery Points', current: 5, max: 5, recovery: 'long', maxScaling: { perLevel: 1, formula: 'level' } }`
- **Warlock** Mystic Arcanum: per-tier, never recover during day; reset on long rest

### Rests

```
TakeRestCommand { type: 'short' }
  ⇒ Validate: not in combat, ~1hr available
  ⇒ Restore: all 'short' recovery resources to max
  ⇒ Allow each character to spend Hit Dice for healing: roll + CON, restore HP
  ⇒ Emit: RestTakenEvent + ResourceRecoveredEvent[]

TakeRestCommand { type: 'long' }
  ⇒ Validate: ~8hr safe rest available
  ⇒ Restore: all 'short' + 'long' recovery resources
  ⇒ Restore: HP to max
  ⇒ Restore: half of max Hit Dice (rounded up)
  ⇒ Tick down: all 'until_long_rest' effects
  ⇒ Recovery checks: exhaustion -1, certain conditions auto-clear (Frightened persisting? GM judgment)
```

---

## 9. Validation Pipeline

Every Command runs through a **validator chain** before execution:

```ts
type Validator = (cmd: Command, world: WorldState) => ValidationResult

// Standard chain for combat actions:
validators = [
  V.actorExists,
  V.actorAlive,
  V.actorOnTurn,                  // unless reaction
  V.actorNotIncapacitated,
  V.actionEconomyAvailable,       // action/bonus/reaction budget
  V.targetExists,
  V.targetInRange,
  V.targetVisible,                // line of sight, invisibility checks
  V.targetValid,                  // friendly/hostile filters
  V.componentsAvailable,          // V/S/M for spells
  V.slotAvailable,                // for spells
  V.concentrationCompatible,      // not breaking existing concentration silently
  V.conditionAllows,              // restraints, etc.
  V.coverApplied,
  V.commandSpecificRules          // per command type
]
```

Validation failures produce structured errors fed back to the LLM:

```json
{
  "accepted": false,
  "reason": {
    "code": "TARGET_OUT_OF_RANGE",
    "message": "Thorin is 35 feet from the bandit. Battleaxe melee range is 5 feet.",
    "detail": { "distance": 35, "weaponRange": 5, "movementAvailable": 20 }
  },
  "suggestions": [
    { "action": "move", "to": "within_5ft_of_target", "movementCost": 30 },
    { "action": "use_ranged_weapon", "weapon": "light_crossbow" }
  ]
}
```

The LLM uses the suggestions to course-correct: it might then issue `move` then re-attempt the attack.

---

## 10. Concurrency & Sync (Tier 4 Multiplayer)

### 10.1 Engine as Source of Truth, Yjs as Transport

The engine is server-authoritative. Yjs handles **delivery** of state changes to clients but never holds canonical state on the client.

```
Player A clicks Attack
   ↓
   tRPC → server engine
   ↓
   engine produces events
   ↓
   events written to event store
   ↓
   projections updated server-side
   ↓
   Yjs document updated with projection diff
   ↓
   Yjs broadcasts to all subscribed clients (A, B, C)
   ↓
   each client re-renders from the updated Yjs doc
```

### 10.2 Conflict Resolution

Commands are serialized server-side via a per-campaign command queue:

```ts
// Server-side, per campaign:
class CampaignCommandQueue {
  private queue: Command[] = []
  private processing: boolean = false
  
  async enqueue(cmd: Command): Promise<CommandResult> {
    return new Promise((resolve) => {
      this.queue.push({ cmd, resolve })
      this.drain()
    })
  }
  
  private async drain() {
    if (this.processing) return
    this.processing = true
    while (this.queue.length) {
      const { cmd, resolve } = this.queue.shift()!
      const result = await engine.execute(cmd)
      resolve(result)
    }
    this.processing = false
  }
}
```

Two simultaneous player Commands → serialized; second one validates against the (already-updated) state from the first. Race losers may be auto-corrected ("you both reached for the door; A got there first; B's command is now invalid; would you like to re-target?").

For **token drag conflicts**: last-write-wins per token within a 100ms debounce. UI snaps to authoritative position on each tick.

### 10.3 Reaction Window Sync

When a reaction trigger fires, the engine emits a `ReactionWindowOpenedEvent` with a deadline timestamp. All eligible reactors see the prompt simultaneously. First to respond wins; others see "Reaction taken by [name]" and dismiss. Timer countdown runs client-side; server enforces deadline.

### 10.4 Latency Budget

| Operation | Server P50 | Server P95 | E2E (incl. WS) |
|---|---|---|---|
| Simple Command (move, end turn) | < 20ms | < 60ms | < 100ms |
| Attack | < 40ms | < 100ms | < 150ms |
| Spell (simple) | < 60ms | < 150ms | < 200ms |
| Spell (AoE w/ 10+ targets) | < 150ms | < 400ms | < 500ms |
| Reaction window evaluation | < 30ms | < 80ms | < 120ms |
| Projection update broadcast | < 10ms | < 30ms | < 50ms |

Caches engine projections in-memory per campaign; lazy-load on first request; LRU eviction (last-played-priority).

---

## 11. Retcon & Time Travel

The killer feature of event-sourcing. Per Q19a/Q15.

### 11.1 Retcon Mechanism

```ts
type RetconCommand = {
  type: 'retcon'
  targetEventId: EventId           // rewind to just BEFORE this event
  reason?: string
  invokedBy: EntityRef
  scope?: 'this_session' | 'past_session'   // past requires extra confirmation
}
```

Execution:
1. Validate: scope, permissions (in multiplayer, requires majority vote unless host-only setting)
2. Snapshot the current state as "Ghost Timeline vN" (preserves history)
3. Truncate event log at `targetEventId`
4. Rebuild projections from genesis + replay up to truncation point
5. Update memory: add a memory entry "Retcon at [point]: [reason]" so AI knows context
6. Broadcast new state to all clients with a "burn" transition
7. Resume play from the retcon point

### 11.2 Ghost Timelines

Each retcon preserves the rolled-back events as a named branch (`session14_branch_v2`). UI exposes branches in Sessions → Engine Events → Branches. Useful for:
- "What if we had done X?"
- Comparing decisions
- Recovering accidentally-retconned content

Branches are read-only; cannot be merged or made canonical. To return to a branch's state, you retcon back to a common ancestor and replay from the branch's event sequence.

### 11.3 Cost & Limits

- Snapshots take space; configurable retention (default: keep last 10 branches per campaign)
- Bulk retcon (rolling back >500 events) shows a confirmation: "This is a large retcon. May take 5-15 seconds."
- Pinned memory entries are not affected by retcon (they're a separate document)

---

## 12. Engine State JSON for LLM Context

What the LLM actually receives each turn (Q15 multi-tier memory, layer 1 — engine state):

```json
{
  "campaign": "curse-of-strahd",
  "scene": {
    "location": "lowgate-cross/tavern-district/hearth-and-hemlock",
    "time": { "day": 3, "hour": 22, "minute": 14 },
    "weather": "heavy_rain",
    "lighting": "dim_indoor"
  },
  "encounter": null,
  "party": [
    {
      "id": "thorin",
      "name": "Thorin Ironfist",
      "class": "Fighter 5",
      "species": "Hill Dwarf",
      "hp": { "current": 28, "max": 34, "temp": 0 },
      "ac": 16,
      "position": "in_tavern_main_room",
      "conditions": [],
      "active_effects": [],
      "spell_slots_available": null,
      "key_resources": { "second_wind": "1/1", "action_surge": "0/1" }
    },
    {
      "id": "elara", "name": "Elara Moonwhisper",
      "class": "Bard 3", "species": "Wood Elf",
      "hp": { "current": 22, "max": 22, "temp": 0 },
      "ac": 14, "position": "in_tavern_main_room",
      "conditions": [], "active_effects": [{ "name": "Bardic Inspiration aura", "duration": "10min" }],
      "spell_slots_available": { "1": 2, "2": 0 },
      "key_resources": { "bardic_inspiration": "2/3" }
    }
  ],
  "npcs_in_scene": [
    { "id": "barnaby", "name": "Barnaby Bramblefoot", "disposition": "neutral", "notes": "tavernkeeper; suspected information broker" },
    { "id": "captain_valerius", "name": "Captain Valerius", "disposition": "neutral", "notes": "retired guard captain; in corner near hearth" },
    { "id": "kallista", "name": "Kallista", "disposition": "neutral", "notes": "cartographer; corner table" },
    { "id": "unknown_elf", "name": "Wood Elf (unknown)", "disposition": "unknown", "notes": "alone in shadow; not yet investigated" }
  ],
  "action_economy": null,
  "concentration": [],
  "current_actor": null,
  "open_threads": [
    { "hook": "the-salt-way-washout", "status": "active" },
    { "hook": "the-singing-road", "status": "active" }
  ]
}
```

This compact JSON (typically ~2-4KB) is included in every LLM prompt. The LLM uses it as ground truth — it cannot invent HP, AC, or who's in the scene.

The LLM also receives:
- A **system prompt** with GM persona + SRD rule reminders + tool surface
- The **hot chat context** (last ~8 exchanges)
- The **rolling session summary** (~500 tokens)
- **RAG retrievals** (top-k relevant Realms entities + past session recaps)

---

## 13. Smithy / Homebrew Extensions

All Smithy content uses the engine's standard schemas:
- **Custom Items** → `ItemDefinition` (same as SRD items)
- **Custom Weapons** → `WeaponDefinition` (with damage, properties)
- **Custom Spells** → `SpellDefinition` (declarative or with sandboxed handler)
- **Custom Monsters** → `MonsterDefinition` (stat block)
- **Custom Conditions** → `EffectTemplate`
- **Custom Class Features** → `FeatureDefinition`
- **Custom Subclasses** → `SubclassDefinition`

Power users can author `onCast` / `onHit` / `onTurnStart` handlers via a sandboxed scripting layer (QuickJS isolate). The sandbox:
- Read-only access to engine state via a constrained API
- Mutations only via Command API
- CPU/memory caps (50ms execution, 10MB heap)
- Cannot make network calls
- Cannot access other campaigns

Homebrew is validated against the schema before saving; broken handlers fail safely (script error → handler treated as no-op + warning to user).

---

## 14. Testing Strategy

### 14.1 Layers

- **Unit tests** (Jest/Vitest): every rules module function (dice, save resolution, damage calc, stacking, condition application). ~2,000 unit tests target.
- **Spell tests**: per-spell golden tests with fixture scenarios. ~360 × ~4 scenarios = ~1,400 spell tests.
- **Integration tests**: full Command pipelines, validator chains, multi-event scenarios.
- **Property-based tests** (fast-check): for invariants — "HP never goes below 0", "AC always > 0", "an entity can only concentrate on 1 spell."
- **Golden replay tests**: recorded fixture event sequences replayed to assert deterministic projections.
- **Sync tests**: 2-3 simulated clients, simultaneous commands, assert convergence.
- **Performance tests**: assert P95 latency budgets on representative scenarios.

### 14.2 Fixture Campaign

A test fixture: "Test Dungeon" — a 5E-canonical campaign with diverse encounters covering:
- Multiclass party (Fighter / Bard / Rogue / Wizard / Cleric / Druid / Warlock / Monk)
- Every condition triggered at least once
- Every spell school represented
- Concentration / reaction / opportunity attack scenarios
- Long rest / short rest cycles
- Multiclass spellcasting (slot pooling rules)

Used as:
- Regression suite (must pass before deploy)
- Performance benchmark
- AI Orchestrator integration test
- Demo content for new contributors

### 14.3 LLM Tool Adherence Tests

Separate test suite that prompts a real LLM (cached responses for CI determinism) with various scenarios and asserts:
- The LLM uses tool calls instead of inventing numbers
- The LLM correctly handles validation failures
- The LLM doesn't claim mechanical outcomes the engine didn't produce
- The LLM respects the engine state (doesn't say "you're at full HP" if the engine state says you're wounded)

---

## 15. Performance Budgets

### 15.1 Throughput Targets

- **Per-campaign concurrent users**: 6 (one DM seat + 5 players); typical 3-5
- **Commands/second per campaign at peak**: 5-10 (combat)
- **Total active campaigns per server node**: 200-500 (depending on activity mix)
- **Projection cache memory per campaign**: < 5MB hot, < 50MB historical

### 15.2 Storage

- Per-campaign events: ~10-50 MB after 30 sessions (compressed)
- Per-campaign snapshots: ~1-5 MB each, ~5-10 retained
- Total storage / 1000 campaigns: ~100 GB

### 15.3 Cost (LLM-adjacent)

- Engine itself: ~$0.0001 per command (pure compute)
- LLM call per turn: ~$0.005-$0.05 depending on context size
- Heavy session (3 hrs, 200 turns): $1-$10 in LLM/TTS combined

---

## 16. Phased Implementation Plan

*Locked May 2026. Solo engineer; calendar anchor M0 = May 2026. Product sequencing (UI, generators, tutorial, beta) is in `docs/02-implementation-roadmap.md`. This section is **engine-only** phasing interleaved with that plan.*

### Locked deltas (vs earlier draft of this doc)

| Topic | v1.0 (GA) | v1.x |
|---|---|---|
| **Spell registry** | Top-120 most-played SRD spells | Remaining ~240 spells; same `SpellDefinition` schema |
| **Spell tests (CI gate)** | Golden tests for all top-120 + fixture campaign regression | Expand toward full ~1,400 spell scenarios as registry grows |
| **Unit/integration scale** | Combat + effect + top-120 coverage; no "2,000 unit / 1,400 spell" bar for GA | Scale test suite with registry |
| **Team model** | One engineer; engine work serializes with product track | — |

The TypeScript signatures, T1–T9 tier table (§7.4), and test-strategy targets (§14) elsewhere in this document remain **design proposals** unless explicitly referenced below.

### Engine phases (solo calendar)

Months are approximate from M0 (May 2026). Engine and product share one engineer — months reflect **primary focus**, not exclusive work.

#### E1 — Engine Skeleton (M1–M3 · ~Aug 2026)
- Event store + projection rebuild
- Command API contract + tRPC bindings
- Dice service (cryptographic RNG, deterministic seeds)
- Basic entity model (Character, NPC, Monster, Scene)
- Persistence (Postgres + Drizzle migrations)
- ~50 unit tests + golden replay harness bootstrap

#### E2 — Combat Core + Sync (M4–M9 · ~Feb 2027)
- Attack/damage pipeline (no spells yet, then combat spells from top-120 as needed)
- Conditions (all SRD conditions)
- Action economy + initiative
- Movement + basic LOS
- Death saves; short/long rest mechanics
- Concentration tracking
- Reaction system (OA first; Counterspell/Shield when top-120 batch includes them)
- **Yjs sync server** (Tier 4 — no Tier 1/2 cutover)
- Battle map state (server projections; UI render pairs with product track)
- ~500 unit tests + 50 integration tests (combat slice)

#### E3 — Spell Engine Foundations (M7–M10 · ~Jun 2027)
- `SpellDefinition` schema + registry infrastructure
- Caster mechanics (slots, spell save DC, spell attack)
- Target/area resolution against map
- Save resolution; effect system + stacking rules
- Concentration interaction; upcast scaling
- ~30 T1 spells as proof, then pivot to top-120 authoring

#### E4 — Top-120 Spell Coverage (M10–M16 · ~Mar 2028)
- Author **top-120** spells across T1–T9 mix (prioritize tutorial + common play: *Hunter's Mark*, *Cure Wounds*, *Sacred Flame*, *Fireball*, *Shield*, *Counterspell*, etc.)
- Golden test per spell (primary paths: save success/fail, upcast where applicable)
- Reaction-spell handlers for spells in the top-120 set
- Transformation/summoning handlers only for spells in the set
- Multiclass slot pooling; preparation/known mechanics; ritual casting
- **Not in v1.0 engine GA scope:** completing all ~360 SRD spells or 1,400+ spell test scenarios

#### E5 — Polish & Edge (M17–M20 · ~Sep 2028)
- Retcon UI + ghost-timeline branch storage (backend earlier if needed for alpha)
- Homebrew spell sandbox (QuickJS isolate)
- Performance optimization; sync stress tests
- LLM tool-adherence test harness
- Engine state JSON optimization for LLM context
- Snapshot compression; Sentry custom metrics

#### E6 — Beta Hardening (M21+ · ~Dec 2028+)
- Bug forensics from closed beta / open beta play
- Spell edge cases discovered in live play → tests + registry patches
- Performance regression suite in CI
- Begin v1.x push: remaining ~240 spells in priority batches

**Engine v1.0 total (solo): ~18–22 months of engine-primary work**, interleaved with ~12–14 months of product-primary work on the same calendar → **~28–34 months to GA** on one engineer.

### Reference: 2–3 engineer team (not current plan)

If team size increases to 2–3 engineers dedicated to engine only, the original 12–14 month engine timeline (full ~360 spells, 1,400+ spell tests) in the design draft is achievable in parallel with a separate product track. See git history of this section for the prior phase breakdown.

---

## 17. Critical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Spell automation underestimated** | High | Critical (delays v1) | v1.0 = top-120 registry (locked); v1.x fills ~240 remainder; same schema |
| **Event log explodes in size** | Medium | Medium | Aggressive snapshotting; compress old events; configurable retention |
| **Yjs CRDT subtle bugs in combat sync** | Medium | High | Server-authoritative model means CRDT is only transport; treat client state as advisory; full state re-sync on detected divergence |
| **LLM ignores tool calls / invents numbers** | Medium | High | Strict tool-adherence tests; system prompt enforces tool-first; engine never trusts LLM-claimed outcomes |
| **Concentration interaction bugs** | High | Medium | Dedicated concentration test matrix; explicit interaction tests with every spell pair |
| **Performance regression from spell volume** | Medium | Medium | Per-spell benchmarks; CI threshold gates |
| **Homebrew sandbox escape** | Low | Critical | QuickJS isolate; defense-in-depth; manual review of any handler escaping basic capabilities |
| **Retcon corrupts projections** | Medium | High | Snapshot-and-replay pattern; never mutate projections directly; assertions in projection rebuild |
| **Multi-character action attribution bugs** | Medium | Medium | Every event tagged with actor; integration tests cover N-party scenarios |

---

That's the deterministic engine + spell automation architecture. The core insight: **make the engine the source of truth, the LLM the source of prose**, and you can run faithful SRD-fidelity 5E at full Tier-4-multiplayer scale without ever trusting the LLM to do arithmetic.
