/**
 * WorldState projection (E1 subset).
 *
 * A pure derivation of the event log: `rebuild(events)` folds from genesis,
 * `applyEvent(state, event)` advances incrementally. Projections never mutate
 * in place — each step returns a new state object — so a retcon can rebuild
 * from genesis deterministically (`docs/engine/architecture.md` §3.2).
 */
import { freshActionEconomy, type InitiativeEntry } from "../combat/initiative";
import { distanceFeet } from "../combat/grid";
import { effectiveSpeed, isIncapacitated } from "../combat/conditions";
import { createEntityState } from "../entities/abilities";
import type {
  EntityRef,
  EntityState,
  ResourceState,
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

/**
 * Reconcile action/reaction availability with incapacitation. Incapacitated
 * creatures lose their action and reaction; clearing the condition restores them
 * only if they were lost (a spent `used` resource stays spent).
 */
function syncEconomy(entity: EntityState): EntityState {
  const ae = entity.actionEconomy;
  if (!ae) return entity;
  const incap = isIncapacitated(entity.conditions);
  const action: ResourceState = incap
    ? "lost"
    : ae.action === "lost"
      ? "available"
      : ae.action;
  const reaction: ResourceState = incap
    ? "lost"
    : ae.reaction === "lost"
      ? "available"
      : ae.reaction;
  if (action === ae.action && reaction === ae.reaction) return entity;
  return { ...entity, actionEconomy: { ...ae, action, reaction } };
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
        const wasDown = target.hp.current === 0;
        const hp = { ...target.hp };
        // Temp HP soaks damage first.
        const fromTemp = Math.min(hp.temp, event.payload.amount);
        hp.temp -= fromTemp;
        const remaining = event.payload.amount - fromTemp;
        hp.current = clampHp(hp.current - remaining, hp.max);

        let updated: EntityState = { ...target, hp, alive: hp.current > 0 };
        if (hp.current === 0 && !updated.dead) {
          if (wasDown && remaining > 0) {
            // Taking damage while already at 0 HP is a death-save failure.
            const tally = updated.deathSaves ?? { successes: 0, failures: 0 };
            const failures = tally.failures + 1;
            updated = {
              ...updated,
              deathSaves: { ...tally, failures: Math.min(3, failures) },
              dead: failures >= 3,
            };
          } else if (!wasDown) {
            // Freshly downed: begin death saves; concentration ends.
            updated = {
              ...updated,
              deathSaves: { successes: 0, failures: 0 },
              stable: false,
              concentration: undefined,
            };
          }
        }
        next.entities[target.id] = updated;
      }
      break;
    }
    case "HealingApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const hp = { ...target.hp };
        hp.current = clampHp(hp.current + event.payload.amount, hp.max);
        const revived = hp.current > 0 && target.hp.current === 0;
        next.entities[target.id] = {
          ...target,
          hp,
          alive: hp.current > 0,
          // Healing above 0 ends the dying state.
          ...(revived ? { deathSaves: undefined, stable: false } : {}),
        };
      }
      break;
    }
    case "EntityMoved": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        // Debit the movement budget when on the clock (action economy present).
        let actionEconomy = entity.actionEconomy;
        if (actionEconomy && event.payload.from) {
          const cost = distanceFeet(event.payload.from, event.payload.to);
          actionEconomy = {
            ...actionEconomy,
            movement: {
              ...actionEconomy.movement,
              used: actionEconomy.movement.used + cost,
            },
          };
        }
        next.entities[entity.id] = {
          ...entity,
          position: { ...event.payload.to },
          actionEconomy,
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
        next.entities[actor.id] = syncEconomy({
          ...actor,
          actionEconomy: freshActionEconomy(
            effectiveSpeed(actor.speed, actor.conditions),
          ),
        });
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
    case "ConditionApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const others = target.conditions.filter(
          (c) => c.condition !== event.payload.condition,
        );
        const applied = {
          condition: event.payload.condition,
          ...(event.payload.source ? { source: event.payload.source } : {}),
          ...(event.payload.level !== undefined
            ? { level: event.payload.level }
            : {}),
        };
        const conditions = [...others, applied];
        // Incapacitation ends concentration.
        const concentration = isIncapacitated(conditions)
          ? undefined
          : target.concentration;
        next.entities[target.id] = syncEconomy({
          ...target,
          conditions,
          concentration,
        });
      }
      break;
    }
    case "ConditionRemoved": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = syncEconomy({
          ...target,
          conditions: target.conditions.filter(
            (c) => c.condition !== event.payload.condition,
          ),
        });
      }
      break;
    }
    case "DeathSaveRolled": {
      const target = next.entities[event.payload.entity];
      if (target) {
        if (event.payload.revived) {
          // Natural 20: stand back up with 1 HP.
          next.entities[target.id] = {
            ...target,
            hp: { ...target.hp, current: 1 },
            alive: true,
            dead: false,
            deathSaves: undefined,
            stable: false,
          };
        } else {
          next.entities[target.id] = {
            ...target,
            deathSaves: {
              successes: event.payload.successes,
              failures: event.payload.failures,
            },
            stable: event.payload.stable,
            dead: event.payload.dead,
          };
        }
      }
      break;
    }
    case "ConcentrationStarted": {
      const target = next.entities[event.payload.entity];
      if (target) {
        next.entities[target.id] = {
          ...target,
          concentration: { spell: event.payload.spell },
        };
      }
      break;
    }
    case "ConcentrationBroken": {
      const target = next.entities[event.payload.entity];
      if (target) {
        next.entities[target.id] = { ...target, concentration: undefined };
      }
      break;
    }
    case "Rested":
    case "AttackResolved":
    case "SaveRolled":
    case "DiceRolled":
      // Pure record; state changes ride on paired Healing/Condition events.
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
