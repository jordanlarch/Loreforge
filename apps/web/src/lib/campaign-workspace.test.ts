import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_WORKSPACE_TABS,
  DEFAULT_CAMPAIGN_TAB,
  partitionRoster,
  resolveCampaignTab,
} from "./campaign-workspace";

describe("campaign workspace tabs", () => {
  it("declares the seven prep tabs with Overview first", () => {
    expect(CAMPAIGN_WORKSPACE_TABS).toHaveLength(7);
    expect(CAMPAIGN_WORKSPACE_TABS[0]!.slug).toBe("overview");
    expect(CAMPAIGN_WORKSPACE_TABS.map((t) => t.slug)).toEqual([
      "overview",
      "map",
      "locations",
      "party",
      "quests",
      "notes",
      "settings",
    ]);
    expect(DEFAULT_CAMPAIGN_TAB).toBe("overview");
  });

  it("has a unique slug and a label for every tab", () => {
    const slugs = CAMPAIGN_WORKSPACE_TABS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const tab of CAMPAIGN_WORKSPACE_TABS) {
      expect(tab.label).toBeTruthy();
    }
  });

  it("resolves a known slug and falls back to the default otherwise", () => {
    expect(resolveCampaignTab("party")).toBe("party");
    expect(resolveCampaignTab("map")).toBe("map");
    expect(resolveCampaignTab("locations")).toBe("locations");
    expect(resolveCampaignTab("nonsense")).toBe("overview");
    expect(resolveCampaignTab(null)).toBe("overview");
    expect(resolveCampaignTab(undefined)).toBe("overview");
  });

  it("redirects legacy nine-tab slugs (CAMP-UX UX-2)", () => {
    expect(resolveCampaignTab("hooks")).toBe("quests");
    expect(resolveCampaignTab("world")).toBe("locations");
    expect(resolveCampaignTab("combat")).toBe("overview");
    expect(resolveCampaignTab("sessions")).toBe("overview");
  });
});

describe("partitionRoster", () => {
  it("splits active members into PCs and companions, and groups the bench", () => {
    const members = [
      { role: "pc", status: "active", name: "Thorin" },
      { role: "companion", status: "active", name: "Maddy" },
      { role: "npc-ally", status: "active", name: "Vane" },
      { role: "pc", status: "bench", name: "Roric" },
      { role: "companion", status: "bench", name: "Pip" },
    ];
    const { pcs, companions, bench } = partitionRoster(members);
    expect(pcs.map((m) => m.name)).toEqual(["Thorin"]);
    expect(companions.map((m) => m.name)).toEqual(["Maddy", "Vane"]);
    expect(bench.map((m) => m.name)).toEqual(["Roric", "Pip"]);
  });

  it("handles an empty roster", () => {
    expect(partitionRoster([])).toEqual({ pcs: [], companions: [], bench: [] });
  });
});
