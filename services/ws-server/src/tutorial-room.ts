/**
 * Scripted onboarding room (TUT-1, D3a) — the server-side driver for "Lantern's
 * Last Flicker".
 *
 * A Postgres-backed {@link LiveRoom} (like {@link CampaignRoom}) whose seed +
 * progression come from the data-driven {@link TUTORIAL_SCRIPT} (`@app/engine`)
 * instead of the default encounter. The deterministic engine still owns every
 * mechanic (scene state, ability checks, later combat) — this class only decides
 * *which scripted commands to run when*, driven by explicit triggers:
 *
 *   - `advance()` runs the next scene's enter-commands (a UI "continue" trigger).
 *   - `runScriptedCheck()` resolves the current scene's offered ability check
 *     through the engine (a deterministic dice roll, air-gapped-safe — no LLM).
 *
 * Current-scene position is derived from the engine's `currentSceneId` (no extra
 * in-memory cursor), so a cold reload resumes exactly where the log left off.
 * This is the tracer slice (#169): scene 1 + a stub scene 2. Later slices append
 * scenes to the script; this driver is unchanged.
 */
import {
  Engine,
  buildTutorialSeedCommands,
  checkAction,
  nextTutorialScene,
  tutorialScene,
  TUTORIAL_FALLBACK_PARTY,
  type BattleAction,
  type Command,
  type CommandSummary,
  type EventStore,
  type PartyMember,
  type TutorialCheck,
  type WorldState,
} from "@app/engine";

import {
  baselineSequence,
  type ApplyResult,
  type LiveRoom,
  type PartyLoader,
} from "./room.js";

/** The outcome of a scripted scene advance: the entered scene + its narration. */
export type AdvanceResult = { sceneId: string; narration: string };

/** The outcome of a scripted check: the engine verdict + the scene's copy. */
export type ScriptedCheckResult = {
  accepted: boolean;
  actorName: string;
  summary?: CommandSummary;
  check: TutorialCheck;
};

export class TutorialRoom implements LiveRoom {
  private engine: Engine;
  private seeded = false;

  constructor(
    private readonly campaignId: string,
    private readonly store: EventStore,
    /** Loads the seeded tutorial PC (Mira); falls back to the fixture PC. */
    private readonly loadParty?: PartyLoader,
  ) {
    this.engine = new Engine({ store });
  }

  /** The persisted tutorial roster, or the deterministic fallback PC. */
  private async party(): Promise<readonly PartyMember[]> {
    const loaded = this.loadParty ? await this.loadParty(this.campaignId) : [];
    return loaded.length > 0 ? loaded : TUTORIAL_FALLBACK_PARTY;
  }

  /** The first-scene seed (placing the loaded PC); also the reset baseline. */
  private async seedCommands(): Promise<Command[]> {
    return buildTutorialSeedCommands(await this.party());
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if ((await this.store.lastSequence(this.campaignId)) === 0) {
      for (const command of await this.seedCommands()) {
        await this.engine.execute(this.campaignId, command);
      }
    }
    this.seeded = true;
  }

  async apply(action: BattleAction): Promise<ApplyResult> {
    await this.ensureSeeded();
    const result = await this.engine.execute(this.campaignId, action);
    return result.accepted
      ? { accepted: true, summary: result.summary }
      : { accepted: false };
  }

  /** Truncate back to the first-scene seed (replay-from-start; full replay UX is a later slice). */
  async reset(): Promise<void> {
    await this.ensureSeeded();
    const baseline = await baselineSequence(await this.seedCommands());
    await this.store.truncate(this.campaignId, baseline);
    this.engine = new Engine({ store: this.store });
  }

  async getState(): Promise<WorldState> {
    await this.ensureSeeded();
    return this.engine.getState(this.campaignId);
  }

  /**
   * Run the next scene's enter-commands (the scripted "continue" trigger).
   * Returns the entered scene + its canned narration, or null at the end of the
   * script (no-op). Position is derived from the engine's current scene.
   */
  async advance(): Promise<AdvanceResult | null> {
    await this.ensureSeeded();
    const state = await this.engine.getState(this.campaignId);
    const next = nextTutorialScene(state.currentSceneId);
    if (!next) return null;
    const party = await this.party();
    for (const command of next.enter(party)) {
      await this.engine.execute(this.campaignId, command);
    }
    return { sceneId: next.id, narration: next.narration };
  }

  /**
   * Resolve the current scene's offered ability check through the engine — a
   * deterministic d20 the GM never fudges. Returns null when the scene offers no
   * check, or there is no PC to roll it. The caller renders the engine row +
   * the scene's success/failure copy.
   */
  async runScriptedCheck(): Promise<ScriptedCheckResult | null> {
    await this.ensureSeeded();
    const state = await this.engine.getState(this.campaignId);
    const scene = tutorialScene(state.currentSceneId);
    if (!scene?.check) return null;
    const pc = Object.values(state.entities).find((e) => e.kind === "character");
    if (!pc) return null;

    const { accepted, summary } = await this.apply(
      checkAction(pc.id, scene.check.ability, {
        skill: scene.check.skill,
        dc: scene.check.dc,
        proficient: scene.check.proficient,
      }),
    );
    return { accepted, summary, check: scene.check, actorName: pc.name };
  }
}
