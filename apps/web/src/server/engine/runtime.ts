/**
 * Server-side engine runtime.
 *
 * Holds a single process-wide {@link Engine} backed by `PgEventStore`, so engine
 * state is event-sourced in Postgres (`engine_events`) and rebuilt from the log.
 * Commands for a campaign are funnelled through a per-campaign
 * {@link CampaignCommandQueue} so each validates against the state left by the
 * previous one. The same Command surface serves UI actions and (later) LLM tool
 * calls — one gate, equal validation (`docs/engine/architecture.md` §4).
 */
import { chatMessages, getDb, PgEventStore } from "@app/db";
import { eq } from "drizzle-orm";
import {
  CampaignCommandQueue,
  Engine,
  type Command,
  type CommandResult,
  type WorldState,
} from "@app/engine";

let engine: Engine | undefined;
const queues = new Map<string, CampaignCommandQueue>();

function getEngine(): Engine {
  if (!engine) {
    engine = new Engine({ store: new PgEventStore(getDb()) });
  }
  return engine;
}

function queueFor(campaignId: string): CampaignCommandQueue {
  let queue = queues.get(campaignId);
  if (!queue) {
    queue = new CampaignCommandQueue((command) =>
      getEngine().execute(campaignId, command),
    );
    queues.set(campaignId, queue);
  }
  return queue;
}

/** Submit a command for a campaign; serialized per campaign, persisted on accept. */
export function submitCommand(
  campaignId: string,
  command: Command,
): Promise<CommandResult> {
  return queueFor(campaignId).enqueue(command);
}

/** Current projected world state for a campaign, hydrated from Postgres. */
export function getCampaignState(campaignId: string): Promise<WorldState> {
  return getEngine().getState(campaignId);
}

/**
 * Wipe a campaign's engine log so the live room re-seeds from scratch (CAMP-8).
 * Arming a new authored encounter truncates the persisted events to zero; the WS
 * server then re-seeds the (now empty) campaign with the freshly-armed encounter
 * on its next load. The in-process engine/queue caches are dropped so a
 * subsequent web-side read rehydrates from the truncated log rather than stale
 * memory. Destructive by design: it discards the current fight's state.
 */
export async function resetCampaignLog(campaignId: string): Promise<void> {
  await new PgEventStore(getDb()).truncate(campaignId, 0);
  queues.delete(campaignId);
  engine = undefined;
}

/** Wipe persisted live-play chat when arming a fresh encounter (CAMP-8 Run Now). */
export async function clearCampaignChatLog(campaignId: string): Promise<void> {
  await getDb()
    .delete(chatMessages)
    .where(eq(chatMessages.campaignId, campaignId));
}
