import { describe, expect, it } from "vitest";

import {
  buildPropertyDetailsFromSelection,
  selectionFromPropertyDetails,
  SRD_WEAPON_PROPERTIES,
} from "./item-property-catalog";

describe("item-property-catalog", () => {
  it("builds property rows without mastery", () => {
    const rows = buildPropertyDetailsFromSelection({
      propertyKeys: ["finesse", "light"],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key)).toEqual(["finesse", "light"]);
  });

  it("appends mastery row when selected", () => {
    const rows = buildPropertyDetailsFromSelection({
      propertyKeys: ["reach"],
      masteryKey: "push",
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]?.mastery).toBe(true);
    expect(rows[1]?.name).toBe("Push");
  });

  it("round-trips selection from propertyDetails", () => {
    const rows = buildPropertyDetailsFromSelection({
      propertyKeys: ["heavy", "two-handed"],
      masteryKey: "cleave",
    });
    const sel = selectionFromPropertyDetails(rows);
    expect(sel.propertyKeys).toEqual(["heavy", "two-handed"]);
    expect(sel.masteryKey).toBe("cleave");
  });

  it("covers expected SRD weapon property count", () => {
    expect(SRD_WEAPON_PROPERTIES.length).toBe(10);
  });
});
