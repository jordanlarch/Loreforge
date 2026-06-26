import { describe, expect, it } from "vitest";

import {
  playNavLightboxTitle,
  playRailStorageKey,
  PLAY_NAV_ITEMS,
} from "./play-shell";

describe("play-shell", () => {
  it("labels Quests nav item consistently", () => {
    const quests = PLAY_NAV_ITEMS.find((i) => i.id === "quests");
    expect(quests?.label).toBe("Quests");
  });

  it("returns lightbox titles for panel nav ids", () => {
    expect(playNavLightboxTitle("party")).toBe("Party");
    expect(playNavLightboxTitle("play")).toBeNull();
    expect(playNavLightboxTitle("character")).toBeNull();
  });

  it("scopes rail collapse storage per campaign", () => {
    expect(playRailStorageKey("abc")).toContain("abc");
    expect(playRailStorageKey()).toContain("sandbox");
  });
});
