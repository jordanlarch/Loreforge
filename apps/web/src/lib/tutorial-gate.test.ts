import { describe, expect, it } from "vitest";

import {
  isTutorialGateExemptPath,
  parseTutorialGateMode,
  shouldRedirectToTutorialSplash,
  tutorialProgressState,
} from "./tutorial-gate";

describe("tutorial launch gate (#177)", () => {
  describe("parseTutorialGateMode", () => {
    it("defaults to off when unset or unknown", () => {
      expect(parseTutorialGateMode(undefined)).toBe("off");
      expect(parseTutorialGateMode("")).toBe("off");
      expect(parseTutorialGateMode("yes")).toBe("off");
    });

    it("accepts first_run", () => {
      expect(parseTutorialGateMode("first_run")).toBe("first_run");
    });
  });

  describe("tutorialProgressState", () => {
    it("treats a missing row as not_started", () => {
      expect(tutorialProgressState(null)).toBe("not_started");
      expect(tutorialProgressState(undefined)).toBe("not_started");
    });

    it("maps persisted statuses", () => {
      expect(tutorialProgressState({ status: "in_progress" })).toBe(
        "in_progress",
      );
      expect(tutorialProgressState({ status: "completed" })).toBe("completed");
      expect(tutorialProgressState({ status: "skipped" })).toBe("skipped");
    });
  });

  describe("isTutorialGateExemptPath", () => {
    it("exempts tutorial, auth, and api routes", () => {
      expect(isTutorialGateExemptPath("/tutorial")).toBe(true);
      expect(isTutorialGateExemptPath("/tutorial/play")).toBe(true);
      expect(isTutorialGateExemptPath("/login")).toBe(true);
      expect(isTutorialGateExemptPath("/auth/callback")).toBe(true);
      expect(isTutorialGateExemptPath("/api/trpc/tutorial.get")).toBe(true);
      expect(isTutorialGateExemptPath("/")).toBe(false);
      expect(isTutorialGateExemptPath("/campaigns")).toBe(false);
    });
  });

  describe("shouldRedirectToTutorialSplash", () => {
    it("never redirects when the gate is off", () => {
      expect(
        shouldRedirectToTutorialSplash("off", "not_started", "/"),
      ).toBe(false);
    });

    it("redirects first_run not_started users on gated paths", () => {
      expect(
        shouldRedirectToTutorialSplash("first_run", "not_started", "/"),
      ).toBe(true);
      expect(
        shouldRedirectToTutorialSplash("first_run", "not_started", "/codex"),
      ).toBe(true);
    });

    it("does not redirect completed, skipped, or in-progress users", () => {
      for (const state of ["completed", "skipped", "in_progress"] as const) {
        expect(
          shouldRedirectToTutorialSplash("first_run", state, "/"),
        ).toBe(false);
      }
    });

    it("does not redirect on exempt paths even when not_started", () => {
      expect(
        shouldRedirectToTutorialSplash("first_run", "not_started", "/tutorial"),
      ).toBe(false);
    });
  });
});
