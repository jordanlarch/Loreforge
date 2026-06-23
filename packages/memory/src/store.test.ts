import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@app/db/schema";

import { buildEntityEmbeddingInput, type EmbeddableRealmEntity } from "./chunk";
import {
  createDeterministicEmbeddingClient,
  type EmbeddingClient,
} from "./client";
import {
  REALM_ENTITY_SOURCE,
  embedRealmEntity,
  embedRealmEntityBestEffort,
  retrieveSimilar,
  upsertSourceEmbeddings,
} from "./store";

const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER_OWNER = "00000000-0000-4000-8000-000000000002";
const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";

const ID = {
  dragon: "00000000-0000-4000-8000-0000000000a1",
  tavern: "00000000-0000-4000-8000-0000000000a2",
  wizard: "00000000-0000-4000-8000-0000000000a3",
  foreign: "00000000-0000-4000-8000-0000000000a4",
};

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
  CREATE INDEX embeddings_hnsw_idx
    ON embeddings USING hnsw (embedding vector_cosine_ops);
`;

const entity = (
  over: Partial<EmbeddableRealmEntity> & Pick<EmbeddableRealmEntity, "id" | "name" | "summary">,
): EmbeddableRealmEntity => ({
  ownerId: OWNER,
  type: "npc",
  data: {},
  isStub: false,
  ...over,
});

const dragon = entity({
  id: ID.dragon,
  type: "npc",
  name: "Ember the Red Dragon",
  summary: "A fearsome red dragon hoarding gold in a volcanic mountain lair",
});
const tavern = entity({
  id: ID.tavern,
  type: "tavern",
  name: "The Prancing Pony",
  summary: "A cozy tavern serving warm ale and hearty stew to weary travelers",
});
const wizard = entity({
  id: ID.wizard,
  type: "npc",
  name: "Gandor the Grey",
  summary: "An ancient wizard who studies arcane magic and forgotten tomes",
});

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const embedder = createDeterministicEmbeddingClient();

async function embedEntity(e: EmbeddableRealmEntity) {
  const chunk = buildEntityEmbeddingInput(e);
  if (!chunk) return;
  await upsertSourceEmbeddings(db, embedder, {
    ownerId: e.ownerId,
    sourceType: REALM_ENTITY_SOURCE,
    sourceId: e.id,
    chunks: [chunk],
  });
}

beforeAll(async () => {
  client = new PGlite({ extensions: { vector } });
  await client.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await client.exec(CREATE_EMBEDDINGS);
  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec("DELETE FROM embeddings;");
});

describe("upsertSourceEmbeddings + retrieveSimilar (pgvector via PGlite)", () => {
  it("retrieves the exact source for its own composed text at score ~1.0", async () => {
    await embedEntity(dragon);
    const chunk = buildEntityEmbeddingInput(dragon)!;

    const hits = await retrieveSimilar(db, embedder, {
      ownerId: OWNER,
      queryText: chunk.chunkText,
      k: 5,
    });

    expect(hits.length).toBe(1);
    expect(hits[0]!.sourceId).toBe(ID.dragon);
    expect(hits[0]!.score).toBeCloseTo(1, 5);
  });

  it("ranks lexically-related entities above unrelated ones", async () => {
    await embedEntity(dragon);
    await embedEntity(tavern);
    await embedEntity(wizard);

    const hits = await retrieveSimilar(db, embedder, {
      ownerId: OWNER,
      queryText: "a red dragon guarding its hoard of gold in a volcanic lair",
      k: 3,
    });

    expect(hits.map((h) => h.sourceId)).toContain(ID.dragon);
    expect(hits[0]!.sourceId).toBe(ID.dragon);
    // The unrelated tavern should score below the dragon.
    const dragonHit = hits.find((h) => h.sourceId === ID.dragon)!;
    const tavernHit = hits.find((h) => h.sourceId === ID.tavern)!;
    expect(dragonHit.score).toBeGreaterThan(tavernHit.score);
  });

  it("skips re-embedding when contentHash is unchanged", async () => {
    await embedEntity(dragon);
    const callsAfterFirst = embedder.calls.length;

    const chunk = buildEntityEmbeddingInput(dragon)!;
    const result = await upsertSourceEmbeddings(db, embedder, {
      ownerId: OWNER,
      sourceType: REALM_ENTITY_SOURCE,
      sourceId: ID.dragon,
      chunks: [chunk],
    });

    expect(result).toEqual({
      status: "unchanged",
      embedded: 0,
      model: "",
      tokens: 0,
    });
    // No new embed call was made for the unchanged source.
    expect(embedder.calls.length).toBe(callsAfterFirst);
  });

  it("re-embeds when the content changes", async () => {
    await embedEntity(dragon);
    const updated = { ...dragon, summary: "Now a slumbering white dragon in an icy cavern" };
    const result = await upsertSourceEmbeddings(db, embedder, {
      ownerId: OWNER,
      sourceType: REALM_ENTITY_SOURCE,
      sourceId: ID.dragon,
      chunks: [buildEntityEmbeddingInput(updated)!],
    });
    expect(result.status).toBe("embedded");

    const rows = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings WHERE source_id = $1",
      [ID.dragon],
    );
    // delete-then-insert keeps a single chunk row, not a duplicate.
    expect(rows.rows[0]!.count).toBe(1);
  });

  it("scopes retrieval to the owner", async () => {
    await embedEntity(dragon);
    await embedEntity({ ...dragon, id: ID.foreign, ownerId: OTHER_OWNER });

    const hits = await retrieveSimilar(db, embedder, {
      ownerId: OWNER,
      queryText: "red dragon",
      k: 10,
    });
    expect(hits.every((h) => h.sourceId !== ID.foreign)).toBe(true);
  });

  it("filters by sourceType", async () => {
    await embedEntity(dragon);
    await upsertSourceEmbeddings(db, embedder, {
      ownerId: OWNER,
      campaignId: CAMPAIGN,
      sourceType: "note",
      sourceId: ID.tavern,
      chunks: [{ chunkText: "a red dragon note", contentHash: "h1" }],
    });

    const hits = await retrieveSimilar(db, embedder, {
      ownerId: OWNER,
      sourceTypes: [REALM_ENTITY_SOURCE],
      queryText: "red dragon",
      k: 10,
    });
    expect(hits.every((h) => h.sourceType === REALM_ENTITY_SOURCE)).toBe(true);
  });

  it("clears existing rows when upserting an empty chunk set", async () => {
    await embedEntity(dragon);
    const result = await upsertSourceEmbeddings(db, embedder, {
      ownerId: OWNER,
      sourceType: REALM_ENTITY_SOURCE,
      sourceId: ID.dragon,
      chunks: [],
    });
    expect(result).toEqual({
      status: "embedded",
      embedded: 0,
      model: "",
      tokens: 0,
    });

    const rows = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings WHERE source_id = $1",
      [ID.dragon],
    );
    expect(rows.rows[0]!.count).toBe(0);
  });
});

describe("embedRealmEntity", () => {
  it("embeds a real entity so it is retrievable", async () => {
    const result = await embedRealmEntity(db, embedder, dragon);
    expect(result.status).toBe("embedded");

    const hits = await retrieveSimilar(db, embedder, {
      ownerId: OWNER,
      queryText: buildEntityEmbeddingInput(dragon)!.chunkText,
      k: 3,
    });
    expect(hits[0]!.sourceId).toBe(ID.dragon);
  });

  it("skips a stub without writing a row", async () => {
    const result = await embedRealmEntity(db, embedder, {
      ...dragon,
      isStub: true,
    });
    expect(result).toEqual({ status: "skipped" });

    const rows = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings WHERE source_id = $1",
      [ID.dragon],
    );
    expect(rows.rows[0]!.count).toBe(0);
  });
});

describe("embedRealmEntityBestEffort", () => {
  it("swallows provider failures and reports them via onError", async () => {
    const failing: EmbeddingClient = {
      model: "boom",
      embed: async () => {
        throw new Error("provider down");
      },
    };
    let captured: unknown;
    const result = await embedRealmEntityBestEffort(db, failing, dragon, {
      onError: (e) => {
        captured = e;
      },
    });
    expect(result).toBeNull();
    expect((captured as Error).message).toBe("provider down");

    // The originating write is unaffected: no rows were written.
    const rows = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM embeddings WHERE source_id = $1",
      [ID.dragon],
    );
    expect(rows.rows[0]!.count).toBe(0);
  });

  it("returns the result and fires onResult on success", async () => {
    let seen: string | undefined;
    const result = await embedRealmEntityBestEffort(db, embedder, dragon, {
      onResult: (r) => {
        seen = r.status;
      },
    });
    expect(result?.status).toBe("embedded");
    expect(seen).toBe("embedded");
  });
});
