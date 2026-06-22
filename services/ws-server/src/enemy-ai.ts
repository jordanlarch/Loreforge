/**
 * Combat AI — autonomous enemy/NPC turns (PLAY combat loop).
 *
 * The deterministic engine owns ALL mechanics (Q12); this module is the *tactic*
 * layer the architecture calls the "AI Orchestrator" (`docs/engine/architecture.md`
 * §7.6): it decides what a non-player combatant tries to do, then the engine
 * validates + resolves it. Everything here is pure and LLM-free so it is fully
 * testable and so combat is two-sided even without an `ANTHROPIC_API_KEY`. The
 * optional LLM layer (target selection + narration) lives in `narration.ts` and
 * only *refines* the deterministic plan, mirroring the #97 check orchestrator:
 * the model proposes, the engine disposes.
 *
 * Tracer scope: basic melee. A monster moves toward the nearest hostile PC within
 * its movement budget and strikes when in reach; otherwise it ends its turn.
 * Spells/abilities, the encounter `AI tactics hint`, and multiattack are deferred.
 */
import {
  abilityModifier,
  areHostile,
  attackAction,
  distanceFeet,
  FEET_PER_CELL,
  FIXTURE_BATTLE_PARTY_SIDE,
  moveAction,
  REACH_FEET,
  type BattleAction,
  type EntityState,
  type GridPosition,
  type WorldState,
} from "@app/engine";

/** Whether `id` is controlled by the human player(s) (the party side). */
export function isPlayerControlled(state: WorldState, id: string): boolean {
  return state.encounter?.sides[id] === FIXTURE_BATTLE_PARTY_SIDE;
}

/**
 * The active combatant when it is *not* player-controlled — i.e. a turn the AI
 * orchestrator should run. Returns it even when dead so the driver can advance
 * past a downed enemy's turn (the planner ends it). Undefined when there is no
 * live encounter, when initiative hasn't been rolled, or when it's a PC's turn.
 */
export function activeEnemy(state: WorldState): EntityState | undefined {
  const enc = state.encounter;
  if (!enc || !enc.initiativeRolled || enc.order.length === 0) return undefined;
  const ref = enc.order[enc.activeIndex]?.entity;
  if (!ref) return undefined;
  const entity = state.entities[ref];
  if (!entity) return undefined;
  if (isPlayerControlled(state, ref)) return undefined;
  return entity;
}

/**
 * The opportunity attacks an AI reactor should take from the current reaction
 * window (combat loop): each AI-controlled, alive, reaction-ready combatant the
 * engine flagged as eligible, paired with the mover that provoked it. Mirrors
 * the client's `controllableReactors` but for the non-player side — players are
 * prompted (#58); these the orchestrator resolves automatically.
 */
export function aiOpportunityAttacks(
  state: WorldState,
): { reactor: EntityState; mover: EntityState }[] {
  const enc = state.encounter;
  const window = enc?.reactionWindow;
  if (!enc || !window) return [];
  const mover = state.entities[window.mover];
  if (!mover) return [];
  return window.eligible
    .filter((id) => !isPlayerControlled(state, id))
    .map((id) => state.entities[id])
    .filter(
      (e): e is EntityState =>
        e !== undefined && e.alive && e.reaction === "available",
    )
    .map((reactor) => ({ reactor, mover }));
}

/** Alive, placed combatants hostile to `monster` in the same scene. */
export function enemyTargets(
  state: WorldState,
  monster: EntityState,
): EntityState[] {
  const enc = state.encounter;
  if (!enc || !monster.position) return [];
  const mySide = enc.sides[monster.id];
  return Object.values(state.entities).filter(
    (e) =>
      e.id !== monster.id &&
      e.alive &&
      e.position !== undefined &&
      e.sceneId === monster.sceneId &&
      areHostile(mySide, enc.sides[e.id]),
  );
}

/** A monster's basic melee attack derived from its own scores + proficiency. */
export function monsterAttackProfile(monster: EntityState): {
  attackBonus: number;
  damage: { notation: string; type: string };
} {
  const str = abilityModifier(monster.abilityScores.str);
  const dex = abilityModifier(monster.abilityScores.dex);
  const mod = Math.max(str, dex);
  const attackBonus = monster.proficiencyBonus + mod;
  const sign = mod >= 0 ? `+${mod}` : `${mod}`;
  const notation = mod !== 0 ? `1d6${sign}` : "1d6";
  return { attackBonus, damage: { notation, type: "slashing" } };
}

/** Remaining movement, in whole cells (5-5-5: every step is 5 ft). */
function movementCells(monster: EntityState): number {
  const m = monster.actionEconomy?.movement;
  if (!m) return 0;
  return Math.floor((m.total - m.used) / FEET_PER_CELL);
}

