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
import {
  expireStartOfTurnEffects,
  stripConcentrationEffects,
  stripConcentrationConditions,
  applyTimedEffectTick,
  effectiveSpeedForEntity,
} from "../combat/effects";
import { attacksPerAction, createEntityState } from "../entities/abilities";
import type {
  EntityRef,
  EntityState,
  GridPosition,
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
  /** Per-combatant side/team id; combatants absent here are neutral. */
  sides: Record<EntityRef, string>;
  /** Resolved descending turn order; empty until initiative is rolled. */
  order: InitiativeEntry[];
  initiativeRolled: boolean;
  /** 0 before initiative; 1-based once combat begins. */
  round: number;
  /** Index into `order` of the active combatant. */
  activeIndex: number;
  /** The most recent open opportunity-attack window, if any. */
  reactionWindow?: {
    mover: EntityRef;
    eligible: EntityRef[];
    moverAtProvocation: GridPosition;
  };
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

/** Reconcile a single resource with incapacitation: lost while incapacitated,
 * restored from `lost` once the condition clears (a spent `used` stays spent). */
function reconcile(current: ResourceState, incap: boolean): ResourceState {
  if (incap) return "lost";
  return current === "lost" ? "available" : current;
}

/**
 * Reconcile action (per-turn) and reaction (round-spanning) availability with
 * incapacitation. Operates whether or not the active-turn action economy is
 * present, since the reaction lives on the entity and outlives the turn.
 */
function syncEconomy(entity: EntityState): EntityState {
  const incap = isIncapacitated(entity.conditions);
  const ae = entity.actionEconomy;

  const reaction =
    entity.reaction !== undefined ? reconcile(entity.reaction, incap) : undefined;
  const action = ae ? reconcile(ae.action, incap) : undefined;

  const reactionChanged = reaction !== entity.reaction;
  const actionChanged = ae !== undefined && action !== ae.action;
  if (!reactionChanged && !actionChanged) return entity;

  return {
    ...entity,
    ...(reactionChanged ? { reaction } : {}),
    ...(ae && actionChanged ? { actionEconomy: { ...ae, action: action! } } : {}),
  };
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
    case "EntityRelocated": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = {
          ...entity,
          sceneId: event.payload.sceneId,
          ...(event.payload.position
            ? { position: { ...event.payload.position } }
            : {}),
        };
      }
      break;
    }
    case "EncounterStarted": {
      next.encounter = {
        sceneId: event.payload.sceneId,
        combatants: [...event.payload.combatants],
        sides: { ...event.payload.sides },
        order: [],
        initiativeRolled: false,
        round: 0,
        activeIndex: 0,
      };
      break;
    }
    case "EncounterEnded": {
      if (next.encounter) {
        for (const ref of next.encounter.combatants) {
          const c = next.entities[ref];
          if (c) {
            next.entities[ref] = {
              ...c,
              actionEconomy: undefined,
              reaction: undefined,
              readied: undefined,
            };
          }
        }
        next.encounter = undefined;
      }
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
        // Every combatant enters combat with a reaction available.
        for (const ref of next.encounter.combatants) {
          const c = next.entities[ref];
          if (c) {
            next.entities[ref] = { ...c, reaction: "available", readied: undefined };
          }
        }
      }
      break;
    }
    case "CombatantAdded": {
      if (next.encounter) {
        const combatants = [...next.encounter.combatants, event.payload.entityId];
        const sides = {
          ...next.encounter.sides,
          [event.payload.entityId]: event.payload.side,
        };
        const newcomer = next.entities[event.payload.entityId];
        if (newcomer) {
          next.entities[event.payload.entityId] = {
            ...newcomer,
            reaction: "available",
          };
        }
        next.encounter = {
          ...next.encounter,
          combatants,
          sides,
          order: event.payload.order.map((e) => ({ ...e })),
          activeIndex: event.payload.activeIndex,
        };
      }
      break;
    }
    case "TurnStarted": {
      if (next.encounter) {
        next.encounter = {
          ...next.encounter,
          activeIndex: event.payload.index,
          reactionWindow: undefined,
        };
      }
      const actor = next.entities[event.payload.entity];
      if (actor) {
        const effects = expireStartOfTurnEffects(actor, actor.id);
        // Fresh turn: refresh the reaction budget; a readied action lapses.
        next.entities[actor.id] = syncEconomy({
          ...actor,
          effects,
          actionEconomy: freshActionEconomy(
            effectiveSpeedForEntity(actor),
            attacksPerAction(actor),
          ),
          reaction: "available",
          readied: undefined,
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
    case "EffectsDurationTicked": {
      next.entities = applyTimedEffectTick(next.entities);
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
          ...(event.payload.concentrationSpell
            ? { concentrationSpell: event.payload.concentrationSpell }
            : {}),
          ...(event.payload.concentrationHolder
            ? { concentrationHolder: event.payload.concentrationHolder }
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
        const spell = target.concentration?.spell;
        next.entities[target.id] = { ...target, concentration: undefined };
        if (spell) {
          next.entities = stripConcentrationEffects(
            next.entities,
            target.id,
            spell,
          );
          next.entities = stripConcentrationConditions(
            next.entities,
            target.id,
            spell,
          );
        }
      }
      break;
    }
    case "EffectApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = {
          ...target,
          effects: [...(target.effects ?? []), event.payload.effect],
        };
      }
      break;
    }
    case "EffectRemoved": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = {
          ...target,
          effects: (target.effects ?? []).filter(
            (fx) => fx.id !== event.payload.effectId,
          ),
        };
      }
      break;
    }
    case "ReactionWindowOpened": {
      if (next.encounter) {
        next.encounter = {
          ...next.encounter,
          reactionWindow: {
            mover: event.payload.mover,
            eligible: [...event.payload.eligible],
            moverAtProvocation: event.payload.moverAtProvocation,
          },
        };
      }
      break;
    }
    case "ReactionTaken": {
      const reactor = next.entities[event.payload.reactor];
      if (reactor) {
        next.entities[reactor.id] = { ...reactor, reaction: "used" };
      }
      if (next.encounter?.reactionWindow) {
        const eligible = next.encounter.reactionWindow.eligible.filter(
          (ref) => ref !== event.payload.reactor,
        );
        next.encounter = {
          ...next.encounter,
          reactionWindow: { ...next.encounter.reactionWindow, eligible },
        };
      }
      break;
    }
    case "ActionReadied": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        const actionEconomy = entity.actionEconomy
          ? { ...entity.actionEconomy, action: "used" as ResourceState }
          : entity.actionEconomy;
        next.entities[entity.id] = {
          ...entity,
          actionEconomy,
          readied: { trigger: event.payload.trigger, action: event.payload.action },
        };
      }
      break;
    }
    case "ActionSpent": {
      // Debit the active combatant's turn economy: the single action and/or one
      // attack of the Attack action's budget. No-op outside the owner's turn
      // (no economy present), so reactions/opportunity attacks never burn it.
      const entity = next.entities[event.payload.entity];
      if (entity?.actionEconomy) {
        let ae = entity.actionEconomy;
        if (event.payload.action) ae = { ...ae, action: "used" };
        if (event.payload.attack) {
          ae = { ...ae, attacks: { ...ae.attacks, used: ae.attacks.used + 1 } };
        }
        next.entities[entity.id] = { ...entity, actionEconomy: ae };
      }
      break;
    }
    case "ReadiedActionTriggered": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = { ...entity, readied: undefined };
      }
      break;
    }
    case "SpellSlotExpended": {
      const caster = next.entities[event.payload.entity];
      if (caster?.spellcasting) {
        const slot = caster.spellcasting.slots[event.payload.slotLevel];
        if (slot) {
          next.entities[caster.id] = {
            ...caster,
            spellcasting: {
              ...caster.spellcasting,
              slots: {
                ...caster.spellcasting.slots,
                [event.payload.slotLevel]: {
                  ...slot,
                  current: Math.max(0, slot.current - 1),
                },
              },
            },
          };
        }
      }
      break;
    }
    case "SpellSlotsRestored": {
      const caster = next.entities[event.payload.entity];
      if (caster?.spellcasting) {
        const slots: typeof caster.spellcasting.slots = {};
        for (const [level, slot] of Object.entries(caster.spellcasting.slots)) {
          slots[Number(level)] = { ...slot, current: slot.max };
        }
        next.entities[caster.id] = {
          ...caster,
          spellcasting: { ...caster.spellcasting, slots },
        };
      }
      break;
    }
    case "SpellCast": {
      // A bonus-action cast consumes the bonus action while on the clock; HP /
      // slot changes ride on paired Healing/Damage/Slot events.
      if (event.payload.bonusAction) {
        const caster = next.entities[event.payload.caster];
        if (caster?.actionEconomy) {
          next.entities[caster.id] = {
            ...caster,
            actionEconomy: {
              ...caster.actionEconomy,
              bonusAction: "used",
            },
          };
        }
      }
      break;
    }
    case "Rested":
    case "AttackResolved":
    case "SaveRolled":
    case "CheckRolled":
    case "DiceRolled":
      // Pure record; state changes ride on paired Healing/Condition/Slot events.
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
