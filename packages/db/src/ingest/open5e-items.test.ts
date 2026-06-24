import { describe, expect, it } from "vitest";

import { itemToRow } from "./open5e-items";

describe("open5e-items", () => {
  it("maps Open5e item JSON to codex row shape", () => {
    expect(
      itemToRow({
        key: "srd-2024_longsword",
        name: "Longsword",
        desc: "A longsword.",
        category: { key: "weapon", name: "Weapon" },
        cost: "15.00",
        weight: "3.000",
        weight_unit: "lb",
      }),
    ).toEqual({
      slug: "srd-2024_longsword",
      name: "Longsword",
      category: "weapon",
      description: "A longsword.",
      cost: "15.00",
      weight: "3.000",
      weightUnit: "lb",
      source: "open5e",
      raw: expect.objectContaining({ name: "Longsword" }),
    });
  });
});
