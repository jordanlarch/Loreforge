/**
 * @app/engine — deterministic 5E rules engine (P0 stub).
 * Event store, Command API, and projections land in P1 (E1).
 * @see docs/engine/architecture.md
 */

export const ENGINE_VERSION = "0.0.0-p0" as const;

export type EngineHealth = {
  version: typeof ENGINE_VERSION;
  ready: boolean;
};

export function getEngineHealth(): EngineHealth {
  return {
    version: ENGINE_VERSION,
    ready: false,
  };
}
