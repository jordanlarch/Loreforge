import { beforeEach, describe, expect, it } from "vitest";

import { featureResourceKey } from "./entities/feature-resources";
import { useClassFeature } from "./content/class-feature-actions";
import { createSeededRng } from "./rng/prng";
import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 16,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 14,
};

const CAMPAIGN = "c:fid21";

async function setupScene(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:arena",
      name: "Arena",
      map: { width: 10, height: 10, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
}

async function place(
  engine: Engine,
  id: string,
  position: GridPosition,
  classes: { class: string; level: number }[],
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp: 40,
      baseAc: 10,
      speed: 30,
      classes,
      sceneId: "s:arena",
      position,
    },
  });
}

describe("SRD-FID-21: Sneak Attack", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:rogue", { x: 0, y: 0 }, [{ class: "Rogue", level: 3 }]);
    await place(engine, "npc:foe", { x: 1, y: 0 }, []);
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:rogue", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
  });

  it("adds Sneak Attack dice on a qualifying hit", async () => {
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:rogue",
      target: "npc:foe",
      attackBonus: 20,
      damage: { notation: "1d1", type: "piercing" },
      mode: "advantage",
      finesseOrRanged: true,
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const resolved = attack.events.find((e) => e.type === "AttackResolved") as {
      payload: { sneakAttackDamage?: number; damage?: number };
    };
    expect(resolved.payload.sneakAttackDamage).toBeGreaterThan(0);
    expect(resolved.payload.damage).toBeGreaterThan(1);
  });
});

describe("SRD-FID-21: Rage", () => {
  it("useClassFeature returns resistance and damage-bonus effects", () => {
    const key = featureResourceKey("Barbarian", 1, "rage");
    const result = useClassFeature({
      characterId: "pc:barb",
      classes: [{ class: "Barbarian", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 40,
      rng: createSeededRng("rage"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selfEffects?.length).toBe(2);
    expect(result.selfEffects?.[0]?.modifier.type).toBe("damage_resistance");
    expect(result.selfEffects?.[1]?.modifier.type).toBe("rage_damage_bonus");
  });
});

describe("SRD-FID-21: Bardic Inspiration", () => {
  it("grants an inspiration die effect to an ally", () => {
    const key = featureResourceKey("Bard", 1, "bardic-inspiration");
    const result = useClassFeature({
      characterId: "pc:bard",
      classes: [{ class: "Bard", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 30,
      rng: createSeededRng("bi"),
      beneficiaryId: "pc:ally",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allyEffect?.effect.modifier.type).toBe("bardic_inspiration");
  });
});
