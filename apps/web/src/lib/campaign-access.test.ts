import { describe, expect, it } from "vitest";

import { canAccessPlayShell, canAccessPrepShell } from "./campaign-access";

describe("campaign access helpers", () => {
  it("allows prep only for owners", () => {
    expect(canAccessPrepShell("owner")).toBe(true);
    expect(canAccessPrepShell("player")).toBe(false);
    expect(canAccessPrepShell(null)).toBe(false);
  });

  it("allows play for owners and players", () => {
    expect(canAccessPlayShell("owner")).toBe(true);
    expect(canAccessPlayShell("player")).toBe(true);
    expect(canAccessPlayShell(null)).toBe(false);
  });
});
