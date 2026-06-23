import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sessions, type Database } from "@app/db";
import * as schema from "@app/db/schema";
import { createFakeLlmClient } from "@app/llm";
import {
  SESSION_RECAP_SOURCE,
  createDeterministicEmbeddingClient,
  retrieveSimilar,
} from "@app/memory";

import {
  embedRecapBestEffort,
  generateRecap,
  runAndStoreRecap,
} from "./recap";

const OWNER = "00000000-0000-4000-8000-000000000001";
const CAMPAIGN = "00000000-0000-4000-8000-0000000000b1";
const SESSION = "00000000-0000-4000-8000-0000000000c1";

const CREATE_SQL = `
  CREATE TABLE embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    campaign_id uuid,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    chunk_index integer NOT NULL DEFAULT 0,
    chunk_text text NOT NULL,
    embedding vector(1536) NOT NULL,
    model text NOT NULL DEFAULT '',
    content_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX embeddings_source_chunk_unique
    ON embeddings USING btree (source_type, source_id, chunk_index);
  CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    start_seq integer NOT NULL DEFAULT 0,
    end_seq integer NOT NULL,
    recap text NOT NULL DEFAULT '',
    model text NOT NULL DEFAULT '',
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz NOT NULL DEFAULT now()
  );
`;

const embClient = createDeterministicEmbeddingClient();
let pg: PGlite;
let db: Database;

async function seedSession(): Promise<void> {
  await db.insert(sessions).values({
    id: SESSION,
    campaignId: CAMPAIGN,
    ownerId: OWNER,
    startSeq: 0,
    endSeq: 4,
  });
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pg.exec(CREATE_SQL);
  db = drizzle(pg, { schema }) as unknown as Database;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec("DELETE FROM embeddings; DELETE FROM sessions;");
});

describe("generateRecap", () => {
  it("returns the model's recap text", async () => {
    const client = createFakeLlmClient({
      input: { recap: "The party escaped the marsh and reached Eldermoor." },
    });
    const { recap } = await generateRecap(client, [
      "Thorin: We run from the bog",
      "GM: You stumble into a fog-bound town",
    ]);
    expect(recap).toContain("Eldermoor");
    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("fog-bound town");
  });

  it("throws on empty recap output", async () => {
    const client = createFakeLlmClient({ input: { recap: "   " } });
    await expect(generateRecap(client, ["Thorin: hi"])).rejects.toThrow();
  });
});

describe("embedRecapBestEffort", () => {
  it("embeds the recap as a retrievable session_recap source", async () => {
    await seedSession();
    await embedRecapBestEffort(db, {
      sessionId: SESSION,
      campaignId: CAMPAIGN,
      ownerId: OWNER,
      recap: "The party reached the fog-bound town of Eldermoor.",
      client: embClient,
    });

    const hits = await retrieveSimilar(db, embClient, {
      ownerId: OWNER,
      campaignId: CAMPAIGN,
      sourceTypes: [SESSION_RECAP_SOURCE],
      queryText: "fog-bound town Eldermoor",
      k: 5,
    });
    expect(hits[0]?.sourceId).toBe(SESSION);
  });

  it("no-ops on a blank recap", async () => {
    await embedRecapBestEffort(db, {
      sessionId: SESSION,
      campaignId: CAMPAIGN,
      ownerId: OWNER,
      recap: "   ",
      client: embClient,
    });
    const res = await pg.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings",
    );
    expect(res.rows[0]!.count).toBe(0);
  });
});

describe("runAndStoreRecap", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("generates, stores onto the session row, and embeds the recap", async () => {
    await seedSession();
    const llmClient = createFakeLlmClient({
      input: { recap: "A daring escape through the haunted marsh." },
    });
    const result = await runAndStoreRecap(db, {
      sessionId: SESSION,
      campaignId: CAMPAIGN,
      ownerId: OWNER,
      lines: ["Thorin: run", "GM: you flee"],
      llmClient,
      embeddingClient: embClient,
    });
    expect(result.recap).toContain("haunted marsh");

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, SESSION));
    expect(row!.recap).toContain("haunted marsh");

    const res = await pg.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings",
    );
    expect(res.rows[0]!.count).toBe(1);
  });

  it("no-ops when recap generation is unconfigured (no client, no key)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await seedSession();
    const result = await runAndStoreRecap(db, {
      sessionId: SESSION,
      campaignId: CAMPAIGN,
      ownerId: OWNER,
      lines: ["Thorin: run"],
      embeddingClient: embClient,
    });
    expect(result.recap).toBe("");
    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, SESSION));
    expect(row!.recap).toBe("");
  });
});
