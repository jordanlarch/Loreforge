import { describe, expect, it } from "vitest";

import {
  shouldAutoProgressScene,
  shouldShowTutorialHint,
  TUTORIAL_HINT_AUTO_DISMISS_THRESHOLD,
  TUTORIAL_HINT_IDLE_MS,
} from "./tutorial-hint";

describe("tutorial idle hints (#178)", () => {
  it("shows a hint after 45s idle", () => {
    expect(shouldShowTutorialHint(TUTORIAL_HINT_IDLE_MS - 1, 0)).toBe(false);
    expect(shouldShowTutorialHint(TUTORIAL_HINT_IDLE_MS, 0)).toBe(true);
  });

  it("hides the hint chip once auto-progress threshold is reached", () => {
    expect(
      shouldShowTutorialHint(TUTORIAL_HINT_IDLE_MS + 1000, 3),
    ).toBe(false);
  });

  it("auto-progresses after 3 dismissals", () => {
    expect(shouldAutoProgressScene(2)).toBe(false);
    expect(shouldAutoProgressScene(TUTORIAL_HINT_AUTO_DISMISS_THRESHOLD)).toBe(
      true,
    );
  });
});
