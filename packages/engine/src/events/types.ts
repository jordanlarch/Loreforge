/**
 * Engine event model (E1 subset).
 *
 * Every state mutation is an immutable, append-only event. Projections are pure
 * derivations of the event log (see `../projections`). This file defines the
 * small set of event types the skeleton needs; the full ~50-type taxonomy in
 * `docs/engine/architecture.md` §3.1 is added incrementally in later phases.
 */
import type {
  EntityInit,
  EntityRef,
  GridPosition,
  SceneId,
  SceneState,
} from "../entities/types";
import type { InitiativeEntry } from "../combat/initiative";
import type { RollMode } from "../rng/dice";

/** Common envelope fields stamped on every persisted event. */
export type EventMeta = {
  /** Monotonic per-campaign sequence number (1-based). */
  sequence: number;
  campaignId: string;
  /** Server epoch ms. */
  timestamp: number;
  /** Command that produced this event. */
  causedByCommandId: string;
  /** Who caused it (entity ref, "ai", or "system"). */
  actor?: EntityRef | "ai" | "system";
};

export type EntityCreatedPayload = { entity: EntityInit };

export type SceneCreatedPayload = { scene: SceneState };

export type SceneChangedPayload = { sceneId: SceneId };

export type DiceRolledPayload = {
  notation: string;
  rolls: number[];
  total: number;
  /** RNG scope used (for audit/replay). */
  scope: string;
  /** Draw index within the scope's stream. */
  drawIndex: number;
};

export type DamageDealtPayload = {
  target: EntityRef;
  amount: number;
  damageType: string;
  hpBefore: number;
  hpAfter: number;
};

export type HealingAppliedPayload = {
  target: EntityRef;
  amount: number;
  hpBefore: number;
  hpAfter: number;
};

export type EntityMovedPayload = {
  entity: EntityRef;
  from?: GridPosition;
  to: GridPosition;
};

export type EncounterStartedPayload = {
  sceneId: SceneId;
  combatants: EntityRef[];
};

export type InitiativeRolledPayload = {
  /** Combatants in resolved descending turn order. */
  order: InitiativeEntry[];
};

export type TurnStartedPayload = {
  entity: EntityRef;
  /** Index of this combatant within the initiative order. */
  index: number;
};

export type TurnEndedPayload = {
  entity: EntityRef;
};

export type RoundAdvancedPayload = {
  round: number;
};

export type AttackResolvedPayload = {
  attacker: EntityRef;
  target: EntityRef;
  attackRoll: { natural: number; total: number; mode: RollMode };
  targetAc: number;
  hit: boolean;
  critical: boolean;
  damageType: string;
  /** Damage dealt on a hit; omitted on a miss. */
  damage?: number;
};

/** Discriminated union of all engine events. */
export type EngineEvent =
  | (EventMeta & { type: "EntityCreated"; payload: EntityCreatedPayload })
  | (EventMeta & { type: "SceneCreated"; payload: SceneCreatedPayload })
  | (EventMeta & { type: "SceneChanged"; payload: SceneChangedPayload })
  | (EventMeta & { type: "DiceRolled"; payload: DiceRolledPayload })
  | (EventMeta & { type: "DamageDealt"; payload: DamageDealtPayload })
  | (EventMeta & { type: "HealingApplied"; payload: HealingAppliedPayload })
  | (EventMeta & { type: "EntityMoved"; payload: EntityMovedPayload })
  | (EventMeta & { type: "EncounterStarted"; payload: EncounterStartedPayload })
  | (EventMeta & { type: "InitiativeRolled"; payload: InitiativeRolledPayload })
  | (EventMeta & { type: "TurnStarted"; payload: TurnStartedPayload })
  | (EventMeta & { type: "TurnEnded"; payload: TurnEndedPayload })
  | (EventMeta & { type: "RoundAdvanced"; payload: RoundAdvancedPayload })
  | (EventMeta & { type: "AttackResolved"; payload: AttackResolvedPayload });

export type EngineEventType = EngineEvent["type"];

/** An event before it has been assigned its sequence number by the store. */
export type DraftEvent = Omit<EngineEvent, "sequence">;
