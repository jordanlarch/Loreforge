import { describe, expect, it } from "vitest";

import {
  advancedRuleToRow,
  classifyAdvancedRuleKey,
} from "./open5e-advanced-rules";

describe("open5e-advanced-rules", () => {
  it("classifies rule keys by prefix", () => {
    expect(classifyAdvancedRuleKey("srd_traps_sample-traps")).toBe("traps");
    expect(classifyAdvancedRuleKey("srd_poisons_sample-poisons")).toBe("poisons");
    expect(classifyAdvancedRuleKey("srd_diseases_cackle-fever")).toBe("curses");
    expect(classifyAdvancedRuleKey("srd_madness_going-mad")).toBe("fear");
    expect(classifyAdvancedRuleKey("srd_environment_falling")).toBe("environment");
    expect(classifyAdvancedRuleKey("srd-2024_exploration_hazards")).toBe(
      "environment",
    );
    expect(classifyAdvancedRuleKey("srd_combat_the-order-of-combat")).toBeNull();
  });

  it("maps Open5e rule JSON to codex row shape", () => {
    expect(
      advancedRuleToRow(
        {
          key: "srd_traps_falling-net",
          name: "Falling Net",
          desc: "A net falls from the ceiling.",
        },
        "traps",
        3,
      ),
    ).toEqual({
      slug: "srd_traps_falling-net",
      name: "Falling Net",
      description: "A net falls from the ceiling.",
      topic: "traps",
      sortIndex: 3,
      source: "open5e",
      raw: expect.objectContaining({ name: "Falling Net" }),
    });
  });
});
