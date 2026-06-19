import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import { CampaignCommandQueue } from "./queue";
import type { AbilityScores } from "../entities/types";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

describe("CampaignCommandQueue", () => {
  it("serializes commands so each sees the previous one's state", async () => {
    const engine = new Engine();
    const campaign = "c:queue";
    await engine.execute(campaign, {
      type: "create_scene",
      scene: { id: "s", name: "S" },
    });
    await engine.execute(campaign, {
      type: "create_entity",
      entity: {
        id: "pc:a",
        kind: "character",
        name: "A",
        abilityScores: ABILITIES,
        maxHp: 100,
        baseAc: 10,
      },
    });

    const queue = new CampaignCommandQueue((cmd) => engine.execute(campaign, cmd));

    // Fire ten 10-damage hits concurrently; serialization must total exactly 100.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        queue.enqueue({
          type: "apply_damage",
          target: "pc:a",
          damageType: "force",
          source: { amount: 10 },
        }),
      ),
    );

    expect(results.every((r) => r.accepted)).toBe(true);
    expect((await engine.getState(campaign)).entities["pc:a"]?.hp.current).toBe(
      0,
    );
  });

  it("preserves FIFO ordering", async () => {
    const order: number[] = [];
    let i = 0;
    const queue = new CampaignCommandQueue(async () => {
      const n = i++;
      await new Promise((r) => setTimeout(r, n === 0 ? 5 : 0));
      order.push(n);
      return { accepted: true as const, events: [], summary: {} };
    });
    await Promise.all([
      queue.enqueue({ type: "roll_dice", notation: "1d4" }),
      queue.enqueue({ type: "roll_dice", notation: "1d4" }),
      queue.enqueue({ type: "roll_dice", notation: "1d4" }),
    ]);
    expect(order).toEqual([0, 1, 2]);
  });
});
