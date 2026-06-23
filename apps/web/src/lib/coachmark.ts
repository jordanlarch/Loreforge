/**
 * Coachmark / first-time-tooltip logic (TUT-1, D5) — pure, browser-agnostic.
 *
 * The anchored coachmark *component* (positioning, spotlight, a11y) lives in
 * `@/components/coachmark`; the sequencing rules live here so they are unit
 * testable without a DOM. A coachmark fires once ever per user: the component
 * merges the server-persisted seen set with this-session dismissals, evaluates
 * which triggers are ready, and shows the first eligible one (never stacked).
 *
 * Shared infra (not tutorial-only): global app tooltips reuse the same defs +
 * `tutorial_seen_features` ledger, keyed by a stable string `id`.
 */

/** When a coachmark becomes eligible to show. */
export type CoachmarkTrigger =
  | { kind: "first_seen" }
  | { kind: "on_action"; action: string }
  | { kind: "after_delay_ms"; ms: number };

export type CoachmarkDef = {
  /** Stable, global feature id — the `tutorial_seen_features.feature_id`. */
  id: string;
  /** `data-coachmark` value of the element this points at. */
  anchor: string;
  title: string;
  body: string;
  trigger: CoachmarkTrigger;
};

/** Union of the server-persisted seen ids and ids dismissed this session. */
export function mergeSeen(
  serverSeen: Iterable<string>,
  localSeen: Iterable<string>,
): Set<string> {
  return new Set<string>([...serverSeen, ...localSeen]);
}

/** Inputs that determine whether each trigger has fired. */
export type TriggerContext = {
  /** `data-coachmark` ids whose anchor element is currently in the DOM. */
  anchorsPresent: ReadonlySet<string>;
  /** Action names the consumer has signalled (for `on_action`). */
  firedActions: ReadonlySet<string>;
  /** Coachmark ids whose `after_delay_ms` timer has elapsed. */
  elapsedDelayIds: ReadonlySet<string>;
};

/** Whether a single def's trigger condition is currently satisfied. */
export function isTriggerReady(
  def: CoachmarkDef,
  ctx: TriggerContext,
): boolean {
  switch (def.trigger.kind) {
    case "first_seen":
      // Fires once its target element exists (i.e. has been rendered/observed).
      return ctx.anchorsPresent.has(def.anchor);
    case "on_action":
      return ctx.firedActions.has(def.trigger.action);
    case "after_delay_ms":
      return ctx.elapsedDelayIds.has(def.id);
  }
}

/** The set of def ids whose trigger has fired, given the current context. */
export function readyTriggerIds(
  defs: readonly CoachmarkDef[],
  ctx: TriggerContext,
): Set<string> {
  const ready = new Set<string>();
  for (const def of defs) {
    if (isTriggerReady(def, ctx)) ready.add(def.id);
  }
  return ready;
}

/**
 * The next coachmark to show: the first def, in declaration order, that is not
 * yet `seen` and whose trigger is in `triggered`. Returns null when none
 * qualifies — exactly one is ever shown at a time.
 */
export function selectActiveCoachmark(
  defs: readonly CoachmarkDef[],
  seen: ReadonlySet<string>,
  triggered: ReadonlySet<string>,
): CoachmarkDef | null {
  for (const def of defs) {
    if (seen.has(def.id)) continue;
    if (!triggered.has(def.id)) continue;
    return def;
  }
  return null;
}

/** Count of not-yet-seen coachmarks remaining (drives the Got it/Next label). */
export function remainingCount(
  defs: readonly CoachmarkDef[],
  seen: ReadonlySet<string>,
): number {
  return defs.reduce((n, def) => (seen.has(def.id) ? n : n + 1), 0);
}
