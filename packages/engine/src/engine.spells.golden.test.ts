import { describe, expect, it } from "vitest";

import { Engine } from "./engine";
import { SPELL_REGISTRY } from "./content/spell-registry";
import type { SpellDefinition } from "./content/spells";
import type { CastSpellCommand } from "./commands/types";
import type { AbilityScores } from "./entities/types";
import type { DraftEvent } from "./events/types";

/**
 * Golden spell-resolution suite (C1 / ENG-2).
 *
 * Every authored spell is cast once through the real command path against a
 * fixed arena and a fixed RNG seed, and its resolution is captured as a stable
 * record snapshot. Because the engine is deterministic (the seed comes from the
 * `now` clock), the snapshot is the "golden" expected outcome: any change to a
 * spell's declaration or to resolution math that shifts a damage/heal/hit total
 * fails CI and must be re-blessed deliberately. Adding a spell only adds a
 * record (each spell runs in its own isolated engine, so existing goldens are
 * untouched).
 *
 * @see docs/engine/architecture.md §7 · docs/deferrals.md ENG-2
 */
const CAMPAIGN = "c:golden";
const SEED = 99;

const CASTER_SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 18,
  wis: 18,
  cha: 18,
};
const DUMMY_SCORES: AbilityScores = {
  str: 7,
  dex: 7,
  con: 7,
  int: 7,
  wis: 7,
  cha: 7,
};

/**
 * A mapped arena with a level-17 full caster at the origin, low-AC / high-HP
 * dummies spread for single / multi / projectile / cone / sphere casts, and two
 * pre-wounded allies for healing. Positions are chosen so the caster is never
 * caught in its own area spells (cones exclude the apex; the sphere cluster sits
 * well outside any blast radius).
 */
async function setupArena(engine: Engine): Promise<void> {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:1",
      name: "Proving Ground",
      map: { width: 60, height: 60, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:caster",
      kind: "character",
      name: "Archmage",
      abilityScores: CASTER_SCORES,
      maxHp: 120,
      baseAc: 13,
      sceneId: "s:1",
      classes: [{ class: "Wizard", level: 17 }],
      spellcasting: { ability: "int", casterLevel: 17 },
      position: { x: 0, y: 0 },
    },
  });

  // Dummies: t1/t2 in melee/short range; na/nb along the east cone axis; fa/fb a
  // far sphere cluster. All very low AC (attacks land) and very high HP (no
  // downing mid-roll), with weak saves so save-for-half spells bite.
  const dummies: { id: string; x: number; y: number }[] = [
    { id: "t1", x: 1, y: 0 },
    { id: "t2", x: 1, y: 1 },
    { id: "na", x: 2, y: 0 },
    { id: "nb", x: 3, y: 0 },
    { id: "fa", x: 10, y: 10 },
    { id: "fb", x: 11, y: 10 },
  ];
  for (const d of dummies) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: d.id,
        kind: "monster",
        name: d.id,
        abilityScores: DUMMY_SCORES,
        maxHp: 100_000,
        baseAc: 1,
        sceneId: "s:1",
        position: { x: d.x, y: d.y },
      },
    });
  }

  // Two pre-wounded allies (40/100) so healing has headroom to restore. `a1`
  // sits adjacent to the west (so touch heals like Cure Wounds reach it); `a2`
  // sits due north. Both are clear of the east-axis dummies and of each other's
  // line to the caster (an intervening creature blocks spell line of sight).
  for (const a of [
    { id: "a1", x: -1, y: 0 },
    { id: "a2", x: 0, y: -3 },
  ]) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: a.id,
        kind: "character",
        name: a.id,
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        maxHp: 100,
        baseAc: 13,
        sceneId: "s:1",
        position: { x: a.x, y: a.y },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: a.id,
      damageType: "necrotic",
      source: { amount: 60 },
    });
  }
}

/** Build a representative cast for a spell from its declarative shape. */
function castFor(spell: SpellDefinition): CastSpellCommand {
  const base = {
    type: "cast_spell" as const,
    caster: "pc:caster",
    spellId: spell.id,
    slotLevel: spell.level,
  };
  if (spell.targeting === "area") {
    const origin =
      spell.range.area?.shape === "cone" ? { x: 1, y: 0 } : { x: 10, y: 10 };
    return { ...base, origin };
  }
  if (spell.healing) {
    return {
      ...base,
      targets: spell.targeting === "multi" ? ["a1", "a2"] : ["a1"],
    };
  }
  if (spell.projectiles) {
    return {
      ...base,
      targets: Array.from({ length: spell.projectiles.base }, () => "t1"),
    };
  }
  return { ...base, targets: spell.targeting === "multi" ? ["t1", "t2"] : ["t1"] };
}

type GoldenRecord = {
  accepted: boolean;
  slotSpent: number;
  attacks: number;
  attackHits: number;
  saves: number;
  damageDealt: number;
  healingApplied: number;
  damagedTargets: number;
};

function summarize(spell: SpellDefinition, events: DraftEvent[]): GoldenRecord {
  const sum = (type: string, key: "amount") =>
    events
      .filter((e) => e.type === type)
      .reduce((s, e) => s + ((e.payload as Record<string, number>)[key] ?? 0), 0);
  const attacks = events.filter((e) => e.type === "AttackResolved");
  const damaged = new Set(
    events
      .filter((e) => e.type === "DamageDealt")
      .map((e) => (e.payload as { target: string }).target),
  );
  return {
    accepted: true,
    slotSpent: events.some((e) => e.type === "SpellSlotExpended") ? spell.level : 0,
    attacks: attacks.length,
    attackHits: attacks.filter((e) => (e.payload as { hit: boolean }).hit).length,
    saves: events.filter((e) => e.type === "SaveRolled").length,
    damageDealt: sum("DamageDealt", "amount"),
    healingApplied: sum("HealingApplied", "amount"),
    damagedTargets: damaged.size,
  };
}

describe("Spells: golden resolution snapshots", () => {
  it("resolves every authored spell to its golden outcome", async () => {
    const golden: Record<string, GoldenRecord> = {};

    for (const id of Object.keys(SPELL_REGISTRY).sort()) {
      const spell = SPELL_REGISTRY[id]!;
      const engine = new Engine({ now: () => SEED });
      await setupArena(engine);
      const result = await engine.execute(CAMPAIGN, castFor(spell));

      // A registry spell that no longer casts cleanly is a regression, not a
      // re-bless: fail loudly with the rejection reason.
      expect(
        result.accepted,
        `${id} should cast: ${
          result.accepted ? "" : result.reason.code + " — " + result.reason.message
        }`,
      ).toBe(true);
      if (!result.accepted) continue;

      golden[id] = summarize(spell, result.events);
    }

    expect(golden).toMatchSnapshot();
  });
});
