import { describe, expect, it } from "vitest";

import {
  codexSlugToMonsterTemplate,
  resolveRoomEncounterTemplate,
  resolveWanderingMonsterTemplate,
} from "./encounter-ref";

describe("encounter-ref", () => {
  it("maps codex slugs to curated templates", () => {
    expect(codexSlugToMonsterTemplate("goblin")).toBe("goblin");
    expect(codexSlugToMonsterTemplate("srd-2024_goblin")).toBe("goblin");
  });

  it("prefers codex slug on room encounters", () => {
    const data = {
      rooms: [
        {
          name: "Entry",
          encounter: "2 goblins",
          encounterCodexSlug: "srd-2024_goblin",
          encounterCount: 3,
        },
      ],
    };
    expect(resolveRoomEncounterTemplate(data, 0)).toEqual({
      template: "goblin",
      count: 3,
      label: "2 goblins",
    });
  });

  it("falls back to prose labels", () => {
    const data = {
      rooms: [{ name: "Entry", encounter: "3 skeletons" }],
    };
    expect(resolveRoomEncounterTemplate(data, 0)).toEqual({
      template: "skeleton",
      count: 3,
      label: "3 skeletons",
    });
  });

  it("reads structured wandering patrol rows", () => {
    const data = {
      wanderingMonsterEntries: [
        { label: "Wolf pack", codexSlug: "wolf", count: 4 },
      ],
    };
    expect(resolveWanderingMonsterTemplate(data)).toEqual({
      template: "wolf",
      count: 4,
      label: "Wolf pack",
    });
  });
});
