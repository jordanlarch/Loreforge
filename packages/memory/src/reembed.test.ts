import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { realmEntities, type Database } from "@app/db";
import * as schema from "@app/db/schema";

import { createDeterministicEmbeddingClient } from "./client";
import { reembedRealmEntities } from "./reembed";

const OWNER = "00000000-0000-4000-8000-000000000001";
const E1 = "00000000-0000-4000-8000-0000000000a1";
const E2 = "00000000-0000-4000-8000-0000000000a2";
const STUB = "00000000-0000-4000-8000-0000000000a3";

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
  CREATE TABLE realm_entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    summary text NOT NULL DEFAULT '',
    is_stub boolean NOT NULL DEFAULT false,
    data jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`;

const client = createDeterministicEmbeddingClient();
let pg: PGlite;
let db: Database;

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
  await pg.exec("DELETE FROM embeddings; DELETE FROM realm_entities;");
  await db.insert(realmEntities).values([
    { id: E1, ownerId: OWNER, type: "npc", name: "Ember", summary: "A red dragon" },
    { id: E2, ownerId: OWNER, type: "region", name: "Frostmere", summary: "A frozen vale" },
    { id: STUB, ownerId: OWNER, type: "npc", name: "???", summary: "", isStub: true },
  ]);
});

describe("reembedRealmEntities", () => {
  it("embeds the non-stub entities (stubs are filtered out of the pass)", async () => {
    const result = await reembedRealmEntities(db, client);
    expect(result).toMatchObject({
      total: 2,
      embedded: 2,
      unchanged: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("is idempotent — a second pass re-embeds nothing (contentHash gate)", async () => {
    await reembedRealmEntities(db, client);
    const second = await reembedRealmEntities(db, client);
    expect(second).toMatchObject({ total: 2, embedded: 0, unchanged: 2 });
  });

  it("re-embeds only entities whose composed card drifted", async () => {
    await reembedRealmEntities(db, client);
    await pg.exec(
      `UPDATE realm_entities SET summary = 'A truly enormous red wyrm' WHERE id = '${E1}'`,
    );
    const third = await reembedRealmEntities(db, client);
    expect(third).toMatchObject({ embedded: 1, unchanged: 1 });
  });
});
