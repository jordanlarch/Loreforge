/**
 * Tutorial combat planning (TUT-1 Scene 5, #174) — pure, LLM-free helpers.
 *
 * Scene 5 reuses the real combat surface + deterministic engine (D1/D3); only
 * the *tactics* of the companion and the scripted beats live here, so the same
 * engine rules (initiative, action economy, saves, reactions) govern the fight.
 * Everything is pure so it is unit-testable and runs air-gapped:
 *
 *  - `planCompanionTurn` — Old Brennar's AI: heal the lead when she's hurt or
 *    down (the safety net), else Sacred Flame the foe.
 *  - `shadeFleeMove` — the scripted disengage that provokes the player's one
 *    Opportunity-Attack reaction beat.
 *  - `tutorialCombatOver` / `partyReactionPending` / `activeCombatant` — the
 *    small state predicates the ws driver loops on.
 */
import {
  bestStepToward,
  movementCellsLeft,
  reachableCells,
} from "./enemy-ai.js";
import {
  castAction,
  distanceFeet,
  moveAction,
  REACH_FEET,
  FIXTURE_BATTLE_PARTY_SIDE,
  TUTORIAL_COMPANION,
  TUTORIAL_FOES_SIDE,
  TUTORIAL_SHADE_ID,
  type BattleAction,
  type EntityState,
  type GridPosition,
  type WorldState,
} from "@app/engine";

/** The companion's stable engine entity id (Old Brennar). */
export const COMPANION_ID = TUTORIAL_COMPANION.id;

/**
 * Heal the lead at or below this HP (generous, so she is topped up well before
 * the Shade's ~1d6+3 bite could ever drop her — the "never truly threatened"
 * tuning from the tutorial spec).
 */
export const COMPANION_HEAL_THRESHOLD = 12;

/** The active combatant on its initiative slot, or undefined outside combat. */
export function activeCombatant(state: WorldState): EntityState | undefined {
  const enc = state.encounter;
  if (!enc || !enc.initiativeRolled || enc.order.length === 0) return undefined;
  const ref = enc.order[enc.activeIndex]?.entity;
  return ref ? state.entities[ref] : undefined;
}

/** The party-side player character (Mira) — the one combatant that isn't the
 * companion. The safety net + companion healing key off her HP. */
export function leadPc(state: WorldState): EntityState | undefined {
  const enc = state.encounter;
  const ids = enc ? enc.combatants : Object.keys(state.entities);
  for (const id of ids) {
    const e = state.entities[id];
    if (!e || e.kind !== "character" || e.id === COMPANION_ID) continue;
    if (enc && enc.sides[e.id] !== FIXTURE_BATTLE_PARTY_SIDE) continue;
    return e;
  }
  return undefined;
}

/** True once every foe-side combatant is down (victory). */
export function tutorialCombatOver(state: WorldState): boolean {
  const enc = state.encounter;
  if (!enc) return false;
  const foes = enc.combatants.filter((id) => enc.sides[id] === TUTORIAL_FOES_SIDE);
  return foes.length > 0 && foes.every((id) => !state.entities[id]?.alive);
}

/** True while a *party-side* reactor still has an open reaction window — the
 * driver pauses on this so the player gets their Opportunity-Attack prompt. */
export function partyReactionPending(state: WorldState): boolean {
  const enc = state.encounter;
  const window = enc?.reactionWindow;
  if (!enc || !window) return false;
  return window.eligible.some(
    (id) =>
      enc.sides[id] === FIXTURE_BATTLE_PARTY_SIDE &&
      state.entities[id]?.reaction === "available",
  );
}

/**
 * Plan Old Brennar's turn (the AI companion): if the lead is hurt or downed and
 * he still has a 1st-level slot, step adjacent and cast Cure Wounds on her (the
 * safety net + a healing demo); otherwise Sacred Flame the foe. Always ends the
 * turn so the loop advances. The engine validates every step.
 */
export function planCompanionTurn(
  state: WorldState,
  foeId: string = TUTORIAL_SHADE_ID,
): BattleAction[] {
  const end: BattleAction = { type: "end_turn" };
  const me = state.entities[COMPANION_ID];
  if (!me || !me.alive || !me.position) return [end];

  const lead = leadPc(state);
  const slot1 = me.spellcasting?.slots?.[1]?.current ?? 0;
  const leadNeedsHeal =
    !!lead && !lead.dead && lead.hp.current <= COMPANION_HEAL_THRESHOLD;

  if (leadNeedsHeal && slot1 > 0 && lead.position) {
    const actions: BattleAction[] = [];
    // Cure Wounds is touch — close to within reach first if needed.
    if (distanceFeet(me.position, lead.position) > REACH_FEET) {
      const step = bestStepToward(state, me, lead);
      if (step) actions.push(moveAction(COMPANION_ID, step));
    }
    actions.push(castAction(COMPANION_ID, "cure-wounds", 1, [lead.id]));
    actions.push(end);
    return actions;
  }

  const foe = state.entities[foeId];
  if (foe && foe.alive) {
    // Sacred Flame: a 60ft Dex-save cantrip — no movement needed on this map.
    return [castAction(COMPANION_ID, "sacred-flame", 0, [foeId]), end];
  }
  return [end];
}

/**
 * The scripted disengage that fires the player's Opportunity-Attack beat: a
 * reachable cell that breaks the Shade's reach on the lead (so leaving provokes
 * her OA) and lunges toward the companion. Returns undefined when the Shade
 * isn't adjacent to the lead or can't break away — the caller then plays a
 * normal Shade turn.
 */
export function shadeFleeMove(
  state: WorldState,
  foeId: string = TUTORIAL_SHADE_ID,
): GridPosition | undefined {
  const shade = state.entities[foeId];
  const lead = leadPc(state);
  if (!shade?.position || !lead?.position) return undefined;
  if (distanceFeet(shade.position, lead.position) > REACH_FEET) return undefined;

  const budget = movementCellsLeft(shade);
  const away = reachableCells(state, shade, budget).filter(
    (c) => distanceFeet(c, lead.position!) > REACH_FEET,
  );
  if (away.length === 0) return undefined;

  const anchor = state.entities[COMPANION_ID]?.position ?? lead.position;
  return away.reduce((a, b) =>
    distanceFeet(b, anchor) < distanceFeet(a, anchor) ? b : a,
  );
}
