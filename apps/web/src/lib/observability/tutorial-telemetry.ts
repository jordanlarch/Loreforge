/**
 * Tutorial funnel telemetry (TUT-1, #178, D8) — env-gated observability stub.
 *
 * Emits to PostHog when `NEXT_PUBLIC_POSTHOG_KEY` is set (browser only); otherwise
 * logs in development. Never throws — onboarding must survive offline telemetry.
 */

export type TutorialTelemetryEvent =
  | { name: "tutorial_start" }
  | { name: "tutorial_skip" }
  | { name: "tutorial_replay" }
  | { name: "tutorial_continue" }
  | { name: "tutorial_complete" }
  | { name: "tutorial_scene_complete"; sceneId: string };

/** Record a tutorial funnel event (no-op when telemetry is unconfigured). */
export function trackTutorialEvent(event: TutorialTelemetryEvent): void {
  try {
    if (typeof window !== "undefined") {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (key) {
        // Lazy require keeps posthog-js out of server bundles that import this path.
        void import("posthog-js").then(({ default: posthog }) => {
          posthog.capture(event.name, "sceneId" in event ? { sceneId: event.sceneId } : {});
        });
        return;
      }
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[tutorial-telemetry]", event);
    }
  } catch {
    // Telemetry must never break onboarding.
  }
}
