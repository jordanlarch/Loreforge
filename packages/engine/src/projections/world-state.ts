/**
 * WorldState projection (E1 subset).
 *
 * A pure derivation of the event log: `rebuild(events)` folds from genesis,
 * `applyEvent(state, event)` advances incrementally. Projections never mutate
 * in place — each step returns a new state object — so a retcon can rebuild
 * from genesis deterministically (`docs/engine/architecture.md` §3.2).
 */
import { freshActionEconomy, type InitiativeEntry } from "../combat/initiative";
import { createEntityState } from "../entities/abilities";
import type {
  EntityRef,
  EntityState,
  SceneId,
  SceneState,
} from "../entities/types";
import type { EngineEvent } from "../events/types";

/** Active-encounter projection: turn order, whose turn it is, and the round. */
export type EncounterState = {
  sceneId: SceneId;
  /** Encounter membership, set at start (before initiative is rolled). */
  combatants: EntityRef[];
  /** Resolved descending turn order; empty until initiative is rolled. */
  order: InitiativeEntry[];
  initiativeRolled: boolean;
  /** 0 before initiative; 1-based once combat begins. */
  round: number;
  /** Index into `order` of the active combatant. */
  activeIndex: number;
};

export type WorldState = {
  campaignId: string;
  entities: Record<EntityRef, EntityState>;
  scenes: Record<SceneId, SceneState>;
  currentSceneId?: SceneId;
  /** Present while an encounter is active. */
  encounter?: EncounterState;
  /** Sequence number of the last event folded into this state. */
  lastSequence: number;
};

export function emptyWorldState(campaignId: string): WorldState {
  return {
    campaignId,
    entities: {},
    scenes: {},
    currentSceneId: undefined,
    lastSequence: 0,
  };
}

function clampHp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

/** Fold a single event into the state, returning a new WorldState. */
export function applyEvent(state: WorldState, event: EngineEvent): WorldState {
  const next: WorldState = {
    ...state,
    entities: { ...state.entities },
    scenes: { ...state.scenes },
    lastSequence: event.sequence,
  };

  switch (event.type) {
    case "EntityCreated": {
      const entity = createEntityState(event.payload.entity);
      next.entities[entity.id] = entity;
      break;
    }
    case "SceneCreated": {
      next.scenes[event.payload.scene.id] = { ...event.payload.scene };
      break;
    }
    case "SceneChanged": {
      next.currentSceneId = event.payload.sceneId;
      break;
    }
    case "DamageDealt": {
      const target = next.entities[event.payload.target];
      if (target) {
        const hp = { ...target.hp };
        // Temp HP soaks damage first.
        const fromTemp = Math.min(hp.temp, event.payload.amount);
        hp.temp -= fromTemp;
        const remaining = event.payload.amount - fromTemp;
        hp.current = clampHp(hp.current - remaining, hp.max);
        next.entities[target.id] = {
          ...target,
          hp,
          alive: hp.current > 0,
        };
      }
      break;
    }
    case "HealingApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const hp = { ...target.hp };
        hp.current = clampHp(hp.current + event.payload.amount, hp.max);
        next.entities[target.id] = {
          ...target,
          hp,
          alive: hp.current > 0,
        };
      }
      break;
    }
    case "EntityMoved": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = {
          ...entity,
          position: { ...event.payload.to },
        };
      }
      break;
    }
    case "EncounterStarted": {
      next.encounter = {
        sceneId: event.payload.sceneId,
        combatants: [...event.payload.combatants],
        order: [],
        initiativeRolled: false,
        round: 0,
        activeIndex: 0,
      };
      break;
    }
    case "InitiativeRolled": {
      if (next.encounter) {
        next.encounter = {
          ...next.encounter,
          order: event.payload.order.map((e) => ({ ...e })),
          initiativeRolled: true,
          round: 1,
          activeIndex: 0,
        };
      }
      break;
    }
    case "TurnStarted": {
      if (next.encounter) {
        next.encounter = { ...next.encounter, activeIndex: event.payload.index };
      }
      const actor = next.entities[event.payload.entity];
      if (actor) {
        next.entities[actor.id] = {
          ...actor,
          actionEconomy: freshActionEconomy(actor.speed),
        };
      }
      break;
    }
    case "TurnEnded": {
      const actor = next.entities[event.payload.entity];
      if (actor) {
        next.entities[actor.id] = { ...actor, actionEconomy: undefined };
      }
      break;
    }
    case "RoundAdvanced": {
      if (next.encounter) {
        next.encounter = { ...next.encounter, round: event.payload.round };
      }
      break;
    }
    case "DiceRolled":
      // Pure record; no projected state change.
      break;
  }

  return next;
}

/** Rebuild the full projection from an ordered event log. */
export function rebuild(
  campaignId: string,
  events: EngineEvent[],
): WorldState {
  return events.reduce(applyEvent, emptyWorldState(campaignId));
}
