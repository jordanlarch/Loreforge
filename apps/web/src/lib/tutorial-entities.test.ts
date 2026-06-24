import { describe, expect, it } from "vitest";

import {
  dispositionLabel,
  TUTORIAL_ENTITIES,
  tutorialBrowseCatalog,
  tutorialEntity,
} from "./tutorial-entities";

describe("tutorial entity registry (TUT-1, #171)", () => {
  it("resolves a known chip name to its blurb", () => {
    const lily = tutorialEntity("Lily Lampmaker");
    expect(lily?.kind).toBe("npc");
    expect(lily?.speak).toBe("lily");
    expect(lily?.known.length).toBeGreaterThan(0);
  });

  it("marks Barnaby and Lily speakable, the spire a non-speakable place", () => {
    expect(tutorialEntity("Barnaby Bramblefoot")?.speak).toBe("barnaby");
    expect(tutorialEntity("The Lantern Spire")?.kind).toBe("place");
    expect(tutorialEntity("The Lantern Spire")?.speak).toBeUndefined();
  });

  it("knows the Scene 3 shop as a place and Toric as its keeper", () => {
    const shop = tutorialEntity("Tinker's Mercy");
    expect(shop?.kind).toBe("place");
    expect(shop?.speak).toBeUndefined();
    expect(shop?.known).toMatch(/Toric/);
    expect(tutorialEntity("Toric Pennywhistle")?.kind).toBe("npc");
  });

  it("returns undefined for an unknown name", () => {
    expect(tutorialEntity("Nobody In Particular")).toBeUndefined();
  });

  it("every speakable entity uses a real dialogue topic", () => {
    for (const e of Object.values(TUTORIAL_ENTITIES)) {
      if (e.speak) expect(["barnaby", "lily"]).toContain(e.speak);
    }
  });

  it("labels dispositions", () => {
    expect(dispositionLabel("friendly")).toBe("Friendly");
    expect(dispositionLabel("unknown")).toBe("Unknown");
  });

  it("maps vendor entities to shop or tavern browse overlays", () => {
    expect(tutorialBrowseCatalog("Barnaby Bramblefoot")).toBe("tavern");
    expect(tutorialBrowseCatalog("The Hearth and Hemlock")).toBe("tavern");
    expect(tutorialBrowseCatalog("Toric Pennywhistle")).toBe("shop");
    expect(tutorialBrowseCatalog("Tinker's Mercy")).toBe("shop");
    expect(tutorialBrowseCatalog("Lily Lampmaker")).toBeNull();
  });
});
