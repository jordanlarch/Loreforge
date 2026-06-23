import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { tasks } from "@trigger.dev/sdk/v3";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@app/db";
import * as schema from "@app/db/schema";
import {
  REALM_ENTITY_SOURCE,
  createDeterministicEmbeddingClient,
  retrieveSimilar,
  type EmbeddableRealmEntity,
} from "@app/memory";

import { embedRealmEntityOnWrite } from "./embed";

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: { trigger: vi.fn(async () => ({ id: "run_1" })) },
}));

const OWNER = "00000000-0000-4000-8000-000000000001";
const ENTITY = "00000000-0000-4000-8000-0000000000a1";

const CREATE_EMBEDDINGS = `
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
`;

const entity: EmbeddableRealmEntity = {
  id: ENTITY,
  ownerId: OWNER,
  type: "npc",
  name: "Ember the Red Dragon",
  summary: "A fearsome red dragon hoarding gold in a volcanic lair",
  data: {},
  isStub: false,
};

const client = createDeterministicEmbeddingClient();
let pg: PGlite;
let db: Database;

async function rowCount(): Promise<number> {
  const res = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM embeddings WHERE source_id = $1",
    [ENTITY],
  );
  return res.rows[0]!.count;
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pg.exec(CREATE_EMBEDDINGS);
  db = drizzle(pg, { schema }) as unknown as Database;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec("DELETE FROM embeddings;");
  vi.mocked(tasks.trigger).mockClear();
  // The dispatch branch keys off this; default to "not configured" so the
  // inline-path tests are deterministic regardless of the ambient env.
  delete process.env.TRIGGER_SECRET_KEY;
});

describe("embedRealmEntityOnWrite", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalTrigger = process.env.TRIGGER_SECRET_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalTrigger === undefined) delete process.env.TRIGGER_SECRET_KEY;
    else process.env.TRIGGER_SECRET_KEY = originalTrigger;
  });

  it("embeds via an injected client so the entity is retrievable", async () => {
    await embedRealmEntityOnWrite(db, entity, { client });
    expect(await rowCount()).toBe(1);

    const hits = await retrieveSimilar(db, client, {
      ownerId: OWNER,
      sourceTypes: [REALM_ENTITY_SOURCE],
      queryText: "red dragon gold volcanic lair",
      k: 5,
    });
    expect(hits[0]!.sourceId).toBe(ENTITY);
  });

  it("no-ops when embedding is unconfigured and no client is injected", async () => {
    delete process.env.OPENAI_API_KEY;
    await embedRealmEntityOnWrite(db, entity);
    expect(await rowCount()).toBe(0);
  });

  it("skips stubs", async () => {
    await embedRealmEntityOnWrite(db, { ...entity, isStub: true }, { client });
    expect(await rowCount()).toBe(0);
  });

  it("dispatches to the durable job when Trigger is configured (MEM-7)", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
    await embedRealmEntityOnWrite(db, entity); // no injected client
    expect(tasks.trigger).toHaveBeenCalledWith("embed-entity", {
      entityId: ENTITY,
    });
    // Dispatched, not embedded inline.
    expect(await rowCount()).toBe(0);
  });

  it("never dispatches for stubs even when Trigger is configured", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
    await embedRealmEntityOnWrite(db, { ...entity, isStub: true });
    expect(tasks.trigger).not.toHaveBeenCalled();
  });

  it("stays inline (no dispatch) when an explicit client is injected", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
    await embedRealmEntityOnWrite(db, entity, { client });
    expect(tasks.trigger).not.toHaveBeenCalled();
    expect(await rowCount()).toBe(1);
  });
});
