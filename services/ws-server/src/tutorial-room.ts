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
 *   - `say(topic)` returns a canned Scene 2 dialogue beat (the soft rail, D3b).
 *   - `summonCompanion()` brings Old Brennar into the current scene as a
 *     party-side entity so the party rail shows him (#171).
 *
 * Current-scene position is derived from the engine's `currentSceneId` (no extra
 * in-memory cursor), so a cold reload resumes exactly where the log left off.
 */
import {
  Engine,
  buildCompanionCommands,
  buildTutorialSeedCommands,
  checkAction,
  nextTutorialScene,
  tutorialBeat,
  tutorialScene,
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  type BattleAction,
  type Command,
  type CommandSummary,
  type EventStore,
  type PartyMember,
  type TutorialCheck,
  type TutorialDialogueBeat,
  type WorldState,
} from "@app/engine";

import {
  baselineSequence,
  type ApplyResult,
  type LiveRoom,
  type PartyLoader,
} from "./room.js";

/** The outcome of a scripted scene advance: the entered scene + its narration. */
export type AdvanceResult = {
  sceneId: string;
  narration: string;
  mentions?: readonly string[];
};

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
    return {
      sceneId: next.id,
      narration: next.narration,
      mentions: next.mentions,
    };
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

  /**
   * The canned dialogue beat for a Scene 2 topic (the soft rail, D3b). Pure
   * lookup — no engine mutation — so the caller can post it as GM narration.
   * Returns undefined for an unknown topic.
   */
  say(topic: string): TutorialDialogueBeat | undefined {
    return tutorialBeat(topic);
  }

  /**
   * Bring Old Brennar into the current scene as a party-side character entity so
   * he rides along in the party rail (#171). Idempotent: a no-op when he is
   * already present. Returns his display name on a fresh join, else null.
   */
  async summonCompanion(): Promise<string | null> {
    await this.ensureSeeded();
    const state = await this.engine.getState(this.campaignId);
    if (state.entities[TUTORIAL_COMPANION.id]) return null;
    const sceneId = state.currentSceneId;
    if (!sceneId) return null;
    for (const command of buildCompanionCommands(sceneId)) {
      await this.engine.execute(this.campaignId, command);
    }
    return TUTORIAL_COMPANION.name;
  }
}
