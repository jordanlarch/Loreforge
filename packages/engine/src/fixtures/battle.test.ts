import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import type { AbilityScores } from "../entities/types";
import { MONSTER_TEMPLATES, monsterTemplate } from "../content/monsters";
import {
  buildFixtureBattle,
  buildPartyBattleCommands,
  expandEncounterFoes,
  FIXTURE_BATTLE_FOES_SIDE,
  FIXTURE_BATTLE_PARTY_SIDE,
  FIXTURE_BATTLE_SCENE_ID,
  MAX_BATTLE_FOES,
  MAX_BATTLE_PARTY,
  moveAction,
  type PartyMember,
} from "./battle";

describe("buildFixtureBattle", () => {
  it("starts a mapped encounter with initiative rolled", async () => {
    const { state, rejected } = await buildFixtureBattle();

    expect(rejected).toBe(0);
    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);

    const scene = state.scenes[FIXTURE_BATTLE_SCENE_ID];
    expect(scene?.map).toBeDefined();
    expect(scene?.map?.blockedCells.length).toBeGreaterThan(0);

    const encounter = state.encounter;
    expect(encounter).toBeDefined();
    expect(encounter?.initiativeRolled).toBe(true);
    expect(encounter?.round).toBe(1);
    expect(encounter?.order).toHaveLength(4);
  });

  it("places every combatant on the grid", async () => {
    const { state } = await buildFixtureBattle();
    for (const ref of state.encounter!.combatants) {
      expect(state.entities[ref]?.position).toBeDefined();
    }
  });

  it("is deterministic across builds (same seed → same turn order)", async () => {
    const a = await buildFixtureBattle();
    const b = await buildFixtureBattle();
    expect(a.state.encounter?.order).toEqual(b.state.encounter?.order);
  });

  it("applies a legal move and reflects the new position", async () => {
    const base = await buildFixtureBattle();
    const active = base.state.encounter!.order[0]!.entity;
    const from = base.state.entities[active]!.position!;
    const to = { x: from.x, y: from.y + 1 };

    const moved = await buildFixtureBattle([moveAction(active, to)]);
    expect(moved.rejected).toBe(0);
    expect(moved.state.entities[active]?.position).toEqual(to);
  });

  it("rejects an illegal move (into a wall) and leaves position unchanged", async () => {
    const base = await buildFixtureBattle();
    const active = base.state.encounter!.order[0]!.entity;
    const from = base.state.entities[active]!.position!;
    const wall = base.state.scenes[FIXTURE_BATTLE_SCENE_ID]!.map!.blockedCells[0]!;

    const result = await buildFixtureBattle([moveAction(active, wall)]);
    expect(result.rejected).toBe(1);
    expect(result.state.entities[active]?.position).toEqual(from);
  });

  it("assigns the party side to player characters", async () => {
    const { state } = await buildFixtureBattle();
    const characters = Object.values(state.entities).filter(
      (e) => e.kind === "character",
    );
    for (const pc of characters) {
      expect(state.encounter?.sides[pc.id]).toBe(FIXTURE_BATTLE_PARTY_SIDE);
    }
  });
});

describe("buildPartyBattleCommands", () => {
  const scores: AbilityScores = {
    str: 14,
    dex: 12,
    con: 13,
    int: 10,
    wis: 11,
    cha: 16,
  };
  function member(id: string, over: Partial<PartyMember> = {}): PartyMember {
    return {
      id,
      name: id,
      abilityScores: scores,
      maxHp: 20,
      baseAc: 14,
      speed: 30,
      classes: [{ class: "Fighter", level: 3 }],
      ...over,
    };
  }

  async function run(party: PartyMember[]) {
    const engine = new Engine({ now: () => 0 });
    for (const command of buildPartyBattleCommands(party)) {
      await engine.execute("c:party", command);
    }
    return engine.getState("c:party");
  }

  it("seeds the real party as combatants alongside the two goblins", async () => {
    const state = await run([member("char:a"), member("char:b")]);
    expect(state.entities["char:a"]?.kind).toBe("character");
    expect(state.encounter?.sides["char:a"]).toBe(FIXTURE_BATTLE_PARTY_SIDE);
    expect(state.encounter?.sides["npc:goblin-a"]).toBe(FIXTURE_BATTLE_FOES_SIDE);
    expect(state.encounter?.combatants).toHaveLength(4); // 2 PCs + 2 goblins
  });

  it("makes a member with spellcasting a caster (slots seeded)", async () => {
    const state = await run([
      member("char:caster", { spellcasting: { ability: "cha", casterLevel: 5 } }),
    ]);
    const caster = state.entities["char:caster"];
    expect(caster?.spellcasting?.ability).toBe("cha");
    expect(caster?.spellcasting?.slots[3]?.max).toBe(2); // L5 full caster
  });

  it("caps the seeded party at the available start cells", async () => {
    const party = Array.from({ length: MAX_BATTLE_PARTY + 2 }, (_, i) =>
      member(`char:${i}`),
    );
    const state = await run(party);
    const pcs = Object.values(state.entities).filter(
      (e) => e.kind === "character",
    );
    expect(pcs).toHaveLength(MAX_BATTLE_PARTY);
  });

  it("seeds an authored foe roster + scene name instead of the goblins", async () => {
    const foes = expandEncounterFoes(
      [{ template: "orc", count: 2 }],
      monsterTemplate,
    );
    const engine = new Engine({ now: () => 0 });
    for (const command of buildPartyBattleCommands([member("char:a")], {
      foes,
      sceneName: "Orc Warband",
    })) {
      await engine.execute("c:authored", command);
    }
    const state = await engine.getState("c:authored");
    expect(state.scenes[FIXTURE_BATTLE_SCENE_ID]?.name).toBe("Orc Warband");
    expect(state.entities["npc:goblin-a"]).toBeUndefined();
    expect(state.entities["npc:foe-0"]?.name).toBe("Orc 1");
    expect(state.entities["npc:foe-1"]?.name).toBe("Orc 2");
    expect(state.encounter?.combatants).toHaveLength(3); // 1 PC + 2 orcs
  });
});

describe("expandEncounterFoes", () => {
  it("expands template × count into uniquely-id'd, count-suffixed foes", () => {
    const foes = expandEncounterFoes(
      [
        { template: "goblin", count: 2 },
        { template: "ogre", count: 1 },
      ],
      monsterTemplate,
    );
    expect(foes.map((f) => f.id)).toEqual(["npc:foe-0", "npc:foe-1", "npc:foe-2"]);
    expect(foes.map((f) => f.name)).toEqual(["Goblin 1", "Goblin 2", "Ogre"]);
    expect(foes[2]?.maxHp).toBe(MONSTER_TEMPLATES.ogre!.maxHp);
  });

  it("honors a name override and drops a single count's suffix", () => {
    const foes = expandEncounterFoes(
      [{ template: "wolf", count: 1, name: "Direwolf" }],
      monsterTemplate,
    );
    expect(foes).toHaveLength(1);
    expect(foes[0]?.name).toBe("Direwolf");
  });

  it("skips unknown templates and caps at the available foe cells", () => {
    const foes = expandEncounterFoes(
      [
        { template: "made-up", count: 3 },
        { template: "skeleton", count: 20 },
      ],
      monsterTemplate,
    );
    expect(foes).toHaveLength(MAX_BATTLE_FOES);
    expect(foes.every((f) => f.name.startsWith("Skeleton"))).toBe(true);
  });
});
