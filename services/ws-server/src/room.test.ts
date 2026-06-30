import { describe, expect, it } from "vitest";

import { FIXTURE_BATTLE_SCENE_ID } from "@app/engine";

import { BattleRoom, isBattleAction } from "./room.js";

async function activeEntity(room: BattleRoom) {
  const state = await room.getState();
  const active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
  return { state, active, from: state.entities[active]!.position! };
}

describe("BattleRoom", () => {
  it("seeds the goblin-ambush encounter with initiative rolled", async () => {
    const room = new BattleRoom();
    const state = await room.getState();

    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);
    expect(state.encounter?.initiativeRolled).toBe(true);
    expect(state.encounter?.order).toHaveLength(4);
  });

  it("applies a legal move and reflects the new position", async () => {
    const room = new BattleRoom();
    const { active, from } = await activeEntity(room);
    const to = { x: from.x, y: from.y + 1 };

    const result = await room.apply({ type: "move_entity", entity: active, to });

    expect(result.accepted).toBe(true);
    expect((await room.getState()).entities[active]?.position).toEqual(to);
  });

  it("rejects an illegal move (into a wall) and leaves state unchanged", async () => {
    const room = new BattleRoom();
    const { state, active, from } = await activeEntity(room);
    const wall = state.scenes[FIXTURE_BATTLE_SCENE_ID]!.map!.blockedCells[0]!;

    const result = await room.apply({ type: "move_entity", entity: active, to: wall });

    expect(result.accepted).toBe(false);
    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });

  it("advances the active combatant on end_turn", async () => {
    const room = new BattleRoom();
    const before = (await room.getState()).encounter!.activeIndex;

    const result = await room.apply({ type: "end_turn" });

    expect(result.accepted).toBe(true);
    expect((await room.getState()).encounter!.activeIndex).not.toBe(before);
  });

  it("returns the engine command summary so callers can read check results (#97)", async () => {
    const room = new BattleRoom();
    const { active } = await activeEntity(room);

    const result = await room.apply({
      type: "ability_check",
      entity: active,
      ability: "dex",
      skill: "Acrobatics",
      dc: 10,
    });

    expect(result.accepted).toBe(true);
    expect(typeof result.summary?.total).toBe("number");
    expect(result.summary?.success).toBe(
      (result.summary!.total as number) >= 10,
    );
  });

  it("reset rebuilds the original fixture state", async () => {
    const room = new BattleRoom();
    const { active, from } = await activeEntity(room);
    await room.apply({ type: "move_entity", entity: active, to: { x: from.x, y: from.y + 1 } });

    await room.reset();

    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });
});

