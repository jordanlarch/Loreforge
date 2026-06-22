import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { chatMessages } from "./campaigns";
import * as schema from "./index";

// Hand-create just the table under test (mirrors migration 0011). The full
// migration set can't run on PGlite because earlier migrations use the pgvector
// `vector` type, so — like characters.test.ts — we DDL locally.
const DDL = `
  CREATE TABLE chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    seq integer NOT NULL,
    kind text NOT NULL,
    author text NOT NULL,
    mode text,
    text text NOT NULL,
    dice jsonb,
    mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX chat_messages_campaign_seq_unique
    ON chat_messages (campaign_id, seq);
`;

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(DDL);
  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

describe("chat_messages persistence (#96)", () => {
  it("round-trips kinds, dice, mentions, and re-hydrates in seq order", async () => {
    await db.insert(chatMessages).values([
      {
        campaignId: CAMPAIGN,
        seq: 0,
        kind: "player",
        author: "Thorin",
        mode: "action",
        text: "I draw my axe.",
      },
      {
        campaignId: CAMPAIGN,
        seq: 1,
        kind: "gm",
        author: "GM",
        text: "Snik recoils.",
        mentions: ["Snik"],
      },
      {
        campaignId: CAMPAIGN,
        seq: 2,
        kind: "roll",
        author: "Thorin",
        text: "rolled 1d20",
        dice: { notation: "1d20", rolls: [17], modifier: 0, total: 17 },
      },
    ]);

    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.campaignId, CAMPAIGN))
      .orderBy(asc(chatMessages.seq));

    expect(rows.map((r) => r.kind)).toEqual(["player", "gm", "roll"]);
    expect(rows[0]!.mode).toBe("action");
    expect(rows[1]!.mentions).toEqual(["Snik"]);
    expect(rows[2]!.dice).toEqual({
      notation: "1d20",
      rolls: [17],
      modifier: 0,
      total: 17,
    });
  });

  it("defaults mentions to an empty array and allows null dice/mode", async () => {
    const [row] = await db
      .insert(chatMessages)
      .values({
        campaignId: CAMPAIGN,
        seq: 3,
        kind: "ooc",
        author: "Thorin",
        text: "brb",
      })
      .returning();

    expect(row!.mentions).toEqual([]);
    expect(row!.dice).toBeNull();
    expect(row!.mode).toBeNull();
  });
});
