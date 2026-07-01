/**
 * WorldState projection (E1 subset).
 *
 * A pure derivation of the event log: `rebuild(events)` folds from genesis,
 * `applyEvent(state, event)` advances incrementally. Projections never mutate
 * in place — each step returns a new state object — so a retcon can rebuild
 * from genesis deterministically (`docs/engine/architecture.md` §3.2).
 */
import { freshActionEconomy, surprisedActionEconomy, type InitiativeEntry } from "../combat/initiative";
import {
  classLevel,
  draconicResilienceHpBonus,
  hasClassSubclass,
  indomitableAvailable,
} from "../combat/class-feature-mechanics";
import { cellIsDifficult, distanceFeet, movementCostFeet } from "../combat/grid";
import {
  failuresFromDamageAtZeroHp,
  isInstantDeathFromDamage,
} from "../combat/death";
import { effectiveSpeed, isIncapacitated } from "../combat/conditions";
import {
  applyTimedEffectTick,
  effectiveSpeedForEntity,
  entityHasHaste,
  expireStartOfTurnEffects,
  stripConcentrationConditions,
  stripConcentrationEffects,
  stripHelpAttackEffect,
  stripHelpCheckEffects,
  stripOneBardicInspiration,
} from "../combat/effects";
import { CONCENTRATION_ZONE_SPELL_IDS } from "../spells/fid12-spells";
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
  /** Set after `resolve_surprise`; optional before rolling initiative. */
  surpriseResolved: boolean;
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
  /** Attack roll staged while eligible bards may use Cutting Words. */
  pendingAttack?: PendingAttackState;
  /** Spell cast staged while eligible casters may Counterspell. */
  pendingSpellCast?: PendingSpellCastState;
  /** Failed save the entity may reroll with Indomitable. */
  pendingIndomitable?: PendingIndomitableState;
};

/** Indomitable window after a failed saving throw. */
export type PendingIndomitableState = {
  entity: EntityRef;
  ability: import("../entities/types").Ability;
  dc: number;
};

/** Spell cast paused until Counterspell reactions resolve or pass. */
export type PendingSpellCastState = {
  cmd: import("../commands/types").CastSpellCommand;
  slotLevel: number;
  eligible: EntityRef[];
  declined: EntityRef[];
};

/** Attack paused after the roll until Cutting Words resolve or pass. */
export type PendingAttackState = {
  cmd: import("../commands/types").AttackCommand;
  natural: number;
  total: number;
  targetAc: number;
  hit: boolean;
  critical: boolean;
  mode: import("../rng/dice").RollMode;
  hadBardicInspiration: boolean;
  eligible: EntityRef[];
  declined: EntityRef[];
  spendsAction: boolean;
  spendsBonusAction: boolean;
  spendsFlurryAttack: boolean;
  viaReaction?: boolean;
  targetPosition?: GridPosition;
};

export type WorldState = {
  campaignId: string;
  entities: Record<EntityRef, EntityState>;
  scenes: Record<SceneId, SceneState>;
  currentSceneId?: SceneId;
  /** Present while an encounter is active. */
  encounter?: EncounterState;
/** Per-dungeon exploration progress (DUN-1 — see docs/engine/dungeon-exploration.md). */
  dungeonProgress?: DungeonProgressState;
  /** Parsed floor/zone layout per dungeon entity (DUN-2). */
  dungeonLayouts?: Record<string, import("../dungeon/types").DungeonLayoutState>;
  /** Per-PC revealed cells on dungeon floor scenes (DUN-5). */
  dungeonFog?: Record<EntityRef, Record<SceneId, string[]>>;
  /** Sequence number of the last event folded into this state. */
  lastSequence: number;
};