function key(c: GridPosition): string {
  return `${c.x},${c.y}`;
}

/**
 * Cells the monster could legally end a move in: within its Chebyshev movement
 * budget, in-bounds, not a wall, not occupied. The engine validates the *square*
 * move cost (`distanceFeet`) against the budget, so any cell in this square is
 * affordable; we mirror its bounds/wall/occupancy checks so the plan is accepted.
 */
function reachableCells(
  state: WorldState,
  monster: EntityState,
  budgetCells: number,
): GridPosition[] {
  const scene = monster.sceneId ? state.scenes[monster.sceneId] : undefined;
  const map = scene?.map;
  if (!map || !monster.position) return [];
  const walls = new Set(map.blockedCells.map(key));
  const occupied = new Set(
    Object.values(state.entities)
      .filter(
        (e) =>
          e.alive &&
          e.id !== monster.id &&
          e.position !== undefined &&
          e.sceneId === monster.sceneId,
      )
      .map((e) => key(e.position!)),
  );
  const cells: GridPosition[] = [];
  const { x: ox, y: oy } = monster.position;
  for (let dx = -budgetCells; dx <= budgetCells; dx += 1) {
    for (let dy = -budgetCells; dy <= budgetCells; dy += 1) {
      if (dx === 0 && dy === 0) continue; // staying put isn't a move
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const k = `${x},${y}`;
      if (walls.has(k) || occupied.has(k)) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

/** The reachable cell that gets closest to `target` (tie-break: shortest step). */
function bestStepToward(
  state: WorldState,
  monster: EntityState,
  target: EntityState,
): GridPosition | undefined {
  const budget = movementCells(monster);
  if (budget <= 0 || !monster.position || !target.position) return undefined;
  let best: GridPosition | undefined;
  // Only accept a cell strictly closer to the target than standing still.
  let bestDist = distanceFeet(monster.position, target.position);
  let bestCost = Infinity;
  for (const cell of reachableCells(state, monster, budget)) {
    const dist = distanceFeet(cell, target.position);
    const cost = distanceFeet(monster.position, cell);
    if (dist < bestDist || (dist === bestDist && cost < bestCost)) {
      best = cell;
      bestDist = dist;
      bestCost = cost;
    }
  }
  return best;
}

/** Pick a target: the preferred (LLM) one when legal, else nearest then weakest. */
function pickTarget(
  monster: EntityState,
  targets: EntityState[],
  preferredTargetId?: string,
): EntityState {
  if (preferredTargetId) {
    const pref = targets.find((t) => t.id === preferredTargetId);
    if (pref) return pref;
  }
  return [...targets].sort((a, b) => {
    const da = distanceFeet(monster.position!, a.position!);
    const db = distanceFeet(monster.position!, b.position!);
    if (da !== db) return da - db;
    return a.hp.current - b.hp.current;
  })[0]!;
}

function lowestHp(entities: EntityState[]): EntityState {
  return entities.reduce((a, b) => (b.hp.current < a.hp.current ? b : a));
}

/**
 * Plan one non-player combatant's turn as an ordered list of engine actions
 * (always ending with `end_turn`). The engine still validates every step, so a
 * rejected action simply doesn't apply; ending the turn guarantees the loop
 * advances. `preferredTargetId` is an optional LLM hint, used only if it names a
 * currently-legal target (the #97 "model proposes, engine disposes" pattern).
 */
export function planMonsterTurn(
  state: WorldState,
  monsterId: string,
  preferredTargetId?: string,
): BattleAction[] {
  const monster = state.entities[monsterId];
  const endTurn: BattleAction = { type: "end_turn" };
  if (!monster || !monster.alive || !monster.position) return [endTurn];

  const targets = enemyTargets(state, monster);
  if (targets.length === 0) return [endTurn];

  const profile = monsterAttackProfile(monster);

  // Already adjacent to one or more foes → strike the weakest, then end.
  const inReach = targets.filter(
    (t) => distanceFeet(monster.position!, t.position!) <= REACH_FEET,
  );
  if (inReach.length > 0) {
    const victim = lowestHp(inReach);
    return [
      attackAction(monster.id, victim.id, profile.attackBonus, profile.damage),
      endTurn,
    ];
  }

  // Otherwise close on the chosen target; strike if the move lands in reach.
  const target = pickTarget(monster, targets, preferredTargetId);
  const step = bestStepToward(state, monster, target);
  if (step) {
    const actions: BattleAction[] = [moveAction(monster.id, step)];
    if (distanceFeet(step, target.position!) <= REACH_FEET) {
      actions.push(
        attackAction(monster.id, target.id, profile.attackBonus, profile.damage),
      );
    }
    actions.push(endTurn);
    return actions;
  }

  return [endTurn];
}
