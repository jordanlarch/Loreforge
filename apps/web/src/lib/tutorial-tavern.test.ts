import { describe, expect, it } from "vitest";

import { TUTORIAL_TAVERN } from "@/lib/tutorial-tavern";

describe("tutorial tavern content", () => {
  it("lists The Hearth and Hemlock menu with Mira's display purse", () => {
    expect(TUTORIAL_TAVERN.name).toBe("The Hearth and Hemlock");
    expect(TUTORIAL_TAVERN.keeper).toBe("Barnaby Bramblefoot");
    expect(TUTORIAL_TAVERN.purseGp).toBe(15);
    expect(TUTORIAL_TAVERN.listings).toHaveLength(4);
  });

  it("includes food, drink, and a room — display only", () => {
    const names = TUTORIAL_TAVERN.listings.map((l) => l.name);
    expect(names).toContain("Hearty stew");
    expect(names).toContain("Room for the night");
  });
});
