import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@app/db";
import * as schema from "@app/db/schema";
import {
  createDeterministicEmbeddingClient,
  type EmbeddableRealmEntity,
  type EmbeddingClient,
} from "@app/memory";

import { embedRealmEntityOnWrite } from "./embed";
import { loadRelatedLore } from "./related-lore";

const OWNER = "00000000-0000-4000-8000-000000000001";
const MARSH = "00000000-0000-4000-8000-0000000000a1";
const ACADEMY = "00000000-0000-4000-8000-0000000000a2";

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

const marsh: EmbeddableRealmEntity = {
  id: MARSH,
  ownerId: OWNER,
  type: "settlement",
  name: "Eldermoor",
  summary: "A fog-bound marsh town ruled by a paranoid reclusive baron",
  data: {},
  isStub: false,
};

const academy: EmbeddableRealmEntity = {
  id: ACADEMY,
  ownerId: OWNER,
  type: "building",
  name: "Sunspire Academy",
  summary: "A gleaming college teaching evocation magic to gifted students",
  data: {},
  isStub: false,
};

const client = createDeterministicEmbeddingClient();
let pg: PGlite;
let db: Database;

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
  await embedRealmEntityOnWrite(db, marsh, { client });
  await embedRealmEntityOnWrite(db, academy, { client });
});

describe("loadRelatedLore", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns the most-similar existing entity for a concept", async () => {
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "a fog-bound marsh town with a paranoid baron",
      client,
    });
    expect(lore.length).toBeGreaterThan(0);
    expect(lore[0]).toContain("Eldermoor");
  });

  it("excludes the entity being expanded from its own grounding", async () => {
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "a fog-bound marsh town with a paranoid baron",
      excludeEntityId: MARSH,
      client,
    });
    // The only strong match is excluded; the unrelated academy is below the floor.
    expect(lore).toEqual([]);
  });

  it("drops neighbors below the similarity floor (unrelated concept)", async () => {
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "zzzqux nonsensical unrelated gibberish tokens",
      client,
    });
    expect(lore).toEqual([]);
  });

  it("no-ops when embeddings are unconfigured and no client is injected", async () => {
    delete process.env.OPENAI_API_KEY;
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "a fog-bound marsh town",
    });
    expect(lore).toEqual([]);
  });

  it("returns [] for a blank query", async () => {
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "   ",
      client,
    });
    expect(lore).toEqual([]);
  });

  it("swallows retrieval failures (best-effort)", async () => {
    const throwing: EmbeddingClient = {
      model: "boom",
      embed: async () => {
        throw new Error("provider down");
      },
    };
    const lore = await loadRelatedLore(db, {
      ownerId: OWNER,
      queryText: "anything",
      client: throwing,
    });
    expect(lore).toEqual([]);
  });
});