/** Tracks dungeon threshold, visited/cleared zones, and active encounter zone. */
export type DungeonProgressState = {
  dungeonEntityId: string;
  thresholdOpened: boolean;
  currentFloorIndex: number;
  visitedZoneIds: string[];
  clearedZoneIds: string[];
  /** Zone where the entry / current encounter was triggered (DUN-1 tracer). */
  activeEncounterZoneId?: string;
  /** Detector→detected pairs for dungeon stealth (DUN-3). */
  detectedPairs?: string[];
  /** Zones where alertZoneOnDetection fired (DUN-3). */
  alertedZoneIds?: string[];
  /** Map object runtime state keyed by objectId (DUN-4). */
  objectStates?: Record<string, { zoneId: string; takenByEntityId: string }>;
  /** Party-shared zones revealed via per-PC fog (DUN-5). */
  discoveredZoneIds?: string[];
  /** Active patrol runtime keyed by patrolId (DUN-6). */
  patrolStates?: Record<
    string,
    {
      patrolId: string;
      entityId: EntityRef;
      floorIndex: number;
      waypointIndex: number;
    }
  >;
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
function reconcile(
  current: ResourceState,
  incap: boolean,
  preserveLost = false,
): ResourceState {
  if (incap) return "lost";
  if (preserveLost && current === "lost") return "lost";
  return current === "lost" ? "available" : current;
}

/**
 * Reconcile action (per-turn) and reaction (round-spanning) availability with
 * incapacitation. Operates whether or not the active-turn action economy is
 * present, since the reaction lives on the entity and outlives the turn.
 */
function syncEconomy(entity: EntityState): EntityState {
  const incap = isIncapacitated(entity.conditions);
  const preserveLost = entity.surprised === true;
  const ae = entity.actionEconomy;

  const reaction =
    entity.reaction !== undefined
      ? reconcile(entity.reaction, incap, preserveLost)
      : undefined;
  const action = ae ? reconcile(ae.action, incap, preserveLost) : undefined;

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
      let entity = createEntityState(event.payload.entity);
      const sorcererLevel = classLevel(entity.classes, "Sorcerer");
      if (
        hasClassSubclass(entity.classes, "Sorcerer", "Draconic Sorcery") &&
        sorcererLevel >= 3
      ) {
        const bonus = draconicResilienceHpBonus(sorcererLevel);
        if (bonus > 0) {
          entity = {
            ...entity,
            hp: {
              ...entity.hp,
              max: entity.hp.max + bonus,
              current: entity.hp.current + bonus,
            },
          };
        }
      }
      next.entities[entity.id] = entity;
      break;
    }
    case "SceneCreated": {
      next.scenes[event.payload.scene.id] = { ...event.payload.scene };
      break;
    }
    case "SceneMapPatched": {
      const scene = next.scenes[event.payload.sceneId];
      if (!scene) break;
      const existingTraps = scene.traps ?? [];
      const trapById = new Map(existingTraps.map((t) => [t.instanceId, t]));
      const mergedTraps = event.payload.traps?.map((t) => {
        const prev = trapById.get(t.instanceId);
        return prev
          ? {
              ...t,
              detected: prev.detected,
              disabled: prev.disabled,
              triggered: prev.triggered,
            }
          : t;
      });
      next.scenes[event.payload.sceneId] = {
        ...scene,
        map: event.payload.map,
        ...(event.payload.traps !== undefined
          ? { traps: mergedTraps ?? [] }
          : {}),
      };
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
        if (hp.current === 0 && updated.polymorph) {
          const stored = updated.polymorph;
          updated = {
            ...updated,
            polymorph: undefined,
            abilityScores: { ...stored.storedAbilityScores },
            hp: {
              ...hp,
              max: stored.storedMaxHp,
              current: 0,
            },
            baseAc: stored.storedBaseAc,
            speed: stored.storedSpeed,
            alive: false,
            deathSaves: { successes: 0, failures: 0 },
          };
        } else if (hp.current === 0 && !updated.dead) {
          if (
            !wasDown &&
            isInstantDeathFromDamage(
              event.payload.amount,
              hp.max,
              event.payload.hpBefore,
              target.hp.temp,
              hp.current,
            )
          ) {
            updated = {
              ...updated,
              dead: true,
              deathSaves: undefined,
              stable: false,
              concentration: undefined,
            };
          } else if (wasDown && remaining > 0) {
            const tally = updated.deathSaves ?? { successes: 0, failures: 0 };
            const delta = failuresFromDamageAtZeroHp(
              event.payload.critical ?? false,
            );
            const failures = tally.failures + delta;
            updated = {
              ...updated,
              deathSaves: { ...tally, failures: Math.min(3, failures) },
              dead: failures >= 3,
            };
          } else if (!wasDown) {
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
        const wasDead = target.dead;
        next.entities[target.id] = {
          ...target,
          hp,
          alive: hp.current > 0,
          ...(revived || wasDead
            ? { deathSaves: undefined, stable: false, dead: false }
            : {}),
        };
      }
      break;
    }
    case "TempHpGranted": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = {
          ...target,
          hp: { ...target.hp, temp: event.payload.tempAfter },
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
          const scene = entity.sceneId ? next.scenes[entity.sceneId] : undefined;
          const map = scene?.map;
          const cost = movementCostFeet(
            event.payload.from,
            event.payload.to,
            (cell) => cellIsDifficult(map, cell),
          );
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
        surpriseResolved: false,
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
              surprised: undefined,
            };
          }
        }
        next.encounter = undefined;
      }
      break;
    }
    case "SurpriseResolved": {
      if (next.encounter) {
        next.encounter = { ...next.encounter, surpriseResolved: true };
      }
      for (const ref of event.payload.surprised) {
        const entity = next.entities[ref];
        if (entity) {
          next.entities[ref] = { ...entity, surprised: true };
        }
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
          dodging: undefined,
          disengaged: undefined,
          actionEconomy: actor.surprised
            ? surprisedActionEconomy(attacksPerAction(actor))
            : {
                ...freshActionEconomy(
                  effectiveSpeedForEntity(actor),
                  attacksPerAction(actor),
                ),
                ...(entityHasHaste(actor)
                  ? { extraAction: "available" as const }
                  : {}),
              },
          reaction: actor.surprised ? "lost" : "available",
          readied: undefined,
        });
      }
      break;
    }
    case "TurnEnded": {
      const actor = next.entities[event.payload.entity];
      if (actor) {
        next.entities[actor.id] = {
          ...actor,
          actionEconomy: undefined,
          disengaged: undefined,
          surprised: undefined,
          hasteLethargy: actor.hasteLethargy ? undefined : actor.hasteLethargy,
        };
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
          if (spell.toLowerCase() === "polymorph") {
            for (const [id, entity] of Object.entries(next.entities)) {
              if (entity.polymorph?.caster === target.id) {
                const stored = entity.polymorph;
                next.entities[id] = {
                  ...entity,
                  polymorph: undefined,
                  abilityScores: { ...stored.storedAbilityScores },
                  hp: {
                    ...entity.hp,
                    max: stored.storedMaxHp,
                    current: Math.min(
                      stored.storedHpCurrent,
                      stored.storedMaxHp,
                    ),
                  },
                  baseAc: stored.storedBaseAc,
                  speed: stored.storedSpeed,
                };
              }
            }
          }
          if (spell.toLowerCase() === "banishment") {
            for (const [id, entity] of Object.entries(next.entities)) {
              if (entity.banishment?.caster === target.id) {
                const stored = entity.banishment;
                next.entities[id] = {
                  ...entity,
                  banishment: undefined,
                  sceneId: stored.returnSceneId,
                  position: { ...stored.returnPosition },
                  conditions: entity.conditions.filter(
                    (c) => c.condition !== "incapacitated",
                  ),
                };
              }
            }
          }
          const zoneSpellId = CONCENTRATION_ZONE_SPELL_IDS[spell.toLowerCase()];
          if (zoneSpellId) {
            for (const [sceneId, scene] of Object.entries(next.scenes)) {
              if (!scene.spellZones?.length) continue;
              const filtered = scene.spellZones.filter(
                (z) => !(z.caster === target.id && z.spellId === zoneSpellId),
              );
              if (filtered.length !== scene.spellZones.length) {
                next.scenes[sceneId] = { ...scene, spellZones: filtered };
              }
            }
          }
          if (spell.toLowerCase() === "spirit guardians") {
            next.entities[target.id] = {
              ...next.entities[target.id]!,
              activeSpiritGuardians: undefined,
            };
          }
          if (spell.toLowerCase() === "spiritual weapon") {
            next.entities[target.id] = {
              ...next.entities[target.id]!,
              activeSpiritualWeapon: undefined,
            };
          }
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
        const removed = (target.effects ?? []).find(
          (fx) => fx.id === event.payload.effectId,
        );
        const effects = (target.effects ?? []).filter(
          (fx) => fx.id !== event.payload.effectId,
        );
        const updates: EntityState = { ...target, effects };
        if (removed?.name === "Haste") {
          updates.hasteLethargy = true;
          updates.conditions = [
            ...(target.conditions ?? []).filter(
              (c) => c.condition !== "incapacitated",
            ),
            { condition: "incapacitated", source: removed.source },
          ];
        }
        next.entities[target.id] = updates;
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
    case "PendingAttackStaged": {
      if (next.encounter) {
        next.encounter = {
          ...next.encounter,
          pendingAttack: {
            cmd: event.payload.cmd,
            natural: event.payload.natural,
            total: event.payload.total,
            targetAc: event.payload.targetAc,
            hit: event.payload.hit,
            critical: event.payload.critical,
            mode: event.payload.mode,
            hadBardicInspiration: event.payload.hadBardicInspiration,
            eligible: [...event.payload.eligible],
            declined: [...event.payload.declined],
            spendsAction: event.payload.spendsAction,
            spendsBonusAction: event.payload.spendsBonusAction,
            spendsFlurryAttack: event.payload.spendsFlurryAttack,
            viaReaction: event.payload.viaReaction,
            targetPosition: event.payload.targetPosition,
          },
        };
      }
      break;
    }
    case "PendingAttackUpdated": {
      if (next.encounter?.pendingAttack) {
        next.encounter = {
          ...next.encounter,
          pendingAttack: {
            ...next.encounter.pendingAttack,
            declined: [...event.payload.declined],
          },
        };
      }
      break;
    }
    case "ActionSurgeGranted": {
      const entity = next.entities[event.payload.entity];
      if (entity?.actionEconomy) {
        next.entities[entity.id] = {
          ...entity,
          actionEconomy: {
            ...entity.actionEconomy,
            action: "available",
            attacks: { ...entity.actionEconomy.attacks, used: 0 },
          },
        };
      }
      break;
    }
    case "PendingSpellCastStaged": {
      if (next.encounter) {
        next.encounter = {
          ...next.encounter,
          pendingSpellCast: {
            cmd: event.payload.cmd,
            slotLevel: event.payload.slotLevel,
            eligible: [...event.payload.eligible],
            declined: [...event.payload.declined],
          },
        };
      }
      break;
    }
    case "PendingSpellCastUpdated": {
      if (next.encounter?.pendingSpellCast) {
        next.encounter = {
          ...next.encounter,
          pendingSpellCast: {
            ...next.encounter.pendingSpellCast,
            declined: [...event.payload.declined],
          },
        };
      }
      break;
    }
    case "SpellCastCancelled": {
      if (next.encounter?.pendingSpellCast) {
        next.encounter = { ...next.encounter, pendingSpellCast: undefined };
      }
      break;
    }
    case "CreatureRevived": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = {
          ...target,
          hp: { ...target.hp, current: event.payload.hp },
          alive: true,
          dead: false,
          deathSaves: undefined,
          stable: false,
        };
      }
      break;
    }
    case "PendingIndomitableResolved": {
      if (
        next.encounter?.pendingIndomitable?.entity === event.payload.entity
      ) {
        next.encounter = { ...next.encounter, pendingIndomitable: undefined };
      }
      break;
    }
    case "SpiritualWeaponSummoned": {
      const caster = next.entities[event.payload.caster];
      if (caster) {
        next.entities[caster.id] = {
          ...caster,
          activeSpiritualWeapon: {
            instanceId: event.payload.instanceId,
            slotLevel: event.payload.slotLevel,
            roundsRemaining: event.payload.roundsRemaining,
          },
        };
      }
      break;
    }
    case "SpiritualWeaponTicked": {
      const caster = next.entities[event.payload.caster];
      if (caster?.activeSpiritualWeapon) {
        next.entities[caster.id] = {
          ...caster,
          activeSpiritualWeapon: {
            ...caster.activeSpiritualWeapon,
            roundsRemaining: event.payload.roundsRemaining,
          },
        };
      }
      break;
    }
    case "SpiritualWeaponDismissed": {
      const caster = next.entities[event.payload.caster];
      if (caster) {
        next.entities[caster.id] = {
          ...caster,
          activeSpiritualWeapon: undefined,
        };
      }
      break;
    }
    case "SpiritGuardiansStarted": {
      const caster = next.entities[event.payload.caster];
      if (caster) {
        next.entities[caster.id] = {
          ...caster,
          activeSpiritGuardians: {
            instanceId: event.payload.instanceId,
            slotLevel: event.payload.slotLevel,
          },
        };
      }
      break;
    }
    case "SpellZoneCreated": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene) {
        const spellZones = [...(scene.spellZones ?? [])];
        spellZones.push({
          instanceId: event.payload.instanceId,
          spellId: event.payload.spellId,
          caster: event.payload.caster,
          slotLevel: event.payload.slotLevel,
          origin: event.payload.origin,
          cells: [...event.payload.cells],
        });
        next.scenes[event.payload.sceneId] = { ...scene, spellZones };
      }
      break;
    }
    case "SpellZoneRemoved": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene?.spellZones?.length) {
        next.scenes[event.payload.sceneId] = {
          ...scene,
          spellZones: scene.spellZones.filter(
            (z) => z.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "PolymorphApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const beastHp = Math.min(
          event.payload.beastMaxHp,
          event.payload.storedHpCurrent,
        );
        next.entities[target.id] = {
          ...target,
          polymorph: {
            caster: event.payload.caster,
            beastSlug: event.payload.beastSlug,
            beastName: event.payload.beastName,
            storedAbilityScores: { ...event.payload.storedAbilityScores },
            storedMaxHp: event.payload.storedMaxHp,
            storedBaseAc: event.payload.storedBaseAc,
            storedSpeed: event.payload.storedSpeed,
            storedHpCurrent: event.payload.storedHpCurrent,
          },
          abilityScores: { ...event.payload.beastAbilityScores },
          hp: {
            ...target.hp,
            max: event.payload.beastMaxHp,
            current: beastHp,
          },
          baseAc: event.payload.beastAc,
          speed: event.payload.beastSpeed,
          conditions: target.conditions.filter((c) => c.condition !== "restrained"),
        };
      }
      break;
    }
    case "PolymorphEnded": {
      const target = next.entities[event.payload.target];
      if (target?.polymorph) {
        const stored = target.polymorph;
        const hpCurrent =
          event.payload.reason === "zero_hp" ? 0 : stored.storedHpCurrent;
        next.entities[target.id] = {
          ...target,
          polymorph: undefined,
          abilityScores: { ...stored.storedAbilityScores },
          hp: {
            ...target.hp,
            max: stored.storedMaxHp,
            current: Math.min(hpCurrent, stored.storedMaxHp),
          },
          baseAc: stored.storedBaseAc,
          speed: stored.storedSpeed,
          alive: hpCurrent > 0,
          dead: hpCurrent <= 0 ? target.dead : false,
        };
      }
      break;
    }
    case "CreatureBanished": {
      const target = next.entities[event.payload.target];
      if (target) {
        next.entities[target.id] = {
          ...target,
          banishment: {
            caster: event.payload.caster,
            returnSceneId: event.payload.returnSceneId,
            returnPosition: { ...event.payload.returnPosition },
          },
          position: undefined,
          conditions: [
            ...target.conditions.filter((c) => c.condition !== "incapacitated"),
            {
              condition: "incapacitated",
              source: event.payload.caster,
              concentrationSpell: "Banishment",
              concentrationHolder: event.payload.caster,
            },
          ],
        };
      }
      break;
    }
    case "CreatureReturned": {
      const target = next.entities[event.payload.target];
      if (target?.banishment) {
        const stored = target.banishment;
        next.entities[target.id] = {
          ...target,
          banishment: undefined,
          sceneId: stored.returnSceneId,
          position: { ...stored.returnPosition },
          conditions: target.conditions.filter(
            (c) => c.condition !== "incapacitated",
          ),
        };
      }
      break;
    }
    case "DungeonThresholdOpened": {
      next.dungeonProgress = {
        dungeonEntityId: event.payload.dungeonEntityId,
        thresholdOpened: true,
        currentFloorIndex: event.payload.floorIndex,
        visitedZoneIds: next.dungeonProgress?.visitedZoneIds ?? [],
        clearedZoneIds: next.dungeonProgress?.clearedZoneIds ?? [],
        activeEncounterZoneId: event.payload.entryZoneId,
      };
      break;
    }
    case "ZoneVisited": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const visited = new Set(progress.visitedZoneIds);
        visited.add(event.payload.zoneId);
        next.dungeonProgress = {
          ...progress,
          visitedZoneIds: [...visited].sort(),
          currentFloorIndex: event.payload.floorIndex,
        };
      }
      break;
    }
    case "ZoneCleared": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const cleared = new Set(progress.clearedZoneIds);
        cleared.add(event.payload.zoneId);
        next.dungeonProgress = {
          ...progress,
          clearedZoneIds: [...cleared].sort(),
        };
      }
      break;
    }
    case "DungeonLayoutSet": {
      next.dungeonLayouts = {
        ...next.dungeonLayouts,
        [event.payload.dungeonEntityId]: {
          floors: event.payload.floors,
          openedConnectionIds: [...event.payload.openedConnectionIds].sort(),
        },
      };
      break;
    }
    case "ConnectionOpened": {
      const layout = next.dungeonLayouts?.[event.payload.dungeonEntityId];
      if (layout) {
        const opened = new Set(layout.openedConnectionIds);
        opened.add(event.payload.connectionId);
        next.dungeonLayouts = {
          ...next.dungeonLayouts,
          [event.payload.dungeonEntityId]: {
            ...layout,
            openedConnectionIds: [...opened].sort(),
          },
        };
      }
      break;
    }
    case "CreatureDetected": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const pair = `${event.payload.detectorId}->${event.payload.detectedId}`;
        const detectedPairs = [...new Set([...(progress.detectedPairs ?? []), pair])].sort();
        next.dungeonProgress = {
          ...progress,
          detectedPairs,
          activeEncounterZoneId:
            progress.activeEncounterZoneId ?? event.payload.zoneId,
        };
      }
      break;
    }
    case "ZoneAlerted": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const alerted = new Set(progress.alertedZoneIds ?? []);
        alerted.add(event.payload.zoneId);
        next.dungeonProgress = {
          ...progress,
          alertedZoneIds: [...alerted].sort(),
        };
      }
      break;
    }
    case "ObjectTaken": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        next.dungeonProgress = {
          ...progress,
          objectStates: {
            ...progress.objectStates,
            [event.payload.objectId]: {
              zoneId: event.payload.zoneId,
              takenByEntityId: event.payload.actor,
            },
          },
        };
      }
      break;
    }
    case "FogRevealed": {
      const { entity, sceneId, cells } = event.payload;
      const perEntity = { ...(next.dungeonFog?.[entity] ?? {}) };
      const existing = new Set(perEntity[sceneId] ?? []);
      for (const cell of cells) {
        existing.add(`${cell.x},${cell.y}`);
      }
      perEntity[sceneId] = [...existing].sort();
      next.dungeonFog = {
        ...next.dungeonFog,
        [entity]: perEntity,
      };
      break;
    }
    case "ZoneDiscovered": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const discovered = new Set(progress.discoveredZoneIds ?? []);
        discovered.add(event.payload.zoneId);
        next.dungeonProgress = {
          ...progress,
          discoveredZoneIds: [...discovered].sort(),
        };
      }
      break;
    }
    case "ScoutRevealShared":
      break;
    case "PatrolSpawned": {
      const p = event.payload;
      next.entities[p.entityId] = createEntityState({
        id: p.entityId,
        kind: "monster",
        name: p.name,
        abilityScores: p.abilityScores,
        maxHp: p.maxHp,
        baseAc: p.baseAc,
        speed: p.speed,
        sceneId: p.sceneId,
        position: { ...p.cell },
      });
      const progress = next.dungeonProgress;
      if (progress && progress.dungeonEntityId === p.dungeonEntityId) {
        next.dungeonProgress = {
          ...progress,
          patrolStates: {
            ...progress.patrolStates,
            [p.patrolId]: {
              patrolId: p.patrolId,
              entityId: p.entityId,
              floorIndex: p.floorIndex,
              waypointIndex: 0,
            },
          },
        };
      }
      break;
    }
    case "PatrolMoved": {
      const p = event.payload;
      const entity = next.entities[p.entityId];
      if (entity) {
        next.entities[p.entityId] = {
          ...entity,
          sceneId: p.sceneId,
          position: { ...p.to },
        };
      }
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === p.dungeonEntityId &&
        progress.patrolStates?.[p.patrolId]
      ) {
        next.dungeonProgress = {
          ...progress,
          patrolStates: {
            ...progress.patrolStates,
            [p.patrolId]: {
              ...progress.patrolStates[p.patrolId]!,
              waypointIndex: p.waypointIndex,
            },
          },
        };
      }
      break;
    }
    case "PatrolsReset":
      break;
    case "DungeonRoomEntered": {
      const zoneId = event.payload.roomIndex === 0 ? "entry" : `zone-${event.payload.roomIndex}`;
      next.dungeonProgress = {
        dungeonEntityId: event.payload.dungeonEntityId,
        thresholdOpened: true,
        currentFloorIndex: event.payload.floorIndex,
        visitedZoneIds: [
          ...new Set([
            ...(next.dungeonProgress?.visitedZoneIds ?? []),
            zoneId,
          ]),
        ].sort(),
        clearedZoneIds: next.dungeonProgress?.clearedZoneIds ?? [],
        activeEncounterZoneId: zoneId,
      };
      break;
    }
    case "DungeonRoomCleared": {
      const progress = next.dungeonProgress;
      if (
        progress &&
        progress.dungeonEntityId === event.payload.dungeonEntityId
      ) {
        const zoneId =
          event.payload.roomIndex === 0 ? "entry" : `zone-${event.payload.roomIndex}`;
        const cleared = new Set(progress.clearedZoneIds);
        cleared.add(zoneId);
        next.dungeonProgress = {
          ...progress,
          clearedZoneIds: [...cleared].sort(),
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
        if (event.payload.sneakAttack) {
          ae = { ...ae, sneakAttackUsed: true };
        }
        if (event.payload.colossusSlayer) {
          ae = { ...ae, colossusSlayerUsed: true };
        }
        if (event.payload.flurryAttacksGranted != null) {
          ae = {
            ...ae,
            flurryAttacksRemaining: event.payload.flurryAttacksGranted,
          };
        }
        if (event.payload.flurryAttack) {
          ae = {
            ...ae,
            flurryAttacksRemaining: Math.max(
              0,
              (ae.flurryAttacksRemaining ?? 0) - 1,
            ),
          };
        }
        if (event.payload.stunningStrike) {
          ae = { ...ae, stunningStrikeUsed: true };
        }
        if (event.payload.bonusAction) {
          ae = { ...ae, bonusAction: "used" };
        }
        if (event.payload.extraAction) {
          ae = { ...ae, extraAction: "used" };
        }
        next.entities[entity.id] = { ...entity, actionEconomy: ae };
      }
      break;
    }
    case "FeaturePoolSpent": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = {
          ...entity,
          resourceUses: {
            ...(entity.resourceUses ?? {}),
            [event.payload.featureKey]: [...event.payload.resourceUses],
          },
        };
      }
      break;
    }
    case "DashMovementGranted": {
      const entity = next.entities[event.payload.entity];
      if (entity?.actionEconomy) {
        next.entities[entity.id] = {
          ...entity,
          actionEconomy: {
            ...entity.actionEconomy,
            movement: {
              ...entity.actionEconomy.movement,
              total:
                entity.actionEconomy.movement.total + event.payload.bonusFeet,
            },
          },
        };
      }
      break;
    }
    case "Disengaged": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = { ...entity, disengaged: true };
      }
      break;
    }
    case "DodgingStarted": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = { ...entity, dodging: true };
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
    case "SpellSlotRecovered": {
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
                  current: Math.min(slot.max, slot.current + 1),
                },
              },
            },
          };
        }
      }
      break;
    }
    case "SpellCast": {
      if (next.encounter?.pendingSpellCast) {
        next.encounter = { ...next.encounter, pendingSpellCast: undefined };
      }
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
    case "TrapDetected": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene?.traps) {
        next.scenes = {
          ...next.scenes,
          [event.payload.sceneId]: {
            ...scene,
            traps: scene.traps.map((t) =>
              t.instanceId === event.payload.trapInstanceId && event.payload.success
                ? { ...t, detected: true }
                : t,
            ),
          },
        };
      }
      break;
    }
    case "TrapDisabled": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene?.traps && event.payload.success) {
        next.scenes = {
          ...next.scenes,
          [event.payload.sceneId]: {
            ...scene,
            traps: scene.traps.map((t) =>
              t.instanceId === event.payload.trapInstanceId
                ? { ...t, disabled: true }
                : t,
            ),
          },
        };
      }
      break;
    }
    case "TrapTriggered": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene?.traps) {
        next.scenes = {
          ...next.scenes,
          [event.payload.sceneId]: {
            ...scene,
            traps: scene.traps.map((t) =>
              t.instanceId === event.payload.trapInstanceId
                ? { ...t, triggered: true }
                : t,
            ),
          },
        };
      }
      break;
    }
    case "WeaponCoated": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = {
          ...entity,
          coatedPoisonSlug: event.payload.poisonSlug,
        };
      }
      break;
    }
    case "PoisonCoatingCleared": {
      const entity = next.entities[event.payload.entity];
      if (entity) {
        next.entities[entity.id] = { ...entity, coatedPoisonSlug: undefined };
      }
      break;
    }
    case "PoisonApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const activePoisons = [...(target.activePoisons ?? [])];
        activePoisons.push({
          instanceId: event.payload.instanceId,
          poisonSlug: event.payload.poisonSlug,
          pendingRepeat: event.payload.pendingRepeat,
        });
        next.entities[target.id] = { ...target, activePoisons };
      }
      if (event.payload.source) {
        const source = next.entities[event.payload.source];
        if (source?.coatedPoisonSlug === event.payload.poisonSlug) {
          next.entities[source.id] = { ...source, coatedPoisonSlug: undefined };
        }
      }
      break;
    }
    case "PoisonRemoved": {
      const target = next.entities[event.payload.target];
      if (target?.activePoisons?.length) {
        next.entities[target.id] = {
          ...target,
          activePoisons: target.activePoisons.filter(
            (p) => p.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "PoisonRepeatProgressed": {
      const target = next.entities[event.payload.target];
      if (target?.activePoisons?.length) {
        next.entities[target.id] = {
          ...target,
          activePoisons: target.activePoisons.map((p) =>
            p.instanceId === event.payload.instanceId
              ? { ...p, repeatSuccesses: event.payload.repeatSuccesses }
              : p,
          ),
        };
      }
      break;
    }
    case "MaxHpReduced": {
      const target = next.entities[event.payload.target];
      if (target) {
        const hp = {
          ...target.hp,
          max: event.payload.hpMaxAfter,
          current: clampHp(target.hp.current, event.payload.hpMaxAfter),
        };
        next.entities[target.id] = { ...target, hp };
      }
      break;
    }
    case "CurseApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const activeCurses = [...(target.activeCurses ?? [])];
        activeCurses.push({
          instanceId: event.payload.instanceId,
          curseSlug: event.payload.curseSlug,
          pendingRecovery: event.payload.pendingRecovery,
        });
        next.entities[target.id] = { ...target, activeCurses };
      }
      break;
    }
    case "CurseRemoved": {
      const target = next.entities[event.payload.target];
      if (target?.activeCurses?.length) {
        next.entities[target.id] = {
          ...target,
          activeCurses: target.activeCurses.filter(
            (c) => c.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "SceneEnvironmentalEffectsSet": {
      const scene = next.scenes[event.payload.sceneId];
      if (scene) {
        next.scenes[event.payload.sceneId] = {
          ...scene,
          environmentalEffectSlugs: [...event.payload.slugs],
        };
      }
      break;
    }
    case "EnvironmentalEffectApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const activeEnvironmentalEffects = [
          ...(target.activeEnvironmentalEffects ?? []),
        ];
        activeEnvironmentalEffects.push({
          instanceId: event.payload.instanceId,
          effectSlug: event.payload.effectSlug,
          pendingRepeat: event.payload.pendingRepeat,
        });
        next.entities[target.id] = { ...target, activeEnvironmentalEffects };
      }
      break;
    }
    case "EnvironmentalEffectRemoved": {
      const target = next.entities[event.payload.target];
      if (target?.activeEnvironmentalEffects?.length) {
        next.entities[target.id] = {
          ...target,
          activeEnvironmentalEffects: target.activeEnvironmentalEffects.filter(
            (i) => i.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "FearStressApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const activeFearStress = [...(target.activeFearStress ?? [])];
        activeFearStress.push({
          instanceId: event.payload.instanceId,
          fearStressSlug: event.payload.fearStressSlug,
          pendingRepeat: event.payload.pendingRepeat,
          boundSceneId: event.payload.boundSceneId,
        });
        next.entities[target.id] = { ...target, activeFearStress };
      }
      break;
    }
    case "FearStressRemoved": {
      const target = next.entities[event.payload.target];
      if (target?.activeFearStress?.length) {
        next.entities[target.id] = {
          ...target,
          activeFearStress: target.activeFearStress.filter(
            (i) => i.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "BurningApplied": {
      const target = next.entities[event.payload.target];
      if (target) {
        const activeBurning = [...(target.activeBurning ?? [])];
        activeBurning.push({
          instanceId: event.payload.instanceId,
          burningSlug: event.payload.burningSlug,
          pendingRepeat: event.payload.pendingRepeat,
        });
        next.entities[target.id] = { ...target, activeBurning };
      }
      break;
    }
    case "BurningRemoved": {
      const target = next.entities[event.payload.target];
      if (target?.activeBurning?.length) {
        next.entities[target.id] = {
          ...target,
          activeBurning: target.activeBurning.filter(
            (i) => i.instanceId !== event.payload.instanceId,
          ),
        };
      }
      break;
    }
    case "Rested":
      break;
    case "AttackResolved": {
      if (next.encounter?.pendingAttack) {
        next.encounter = { ...next.encounter, pendingAttack: undefined };
      }
      const attacker = next.entities[event.payload.attacker];
      if (attacker) {
        let effects = attacker.effects;
        if (attacker.effects?.some((fx) => fx.modifier.type === "help_attack")) {
          effects = stripHelpAttackEffect(attacker, event.payload.target);
        }
        if (event.payload.bardicInspirationUsed) {
          effects = stripOneBardicInspiration({ ...attacker, effects });
        }
        if (effects !== attacker.effects) {
          next.entities[attacker.id] = { ...attacker, effects };
        }
      }
      break;
    }
    case "SaveRolled": {
      if (
        !event.payload.success &&
        !event.payload.autoFail &&
        !event.payload.indomitableReroll &&
        next.encounter
      ) {
        const entity = next.entities[event.payload.entity];
        if (entity && indomitableAvailable(entity)) {
          next.encounter = {
            ...next.encounter,
            pendingIndomitable: {
              entity: event.payload.entity,
              ability: event.payload.ability,
              dc: event.payload.dc,
            },
          };
        }
      }
      break;
    }
    case "CheckRolled": {
      const entity = next.entities[event.payload.entity];
      if (entity?.effects?.some((fx) => fx.modifier.type === "help_check")) {
        next.entities[entity.id] = {
          ...entity,
          effects: stripHelpCheckEffects(entity),
        };
      }
      break;
    }
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
