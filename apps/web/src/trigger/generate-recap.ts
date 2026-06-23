import { logger, task } from "@trigger.dev/sdk/v3";

import { getDb } from "@app/db";

import { runAndStoreRecap } from "@/server/memory/recap";

export type GenerateRecapPayload = {
  sessionId: string;
  campaignId: string;
  ownerId: string;
  /** "Author: text" transcript lines for the session span being recapped. */
  lines: string[];
};

export type GenerateRecapResult = { recap: string };

/**
 * Durable session recap generation (MEM-4, #145).
 *
 * The timeout-free route for end-session recaps: generate the recap, persist it
 * onto the session row, and embed it as a `session_recap` source. The
 * `sessions.end` mutation also runs this inline (best-effort) when no runtime
 * key is configured; this task is dispatched instead when `TRIGGER_SECRET_KEY`
 * is present (and requires the `tr_prod_` key in the Trigger.dev prod env —
 * `docs/deferrals.md` INFRA-1). Mirrors `generate-cascade`.
 */
export const generateRecap = task({
  id: "generate-recap",
  maxDuration: 300,
  run: async (payload: GenerateRecapPayload): Promise<GenerateRecapResult> => {
    const db = getDb();
    const { recap } = await runAndStoreRecap(db, {
      sessionId: payload.sessionId,
      campaignId: payload.campaignId,
      ownerId: payload.ownerId,
      lines: payload.lines,
    });
    logger.info("Session recap complete", {
      sessionId: payload.sessionId,
      recapLength: recap.length,
    });
    return { recap };
  },
});