describe("isBattleAction", () => {
  it("accepts well-formed actions", () => {
    expect(isBattleAction({ type: "end_turn" })).toBe(true);
    expect(
      isBattleAction({ type: "move_entity", entity: "pc:1", to: { x: 1, y: 2 } }),
    ).toBe(true);
  });

  it("rejects malformed or unknown actions", () => {
    expect(isBattleAction(null)).toBe(false);
    expect(isBattleAction({ type: "attack" })).toBe(false);
    expect(isBattleAction({ type: "move_entity", entity: 5, to: { x: 1, y: 2 } })).toBe(false);
    expect(isBattleAction({ type: "move_entity", entity: "pc:1", to: { x: 1 } })).toBe(false);
  });

  it("accepts an AoE cast carrying an origin cell, rejecting a malformed one (#99)", () => {
    const base = { type: "cast_spell", caster: "pc:1", spellId: "fireball", slotLevel: 3 };
    expect(isBattleAction(base)).toBe(true);
    expect(isBattleAction({ ...base, origin: { x: 5, y: 5 } })).toBe(true);
    expect(isBattleAction({ ...base, origin: { x: 5 } })).toBe(false);
    expect(isBattleAction({ ...base, origin: "nope" })).toBe(false);
  });

  it("accepts a well-formed ready_action, rejecting malformed ones (#104)", () => {
    const base = {
      type: "ready_action",
      entity: "pc:1",
      trigger: "in_range:5",
      action: {
        kind: "attack",
        target: "npc:1",
        attackBonus: 5,
        damage: { notation: "1d8+3", type: "slashing" },
      },
    };
    expect(isBattleAction(base)).toBe(true);
    expect(isBattleAction({ ...base, trigger: 5 })).toBe(false);
    expect(isBattleAction({ ...base, action: { ...base.action, kind: "shove" } })).toBe(false);
    expect(isBattleAction({ ...base, action: { ...base.action, target: 7 } })).toBe(false);
    expect(isBattleAction({ ...base, action: undefined })).toBe(false);
  });

  it("accepts a trigger_readied command (#104)", () => {
    expect(isBattleAction({ type: "trigger_readied", entity: "pc:1" })).toBe(true);
    expect(isBattleAction({ type: "trigger_readied", entity: 5 })).toBe(false);
  });

  it("accepts detect_trap and disable_trap (GRILL-LIVE-TOOLBOX)", () => {
    expect(
      isBattleAction({
        type: "detect_trap",
        entity: "pc:1",
        sceneId: "s:1",
        trapInstanceId: "trap:1",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "disable_trap",
        entity: "pc:1",
        sceneId: "s:1",
        trapInstanceId: "trap:1",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "detect_trap",
        entity: "pc:1",
        sceneId: "s:1",
      }),
    ).toBe(false);
  });

  it("accepts FID-21 attack flags and use_class_feature", () => {
    expect(
      isBattleAction({
        type: "attack",
        attacker: "pc:1",
        target: "npc:1",
        attackBonus: 5,
        damage: { notation: "1d8", type: "slashing" },
        stunningStrike: true,
        monkWeaponOrUnarmed: true,
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "cast_spell",
        caster: "pc:1",
        spellId: "fire-bolt",
        slotLevel: 0,
        metamagic: "empowered",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "use_class_feature",
        entity: "pc:1",
        featureKey: "Monk:2:monk-s-focus",
        monkFocusSpend: "patient_defense",
      }),
    ).toBe(true);
  });

  it("accepts coat_weapon and apply_poison (GRILL-LIVE-POISON)", () => {
    expect(
      isBattleAction({
        type: "coat_weapon",
        entity: "pc:1",
        poisonSlug: "srd-2024_serpent-venom",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "apply_poison",
        target: "pc:1",
        poisonSlug: "srd-2024_assassins-blood",
      }),
    ).toBe(true);
    expect(isBattleAction({ type: "coat_weapon", entity: "pc:1" })).toBe(false);
  });

  it("accepts apply_curse and remove_curse (GRILL-LIVE-CURSE)", () => {
    expect(
      isBattleAction({
        type: "apply_curse",
        target: "pc:1",
        curseSlug: "srd-2024_sight-rot",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "remove_curse",
        target: "pc:1",
        instanceId: "curse:pc:1:sight:0",
      }),
    ).toBe(true);
    expect(isBattleAction({ type: "apply_curse", target: "pc:1" })).toBe(false);
  });

  it("accepts apply_fear_stress (GRILL-LIVE-FEAR)", () => {
    expect(
      isBattleAction({
        type: "apply_fear_stress",
        target: "pc:1",
        fearStressSlug: "srd-2024_hallucinogenic-substance",
      }),
    ).toBe(true);
    expect(isBattleAction({ type: "apply_fear_stress", target: "pc:1" })).toBe(
      false,
    );
  });

  it("accepts exploration hazard battle actions (GRILL-EXPLORATION)", () => {
    expect(
      isBattleAction({
        type: "apply_fall_damage",
        target: "pc:1",
        heightFt: 30,
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "apply_burning",
        target: "pc:1",
        burningSlug: "srd-2024_burning",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "extinguish_burning",
        target: "pc:1",
        instanceId: "burn:pc:1:srd-2024_burning:0",
        method: "action",
      }),
    ).toBe(true);
    expect(isBattleAction({ type: "apply_fall_damage", target: "pc:1" })).toBe(
      false,
    );
  });

  it("accepts subclass feature attack flags and commands", () => {
    const attackBase = {
      type: "attack" as const,
      attacker: "pc:1",
      target: "foe:1",
      attackBonus: 5,
      damage: { notation: "1d8+3", type: "slashing" },
    };
    expect(
      isBattleAction({ ...attackBase, frenzyBonusAttack: true }),
    ).toBe(true);
    expect(
      isBattleAction({
        ...attackBase,
        flurryBonusAttack: true,
        openHandTechnique: "prone",
      }),
    ).toBe(true);
    expect(
      isBattleAction({ ...attackBase, openHandTechnique: "invalid" }),
    ).toBe(false);

    expect(
      isBattleAction({
        type: "use_class_feature",
        entity: "pc:1",
        featureKey: "barbarian:1:rage",
        rageFrenzy: true,
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "use_class_feature",
        entity: "pc:1",
        featureKey: "paladin:3:channel-divinity",
        channelDivinitySpend: "sacred_weapon",
      }),
    ).toBe(true);

    expect(
      isBattleAction({
        type: "fast_hands",
        entity: "pc:1",
        action: "sleight_of_hand",
      }),
    ).toBe(true);
    expect(
      isBattleAction({
        type: "cutting_words",
        reactor: "pc:1",
        against: "foe:1",
        mode: "attack",
        originalTotal: 18,
        natural: 15,
        targetAc: 14,
      }),
    ).toBe(true);
  });
});
