/**
 * Tutorial launch gate (TUT-1, #177, D7) — pure redirect decision logic.
 *
 * When `TUTORIAL_GATE=first_run`, brand-new users (`not_started`: no
 * `tutorial_progress` row) are sent to the `/tutorial` splash on app entry.
 * Completed, skipped, and in-progress users are never re-gated. Default `off`
 * keeps closed alpha + local dev unblocked.
 */

/** Feature flag values for `TUTORIAL_GATE` (`docs/product-spec.md` §5.2). */
export type TutorialGateMode = "off" | "first_run";

/** Derived tutorial lifecycle for gate decisions (includes pre-start). */
export type TutorialProgressState =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

/** Parse `TUTORIAL_GATE`; unknown values fall back to `off`. */
export function parseTutorialGateMode(
  raw: string | undefined,
): TutorialGateMode {
  return raw === "first_run" ? "first_run" : "off";
}

/** Map a `tutorial_progress` row (or absence) to a gate state. */
export function tutorialProgressState(
  row: { status: string } | null | undefined,
): TutorialProgressState {
  if (!row) return "not_started";
  if (
    row.status === "in_progress" ||
    row.status === "completed" ||
    row.status === "skipped"
  ) {
    return row.status;
  }
  return "not_started";
}

/** Routes that must never trigger a gate redirect (avoid loops). */
export function isTutorialGateExemptPath(pathname: string): boolean {
  return (
    pathname === "/tutorial" ||
    pathname.startsWith("/tutorial/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api")
  );
}

/**
 * Whether an authenticated app entry should redirect to `/tutorial`.
 * Only `first_run` + `not_started` + a non-exempt path returns true.
 */
export function shouldRedirectToTutorialSplash(
  gate: TutorialGateMode,
  progress: TutorialProgressState,
  pathname: string,
): boolean {
  if (gate !== "first_run") return false;
  if (progress !== "not_started") return false;
  if (isTutorialGateExemptPath(pathname)) return false;
  return true;
}
