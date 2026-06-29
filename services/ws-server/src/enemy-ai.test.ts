import { describe, expect, it } from "vitest";

import type {
  BattleAction,
  EntityState,
  GridPosition,
  WorldState,
} from "@app/engine";

import {
  activeEnemy,
  aiOpportunityAttacks,
  enemyTargets,
  isPlayerControlled,
  monsterAttackProfile,
  planMonsterTurn,
  planMonsterSpell,
  readiedTriggersToFire,
  readyTriggerRange,
} from "./enemy-ai.js";

/** A readied melee strike held by `entity` against `target`. */
function readied(target: string, trigger = "in_range:5") {
  return {
    trigger,
    action: {
      kind: "attack" as const,
      target,
      attackBonus: 5,
      damage: { notation: "1d8+3", type: "slashing" },
    },
  };
}

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
    reaction: "available",
    conditions: [],
    dead: false,
    sceneId: "s1",
    ...over,
  } as unknown as EntityState;
}

/** Active-turn action economy with a configurable movement budget (in feet). */
function turnEconomy(totalFt = 30, attacksTotal = 1) {
  return {
    action: "available",
    bonusAction: "available",
    reaction: "available",
    freeInteractionUsed: false,
    movement: { total: totalFt, used: 0 },
    attacks: { used: 0, total: attacksTotal },
  } as const;
}

function battle(
  entities: EntityState[],
  sides: Record<string, string>,
  activeIndex = 0,
  reactionWindow?: { mover: string; eligible: string[] },
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
      surpriseResolved: false,
      round: 1,
      activeIndex,
      ...(reactionWindow ? { reactionWindow } : {}),
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

describe("aiOpportunityAttacks", () => {
  const fleeing = () => [
    ent({ id: "goblin", position: { x: 9, y: 3 } }),
    ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } }),
  ];

  it("returns the AI reactor + mover when a window is open for it", () => {
    const state = battle(fleeing(), SIDES, 1, {
      mover: "hero",
      eligible: ["goblin"],
    });
    const oas = aiOpportunityAttacks(state);
    expect(oas).toHaveLength(1);
    expect(oas[0]!.reactor.id).toBe("goblin");
    expect(oas[0]!.mover.id).toBe("hero");
  });

  it("ignores a player-controlled eligible reactor (those are prompted)", () => {
    const state = battle(fleeing(), SIDES, 0, {
      mover: "goblin",
      eligible: ["hero"],
    });
    expect(aiOpportunityAttacks(state)).toEqual([]);
  });

  it("skips a reactor that has already used its reaction", () => {
    const entities = [
      ent({ id: "goblin", position: { x: 9, y: 3 }, reaction: "used" }),
      ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } }),
    ];
    const state = battle(entities, SIDES, 1, {
      mover: "hero",
      eligible: ["goblin"],
    });
    expect(aiOpportunityAttacks(state)).toEqual([]);
  });

  it("returns nothing without an open window", () => {
    expect(aiOpportunityAttacks(battle(fleeing(), SIDES))).toEqual([]);
  });
});

describe("readyTriggerRange", () => {
  it("parses the encoded feet, defaulting to melee reach", () => {
    expect(readyTriggerRange("in_range:30")).toBe(30);
    expect(readyTriggerRange("in_range:5")).toBe(5);
    expect(readyTriggerRange("enters_reach")).toBe(5); // unparseable → REACH_FEET
  });
});

