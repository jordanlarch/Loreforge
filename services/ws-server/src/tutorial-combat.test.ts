import { describe, expect, it } from "vitest";

import {
  FIXTURE_BATTLE_PARTY_SIDE,
  TUTORIAL_COMPANION,
  TUTORIAL_FOES_SIDE,
  TUTORIAL_SHADE_ID,
  type EntityState,
  type WorldState,
} from "@app/engine";

import {
  COMPANION_ID,
  activeCombatant,
  leadPc,
  partyReactionPending,
  planCompanionTurn,
  shadeFleeMove,
  tutorialCombatOver,
} from "./tutorial-combat.js";

const LEAD_ID = "char:mira";

/** A minimal EntityState good enough for the pure planners. */
function entity(over: Partial<EntityState> & { id: string }): EntityState {
  return {
    name: over.name ?? over.id,
    kind: over.kind ?? "character",
    alive: over.alive ?? true,
    dead: over.dead ?? false,
    hp: over.hp ?? { current: 20, max: 20, temp: 0 },
    baseAc: 14,
    speed: 30,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ...over,
  } as EntityState;
}

/** A minimal combat WorldState: the lead + companion (party) vs the Shade (foe). */
function combatState(
  entities: EntityState[],
  opts: {
    order?: string[];
    activeIndex?: number;
    reactionWindow?: { mover: string; eligible: string[] };
  } = {},
): WorldState {
  const byId: Record<string, EntityState> = {};
  for (const e of entities) byId[e.id] = e;
  const combatants = entities.map((e) => e.id);
  const sides: Record<string, string> = {};
  for (const e of entities) {
    sides[e.id] = e.kind === "monster" ? TUTORIAL_FOES_SIDE : FIXTURE_BATTLE_PARTY_SIDE;
  }
  const order = (opts.order ?? combatants).map((entity) => ({ entity }));
  return {
    entities: byId,
    scenes: {},
    encounter: {
      sceneId: "scene:tut-spire-stair",
      combatants,
      sides,
      order,
      initiativeRolled: true,
      surpriseResolved: false,
      round: 1,
      activeIndex: opts.activeIndex ?? 0,
      ...(opts.reactionWindow
        ? { reactionWindow: { mover: opts.reactionWindow.mover, eligible: opts.reactionWindow.eligible } }
        : {}),
    },
  } as unknown as WorldState;
}

const COMPANION_SPELLS = {
  spellcasting: { ability: "wis" as const, slots: { 1: { max: 3, current: 3 } } },
};

describe("leadPc / activeCombatant", () => {
  it("finds the party PC that isn't the companion", () => {
    const state = combatState([
      entity({ id: LEAD_ID }),
      entity({ id: COMPANION_ID, ...COMPANION_SPELLS }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster" }),
    ]);
    expect(leadPc(state)?.id).toBe(LEAD_ID);
    expect(COMPANION_ID).toBe(TUTORIAL_COMPANION.id);
  });

  it("returns the combatant on the active initiative slot", () => {
    const state = combatState(
      [entity({ id: LEAD_ID }), entity({ id: TUTORIAL_SHADE_ID, kind: "monster" })],
      { order: [LEAD_ID, TUTORIAL_SHADE_ID], activeIndex: 1 },
    );
    expect(activeCombatant(state)?.id).toBe(TUTORIAL_SHADE_ID);
  });
});

describe("planCompanionTurn", () => {
  it("Sacred Flames the foe when the lead is healthy", () => {
    const state = combatState([
      entity({ id: LEAD_ID, position: { x: 2, y: 8 } }),
      entity({ id: COMPANION_ID, position: { x: 2, y: 6 }, ...COMPANION_SPELLS }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", position: { x: 3, y: 8 } }),
    ]);
    const plan = planCompanionTurn(state);
    const cast = plan.find((a) => a.type === "cast_spell");
    expect(cast).toMatchObject({ spellId: "sacred-flame", targets: [TUTORIAL_SHADE_ID] });
  });

  it("Cure Wounds the lead when she is downed (the safety net / heal demo)", () => {
    const state = combatState([
      // Already adjacent so no movement step is planned (keeps the test grid-free).
      entity({ id: LEAD_ID, position: { x: 2, y: 7 }, hp: { current: 0, max: 20, temp: 0 }, alive: false }),
      entity({ id: COMPANION_ID, position: { x: 2, y: 8 }, ...COMPANION_SPELLS }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", position: { x: 5, y: 8 } }),
    ]);
    const plan = planCompanionTurn(state);
    const cast = plan.find((a) => a.type === "cast_spell");
    expect(cast).toMatchObject({ spellId: "cure-wounds", slotLevel: 1, targets: [LEAD_ID] });
  });

  it("falls back to Sacred Flame when out of healing slots", () => {
    const state = combatState([
      entity({ id: LEAD_ID, position: { x: 2, y: 7 }, hp: { current: 1, max: 20, temp: 0 } }),
      entity({
        id: COMPANION_ID,
        position: { x: 2, y: 8 },
        spellcasting: { ability: "wis", slots: { 1: { max: 3, current: 0 } } },
      }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", position: { x: 5, y: 8 } }),
    ]);
    const cast = planCompanionTurn(state).find((a) => a.type === "cast_spell");
    expect(cast).toMatchObject({ spellId: "sacred-flame" });
  });

  it("just ends the turn when the companion isn't present", () => {
    const state = combatState([
      entity({ id: LEAD_ID }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster" }),
    ]);
    expect(planCompanionTurn(state)).toEqual([{ type: "end_turn" }]);
  });
});

describe("tutorialCombatOver", () => {
  it("is true once every foe is down", () => {
    const state = combatState([
      entity({ id: LEAD_ID }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", alive: false }),
    ]);
    expect(tutorialCombatOver(state)).toBe(true);
  });

  it("is false while a foe still stands", () => {
    const state = combatState([
      entity({ id: LEAD_ID }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", alive: true }),
    ]);
    expect(tutorialCombatOver(state)).toBe(false);
  });
});

describe("partyReactionPending", () => {
  it("is true when a party reactor has an open window", () => {
    const state = combatState(
      [
        entity({ id: LEAD_ID, reaction: "available" } as Partial<EntityState> & { id: string }),
        entity({ id: TUTORIAL_SHADE_ID, kind: "monster" }),
      ],
      { reactionWindow: { mover: TUTORIAL_SHADE_ID, eligible: [LEAD_ID] } },
    );
    expect(partyReactionPending(state)).toBe(true);
  });

  it("is false with no window", () => {
    const state = combatState([
      entity({ id: LEAD_ID }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster" }),
    ]);
    expect(partyReactionPending(state)).toBe(false);
  });
});

describe("shadeFleeMove", () => {
  it("returns undefined when the Shade is not adjacent to the lead", () => {
    const state = combatState([
      entity({ id: LEAD_ID, position: { x: 0, y: 0 } }),
      entity({ id: TUTORIAL_SHADE_ID, kind: "monster", position: { x: 9, y: 9 } }),
    ]);
    expect(shadeFleeMove(state)).toBeUndefined();
  });
});
