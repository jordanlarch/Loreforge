import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_WORKSPACE_TABS,
  DEFAULT_CAMPAIGN_TAB,
  resolveCampaignTab,
} from "./campaign-workspace";

describe("campaign workspace tabs", () => {
  it("declares the nine workspace tabs with Overview first", () => {
    expect(CAMPAIGN_WORKSPACE_TABS).toHaveLength(9);
    expect(CAMPAIGN_WORKSPACE_TABS[0]!.slug).toBe("overview");
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
    expect(resolveCampaignTab("nonsense")).toBe("overview");
    expect(resolveCampaignTab(null)).toBe("overview");
    expect(resolveCampaignTab(undefined)).toBe("overview");
  });
});
