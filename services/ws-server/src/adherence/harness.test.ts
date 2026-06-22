import { describe, expect, it } from "vitest";

import { getNarrationClient } from "../narration.js";
import { ADHERENCE_FIXTURES } from "./fixtures.js";
import {
  gradeCheck,
  gradeNarration,
  gradeTarget,
  mockClientFor,
  runAdherence,
} from "./harness.js";

/** Closed-alpha gate (roadmap §7). */
const ADHERENCE_THRESHOLD = 0.98;

describe("LLM tool-adherence harness", () => {
  it("meets the adherence gate over the fixture battery", async () => {
    // CI path: deterministic fake clients exercise the orchestrators + graders
    // end to end without a network. When ANTHROPIC_API_KEY is set (nightly /
    // local), the same battery runs against the live model — the real gate.
    const realClient = getNarrationClient();
    const report = await runAdherence({
      fixtures: ADHERENCE_FIXTURES,
      clientFor: realClient ? () => realClient : (fx) => mockClientFor(fx),
    });

    if (report.failures.length > 0) {
      // Surface exactly which fixtures broke contract (and how) on failure.
      console.error(
        "Tool-adherence failures:\n" +
          JSON.stringify(report.failures, null, 2),
      );
    }

    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(report.rate).toBeGreaterThanOrEqual(ADHERENCE_THRESHOLD);
  });

  it("graders reject contract violations (the gate has teeth)", () => {
    // Wrong governing ability for a Dexterity task.
    expect(
      gradeCheck(
        { ability: "str", dc: 15, proficient: true },
        { expect: { abilities: ["dex"], dcMin: 10, dcMax: 20 } },
      ).passed,
    ).toBe(false);

    // DC outside the plausible band.
    expect(
      gradeCheck(
        { ability: "dex", dc: 2, proficient: true },
        { expect: { abilities: ["dex"], dcMin: 10, dcMax: 20 } },
      ).passed,
    ).toBe(false);

    // A number leaking into narration breaks the fiction-only contract.
    expect(
      gradeNarration({ text: "You take 7 damage.", mentions: [] }, {}).passed,
    ).toBe(false);

    // Mentioning an entity that isn't on-scene.
    expect(
      gradeNarration(
        { text: "A ghost drifts past.", mentions: ["Ghost"] },
        { expect: { mentionsSubsetOf: ["Barkeep"] } },
      ).passed,
    ).toBe(false);

    // A target that isn't a legal candidate.
    expect(
      gradeTarget("pc:nobody", { expect: { allowed: ["pc:thorin"] } }).passed,
    ).toBe(false);
    expect(
      gradeTarget(undefined, { expect: { allowed: ["pc:thorin"] } }).passed,
    ).toBe(false);
  });

  it("accepts a well-formed decision for each grader", () => {
    expect(
      gradeCheck(
        { ability: "dex", skill: "Stealth", dc: 15, proficient: true },
        {
          expect: {
            abilities: ["dex"],
            dcMin: 10,
            dcMax: 20,
            skillIncludes: ["stealth"],
          },
        },
      ).passed,
    ).toBe(true);

    expect(
      gradeNarration(
        { text: "The door groans open into darkness.", mentions: [] },
        {},
      ).passed,
    ).toBe(true);

    expect(
      gradeTarget("pc:thorin", { expect: { allowed: ["pc:thorin"] } }).passed,
    ).toBe(true);
  });
});
