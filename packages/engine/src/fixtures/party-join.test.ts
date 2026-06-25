import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import {
  buildPartyBattleCommands,
  FIXTURE_BATTLE_PARTY_SIDE,
  type PartyMember,
} from "./battle";
import {
  buildPartyMemberJoinCommands,
  findPartyJoinPosition,
} from "./party-join";

function member(id: string, name = id): PartyMember {
  return {
    id,
    name,
    abilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    maxHp: 20,
    baseAc: 14,
    speed: 30,
    classes: [{ class: "Fighter", level: 1 }],
  };
}

describe("buildPartyMemberJoinCommands", () => {
  it("creates entity + add_combatant when joining mid-fight", async () => {
    const engine = new Engine({ now: () => 0 });
    const campaignId = "camp:join";
    for (const command of buildPartyBattleCommands([member("char:a")])) {
      await engine.execute(campaignId, command);
    }
    const state = await engine.getState(campaignId);
    const newcomer = member("char:b", "Brennar");
    const commands = buildPartyMemberJoinCommands(newcomer, state);
    expect(commands.map((c) => c.type)).toEqual([
      "create_entity",
      "add_combatant",
    ]);
    if (commands[1]?.type === "add_combatant") {
      expect(commands[1].side).toBe(FIXTURE_BATTLE_PARTY_SIDE);
    }
    for (const command of commands) {
      const result = await engine.execute(campaignId, command);
      expect(result.accepted).toBe(true);
    }
    const after = await engine.getState(campaignId);
    expect(after.entities["char:b"]).toBeDefined();
    expect(after.encounter?.combatants).toContain("char:b");
  });

  it("is idempotent when the entity already exists", async () => {
    const engine = new Engine({ now: () => 0 });
    const campaignId = "camp:exists";
    for (const command of buildPartyBattleCommands([member("char:a")])) {
      await engine.execute(campaignId, command);
    }
    const state = await engine.getState(campaignId);
    expect(buildPartyMemberJoinCommands(member("char:a"), state)).toEqual([]);
  });
});

describe("findPartyJoinPosition", () => {
  it("places newcomers adjacent to an existing party member", async () => {
    const engine = new Engine({ now: () => 0 });
    const campaignId = "camp:pos";
    for (const command of buildPartyBattleCommands([member("char:a")])) {
      await engine.execute(campaignId, command);
    }
    const state = await engine.getState(campaignId);
    const sceneId = state.currentSceneId!;
    const pos = findPartyJoinPosition(state, sceneId);
    expect(pos).toBeDefined();
  });
});
