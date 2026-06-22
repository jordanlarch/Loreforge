/**
 * LLM tool-adherence harness (C2 / ENG-6) — closed-alpha forcing function.
 *
 * The deterministic boundary (Q12) only holds if the AI GM reliably calls the
 * right orchestrator tool with contract-valid arguments: an ability check picks
 * a sensible ability + a proportional DC, a monster picks a *legal* target, and
 * narration stays pure fiction (no dice, numbers, or hit/miss decisions). This
 * module grades those three orchestrator surfaces against a fixture set and
 * reports an adherence rate; §7 of the roadmap gates closed alpha at ≥98%.
 *
 * The harness is provider-agnostic: `runAdherence` drives the real orchestrators
 * (`decideCheck`, `decideMonsterTarget`, `narrate`) through whatever `LlmClient`
 * the caller supplies per fixture. In CI we feed deterministic fake clients (so
 * the framework + graders are themselves tested without a network); a nightly /
 * local run with `ANTHROPIC_API_KEY` set points `clientFor` at the live model to
 * compute the real gate.
 *
 * @see services/ws-server/src/narration.ts (the graded orchestrators)
 * @see docs/deferrals.md ENG-6 · docs/02-implementation-roadmap.md §7
 */
import { createFakeLlmClient, type LlmClient } from "@app/llm";
import type { WorldState } from "@app/engine";

import {
  decideCheck,
  decideMonsterTarget,
  narrate,
  type CheckDecision,
  type MonsterTargetOption,
} from "../narration.js";

export type GradeResult = { passed: boolean; reasons: string[] };

/** A free-text "Check" the GM must route to an ability/skill/DC. */
export type CheckFixture = {
  kind: "check";
  id: string;
  playerLine: string;
  state?: WorldState;
  expect: {
    /** Governing abilities that count as adherent (usually one or two). */
    abilities: readonly string[];
    dcMin: number;
    dcMax: number;
    /** If set, the chosen skill must contain one of these (case-insensitive). */
    skillIncludes?: readonly string[];
  };
  /** The tool arguments a well-behaved model returns (drives the fake client). */
  mock: { ability: string; skill?: string; dc: number; proficient?: boolean };
};

/** A monster turn the GM must resolve to a legal target. */
export type TargetFixture = {
  kind: "target";
  id: string;
  monsterName: string;
  candidates: MonsterTargetOption[];
  state?: WorldState;
  /** Target ids that count as adherent (at minimum: any legal candidate). */
  expect: { allowed: readonly string[] };
  mock: { targetId: string };
};

/** A narration turn that must stay pure fiction (no mechanics). */
export type NarrateFixture = {
  kind: "narrate";
  id: string;
  playerLine: string;
  mode?: string;
  state?: WorldState;
  expect?: { mentionsSubsetOf?: readonly string[] };
  mock: { narration: string; mentions?: string[] };
};

export type AdherenceFixture = CheckFixture | TargetFixture | NarrateFixture;

/** Any bare digit or dice notation leaking into prose breaks the fiction-only
 * contract (the engine owns every number the players see). */
const NUMERIC_LEAK = /\d/;

export function gradeCheck(
  decision: CheckDecision,
  fx: Pick<CheckFixture, "expect">,
): GradeResult {
  const reasons: string[] = [];
  if (!fx.expect.abilities.includes(decision.ability)) {
    reasons.push(
      `ability "${decision.ability}" not in [${fx.expect.abilities.join(", ")}]`,
    );
  }
  if (decision.dc < fx.expect.dcMin || decision.dc > fx.expect.dcMax) {
    reasons.push(
      `dc ${decision.dc} outside [${fx.expect.dcMin}, ${fx.expect.dcMax}]`,
    );
  }
  if (fx.expect.skillIncludes) {
    const skill = (decision.skill ?? "").toLowerCase();
    const ok = fx.expect.skillIncludes.some((k) =>
      skill.includes(k.toLowerCase()),
    );
    if (!ok) {
      reasons.push(
        `skill "${decision.skill ?? "(none)"}" matches none of [${fx.expect.skillIncludes.join(", ")}]`,
      );
    }
  }
  return { passed: reasons.length === 0, reasons };
}

export function gradeTarget(
  chosen: string | undefined,
  fx: Pick<TargetFixture, "expect">,
): GradeResult {
  if (!chosen) return { passed: false, reasons: ["no target chosen"] };
  if (!fx.expect.allowed.includes(chosen)) {
    return {
      passed: false,
      reasons: [`target "${chosen}" not in [${fx.expect.allowed.join(", ")}]`],
    };
  }
  return { passed: true, reasons: [] };
}

export function gradeNarration(
  result: { text: string; mentions: string[] },
  fx: Pick<NarrateFixture, "expect">,
): GradeResult {
  const reasons: string[] = [];
  if (!result.text.trim()) reasons.push("empty narration");
  if (NUMERIC_LEAK.test(result.text)) {
    reasons.push("narration leaked a number / dice (mechanics belong to the engine)");
  }
  const subset = fx.expect?.mentionsSubsetOf;
  if (subset) {
    const allowed = new Set(subset.map((n) => n.toLowerCase()));
    const stray = result.mentions.filter((m) => !allowed.has(m.toLowerCase()));
    if (stray.length > 0) {
      reasons.push(`mentions off-scene entities: ${stray.join(", ")}`);
    }
  }
  return { passed: reasons.length === 0, reasons };
}

export type AdherenceFailure = {
  id: string;
  kind: AdherenceFixture["kind"];
  reasons: string[];
};

export type AdherenceReport = {
  total: number;
  passed: number;
  rate: number;
  failures: AdherenceFailure[];
};

/** A deterministic fake client that returns a fixture's `mock` tool arguments. */
export function mockClientFor(fx: AdherenceFixture): LlmClient {
  return createFakeLlmClient({ input: fx.mock });
}

/**
 * Run every fixture through its real orchestrator with a per-fixture client and
 * grade the result. `clientFor` chooses the backend: `mockClientFor` for the CI
 * self-check, or the live Anthropic client for the real gate.
 */
export async function runAdherence(opts: {
  fixtures: readonly AdherenceFixture[];
  clientFor: (fx: AdherenceFixture) => LlmClient;
}): Promise<AdherenceReport> {
  const failures: AdherenceFailure[] = [];
  let passed = 0;

  for (const fx of opts.fixtures) {
    const client = opts.clientFor(fx);
    let grade: GradeResult;
    try {
      if (fx.kind === "check") {
        const decision = await decideCheck({
          client,
          state: fx.state,
          playerLine: fx.playerLine,
        });
        grade = gradeCheck(decision, fx);
      } else if (fx.kind === "target") {
        const chosen = await decideMonsterTarget({
          client,
          state: fx.state,
          monsterName: fx.monsterName,
          candidates: fx.candidates,
        });
        grade = gradeTarget(chosen, fx);
      } else {
        const result = await narrate({
          client,
          state: fx.state,
          recentChat: [],
          playerLine: fx.playerLine,
          mode: fx.mode,
        });
        grade = gradeNarration(result, fx);
      }
    } catch (err) {
      grade = {
        passed: false,
        reasons: [`threw: ${(err as Error).message}`],
      };
    }
    if (grade.passed) passed += 1;
    else failures.push({ id: fx.id, kind: fx.kind, reasons: grade.reasons });
  }

  const total = opts.fixtures.length;
  return { total, passed, rate: total === 0 ? 0 : passed / total, failures };
}
