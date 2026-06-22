import { describe, expect, it } from "vitest";

import type { EntityState, GridPosition, WorldState } from "@app/engine";

import {
  activeEnemy,
  enemyTargets,
  isPlayerControlled,
  monsterAttackProfile,
  planMonsterTurn,
} from "./enemy-ai.js";

function ent(
  over: Partial<EntityState> & { id: string; position: GridPosition },
): EntityState {
  return {
    kind: "monster",
    name: over.id,
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    hp: { current: 7, max: 7, temp: 0 },
    baseAc: 15,
    speed: 30,
    classes: [],
    proficiencyBonus: 2,
    alive: true,
    conditions: [],
    dead: false,
    sceneId: "s1",
    ...over,
  } as unknown as EntityState;
}

/** Active-turn action economy with a configurable movement budget (in feet). */
function turnEconomy(totalFt = 30) {
  return {
    action: "available",
    bonusAction: "available",
    reaction: "available",
    freeInteractionUsed: false,
    movement: { total: totalFt, used: 0 },
  } as const;
}

function battle(
  entities: EntityState[],
  sides: Record<string, string>,
  activeIndex = 0,
): WorldState {
  return {
    campaignId: "c1",
    currentSceneId: "s1",
    scenes: {
      s1: {
        id: "s1",
        name: "Arena",
        map: { width: 12, height: 10, blockedCells: [] },
      },
    },
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    encounter: {
      sceneId: "s1",
      combatants: entities.map((e) => e.id),
      sides,
      order: entities.map((e) => ({ entity: e.id })),
      initiativeRolled: true,
      round: 1,
      activeIndex,
    },
    lastSequence: 1,
  } as unknown as WorldState;
}

const SIDES = { goblin: "foes", hero: "party", mage: "party" };

describe("isPlayerControlled / activeEnemy", () => {
  it("identifies the party side as player-controlled", () => {
    const state = battle(
      [
        ent({ id: "goblin", position: { x: 9, y: 3 } }),
        ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } }),
      ],
      SIDES,
    );
    expect(isPlayerControlled(state, "hero")).toBe(true);
    expect(isPlayerControlled(state, "goblin")).toBe(false);
  });

  it("returns the active enemy, and nothing on a PC's turn", () => {
    const entities = [
      ent({ id: "goblin", position: { x: 9, y: 3 } }),
      ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } }),
    ];
    expect(activeEnemy(battle(entities, SIDES, 0))?.id).toBe("goblin");
    expect(activeEnemy(battle(entities, SIDES, 1))).toBeUndefined();
  });
});

describe("monsterAttackProfile", () => {
  it("derives attack bonus + damage from scores and proficiency", () => {
    const goblin = ent({ id: "goblin", position: { x: 0, y: 0 } });
    const profile = monsterAttackProfile(goblin);
    expect(profile.attackBonus).toBe(4); // +2 DEX + 2 prof
    expect(profile.damage).toEqual({ notation: "1d6+2", type: "slashing" });
  });
});

describe("enemyTargets", () => {
  it("returns alive hostile PCs in the scene", () => {
    const state = battle(
      [
        ent({ id: "goblin", position: { x: 9, y: 3 } }),
        ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } }),
        ent({
          id: "mage",
          kind: "character",
          position: { x: 3, y: 3 },
          alive: false,
        }),
      ],
      SIDES,
    );
    const targets = enemyTargets(state, state.entities.goblin!).map((e) => e.id);
    expect(targets).toEqual(["hero"]); // dead mage excluded
  });
});

describe("planMonsterTurn", () => {
  it("attacks an adjacent foe, then ends the turn", () => {
    const goblin = ent({
      id: "goblin",
      position: { x: 8, y: 3 },
      actionEconomy: turnEconomy(),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 9, y: 3 } });
    const plan = planMonsterTurn(battle([goblin, hero], SIDES), "goblin");
    expect(plan.map((a) => a.type)).toEqual(["attack", "end_turn"]);
    const attack = plan[0] as { target: string };
    expect(attack.target).toBe("hero");
  });

  it("closes the gap and attacks when the move lands in reach", () => {
    const goblin = ent({
      id: "goblin",
      position: { x: 9, y: 3 },
      actionEconomy: turnEconomy(30), // 6 cells
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } });
    const plan = planMonsterTurn(battle([goblin, hero], SIDES), "goblin");
    expect(plan.map((a) => a.type)).toEqual(["move_entity", "attack", "end_turn"]);
    const move = plan[0] as { to: GridPosition };
    // Reached the cell adjacent to the hero (x=3 is 6 cells from x=9).
    expect(Math.max(Math.abs(move.to.x - 2), Math.abs(move.to.y - 3))).toBe(1);
  });

  it("just advances when the target stays out of reach", () => {
    const goblin = ent({
      id: "goblin",
      position: { x: 9, y: 3 },
      actionEconomy: turnEconomy(30), // 6 cells → reaches x=3
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 0, y: 3 } });
    const plan = planMonsterTurn(battle([goblin, hero], SIDES), "goblin");
    expect(plan.map((a) => a.type)).toEqual(["move_entity", "end_turn"]);
  });

  it("ends the turn with no movement and no adjacent foe", () => {
    const goblin = ent({
      id: "goblin",
      position: { x: 9, y: 3 },
      actionEconomy: turnEconomy(0),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } });
    const plan = planMonsterTurn(battle([goblin, hero], SIDES), "goblin");
    expect(plan.map((a) => a.type)).toEqual(["end_turn"]);
  });

  it("ends the turn when dead or targetless", () => {
    const dead = ent({
      id: "goblin",
      position: { x: 9, y: 3 },
      alive: false,
      actionEconomy: turnEconomy(),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } });
    expect(planMonsterTurn(battle([dead, hero], SIDES), "goblin")).toEqual([
      { type: "end_turn" },
    ]);
  });

  it("honours a legal preferred target and ignores an illegal one", () => {
    // Both PCs are reachable this turn; the planner closes on, and attacks,
    // whichever target it selects.
    const goblin = ent({
      id: "goblin",
      position: { x: 5, y: 5 },
      actionEconomy: turnEconomy(30), // 6 cells
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 0, y: 5 } });
    const mage = ent({ id: "mage", kind: "character", position: { x: 11, y: 5 } });
    const state = battle([goblin, hero, mage], SIDES);

    const attackOf = (plan: { type: string }[]): string =>
      (plan.find((a) => a.type === "attack") as { target: string }).target;

    // Default: nearest is the hero (5 cells vs the mage's 6).
    expect(attackOf(planMonsterTurn(state, "goblin"))).toBe("hero");
    // Legal preference overrides the nearest-target default.
    expect(attackOf(planMonsterTurn(state, "goblin", "mage"))).toBe("mage");
    // Illegal id is ignored → falls back to the nearest.
    expect(attackOf(planMonsterTurn(state, "goblin", "dragon"))).toBe("hero");
  });
});