describe("readiedTriggersToFire", () => {
  it("fires once the readied target is within trigger range", () => {
    const hero = ent({
      id: "hero",
      kind: "character",
      position: { x: 3, y: 3 },
      readied: readied("goblin"),
    });
    const adjacent = ent({ id: "goblin", position: { x: 4, y: 3 } });
    const far = ent({ id: "goblin", position: { x: 9, y: 3 } });

    expect(
      readiedTriggersToFire(battle([hero, adjacent], SIDES, 0)).map(
        (f) => f.reactor.id,
      ),
    ).toEqual(["hero"]);
    // Foe still out of reach → nothing fires yet.
    expect(readiedTriggersToFire(battle([hero, far], SIDES, 0))).toEqual([]);
  });

  it("honours the encoded range for a readied ranged strike", () => {
    const archer = ent({
      id: "hero",
      kind: "character",
      position: { x: 0, y: 0 },
      readied: readied("goblin", "in_range:30"), // 6 cells
    });
    const goblin = ent({ id: "goblin", position: { x: 5, y: 0 } }); // 5 cells = 25 ft
    expect(
      readiedTriggersToFire(battle([archer, goblin], SIDES, 0)).map(
        (f) => f.target.id,
      ),
    ).toEqual(["goblin"]);
  });

  it("skips a reactor whose reaction is already spent or that is down", () => {
    const spent = ent({
      id: "hero",
      kind: "character",
      position: { x: 3, y: 3 },
      reaction: "used",
      readied: readied("goblin"),
    });
    const goblin = ent({ id: "goblin", position: { x: 4, y: 3 } });
    expect(readiedTriggersToFire(battle([spent, goblin], SIDES, 0))).toEqual([]);

    const down = ent({
      id: "hero",
      kind: "character",
      position: { x: 3, y: 3 },
      alive: false,
      readied: readied("goblin"),
    });
    expect(readiedTriggersToFire(battle([down, goblin], SIDES, 0))).toEqual([]);
  });

  it("does not fire against a downed target", () => {
    const hero = ent({
      id: "hero",
      kind: "character",
      position: { x: 3, y: 3 },
      readied: readied("goblin"),
    });
    const goblin = ent({ id: "goblin", position: { x: 4, y: 3 }, alive: false });
    expect(readiedTriggersToFire(battle([hero, goblin], SIDES, 0))).toEqual([]);
  });

  it("returns nothing when no one holds a readied action", () => {
    const hero = ent({ id: "hero", kind: "character", position: { x: 3, y: 3 } });
    const goblin = ent({ id: "goblin", position: { x: 4, y: 3 } });
    expect(readiedTriggersToFire(battle([hero, goblin], SIDES, 0))).toEqual([]);
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

  it("spends the full Multiattack budget when adjacent", () => {
    const sides = { ogre: "foes", hero: "party" };
    const ogre = ent({
      id: "ogre",
      position: { x: 8, y: 3 },
      attacksPerAction: 2,
      actionEconomy: turnEconomy(30, 2),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 9, y: 3 } });
    const plan = planMonsterTurn(battle([ogre, hero], sides), "ogre");
    expect(plan.map((a) => a.type)).toEqual(["attack", "attack", "end_turn"]);
    expect(
      plan.filter((a) => a.type === "attack").map((a) => (a as { target: string }).target),
    ).toEqual(["hero", "hero"]);
  });

  it("fires every attack after a move that lands in reach", () => {
    const sides = { ogre: "foes", hero: "party" };
    const ogre = ent({
      id: "ogre",
      position: { x: 9, y: 3 },
      attacksPerAction: 2,
      actionEconomy: turnEconomy(30, 2),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 2, y: 3 } });
    const plan = planMonsterTurn(battle([ogre, hero], sides), "ogre");
    expect(plan.map((a) => a.type)).toEqual([
      "move_entity",
      "attack",
      "attack",
      "end_turn",
    ]);
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

  it("fires a ranged attack without moving when the foe is in range but not adjacent (PLAY-15)", () => {
    const sides = { bandit: "foes", hero: "party" };
    const bandit = ent({
      id: "bandit",
      position: { x: 0, y: 0 },
      rangedAttackRangeFt: 80,
      rangedDamage: { notation: "1d8+1", type: "piercing" },
      actionEconomy: turnEconomy(30),
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 0, y: 5 } });
    const plan = planMonsterTurn(battle([bandit, hero], sides), "bandit");
    expect(plan.map((a) => a.type)).toEqual(["attack", "end_turn"]);
    const attack = plan[0] as { target: string; rangeFt?: number };
    expect(attack.target).toBe("hero");
    expect(attack.rangeFt).toBe(80);
  });

  it("moves instead of planning a doomed ranged shot when a wall blocks LoS (PLAY-15)", () => {
    const ambushWalls = [
      { x: 6, y: 2 },
      { x: 6, y: 3 },
      { x: 6, y: 7 },
      { x: 6, y: 8 },
    ];
    const bandit = ent({
      id: "bandit",
      position: { x: 9, y: 3 },
      rangedAttackRangeFt: 80,
      rangedDamage: { notation: "1d8+1", type: "piercing" },
      actionEconomy: turnEconomy(30),
    });
    const hero = ent({
      id: "hero",
      kind: "character",
      position: { x: 2, y: 2 },
    });
    const state = {
      ...battle([bandit, hero], { bandit: "foes", hero: "party" }),
      scenes: {
        s1: {
          id: "s1",
          name: "Road ambush",
          map: { width: 12, height: 10, blockedCells: ambushWalls },
        },
      },
    } as WorldState;
    const plan = planMonsterTurn(state, "bandit");
    // No LoS from the spawn square — close one step through the wall gap, then shoot.
    expect(plan.map((a) => a.type)).toEqual(["move_entity", "attack", "end_turn"]);
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

    const attackOf = (plan: BattleAction[]): string => {
      const a = plan.find((x) => x.type === "attack");
      return a && a.type === "attack" ? a.target : "";
    };

    // Default: nearest is the hero (5 cells vs the mage's 6).
    expect(attackOf(planMonsterTurn(state, "goblin"))).toBe("hero");
    // Legal preference overrides the nearest-target default.
    expect(attackOf(planMonsterTurn(state, "goblin", "mage"))).toBe("mage");
    // Illegal id is ignored → falls back to the nearest.
    expect(attackOf(planMonsterTurn(state, "goblin", "dragon"))).toBe("hero");
  });

  it("prefers a spell when the monster is a caster in range (PLAY-15)", () => {
    const cultist = ent({
      id: "cultist",
      position: { x: 8, y: 5 },
      actionEconomy: turnEconomy(),
      spellcasting: {
        ability: "int",
        slots: { 1: { max: 4, current: 2 } },
        preparedSpellIds: ["fire-bolt", "burning-hands"],
      },
    });
    const hero = ent({ id: "hero", kind: "character", position: { x: 2, y: 5 } });
    const plan = planMonsterTurn(
      battle([cultist, hero], { cultist: "foes", hero: "party" }),
      "cultist",
    );
    expect(plan[0]?.type).toBe("cast_spell");
    if (plan[0]?.type === "cast_spell") {
      expect(["fire-bolt", "burning-hands"]).toContain(plan[0].spellId);
    }
    expect(plan.at(-1)).toEqual({ type: "end_turn" });
  });
});
