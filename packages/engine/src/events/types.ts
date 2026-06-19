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

/** Discriminated union of all engine events. */
export type EngineEvent =
  | (EventMeta & { type: "EntityCreated"; payload: EntityCreatedPayload })
  | (EventMeta & { type: "SceneCreated"; payload: SceneCreatedPayload })
  | (EventMeta & { type: "SceneChanged"; payload: SceneChangedPayload })
  | (EventMeta & { type: "DiceRolled"; payload: DiceRolledPayload })
  | (EventMeta & { type: "DamageDealt"; payload: DamageDealtPayload })
  | (EventMeta & { type: "HealingApplied"; payload: HealingAppliedPayload })
  | (EventMeta & { type: "EntityMoved"; payload: EntityMovedPayload });

export type EngineEventType = EngineEvent["type"];

/** An event before it has been assigned its sequence number by the store. */
export type DraftEvent = Omit<EngineEvent, "sequence">;
