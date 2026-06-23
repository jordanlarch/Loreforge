import OpenAI from "openai";

import { EMBEDDING_DIMENSIONS } from "@app/db";

/**
 * Default embedding model snapshot (`docs/data-sources.md` §6). The operational
 * registry lives here in code, not in the doc. Override per-client.
 */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small" as const;

/** Model id reported by the deterministic fake (so audit logs are honest). */
export const FAKE_EMBEDDING_MODEL = "fake-embedding-1536" as const;

export type EmbedResult = {
  /** One vector per input text, in input order. */
  vectors: number[][];
  /** Resolved model id the provider actually ran. */
  model: string;
  usage: { totalTokens: number };
};

/**
 * Provider-agnostic embedding seam, mirroring `@app/llm`'s `LlmClient`. Callers
 * depend only on this interface, so tests (and offline dev) inject the
 * deterministic fake and a future provider swap is transparent.
 */
export interface EmbeddingClient {
  readonly model: string;
  embed(texts: string[]): Promise<EmbedResult>;
}

/** Raised for transport / protocol failures from a real provider. */
export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export type OpenAIEmbeddingClientOptions = {
  apiKey: string;
  model?: string;
};

/** The OpenAI-backed {@link EmbeddingClient}. Server-only (holds the API key). */
export function createOpenAIEmbeddingClient(
  options: OpenAIEmbeddingClientOptions,
): EmbeddingClient {
  const openai = new OpenAI({ apiKey: options.apiKey });
  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;

  return {
    model,
    async embed(texts: string[]): Promise<EmbedResult> {
      if (texts.length === 0) {
        return { vectors: [], model, usage: { totalTokens: 0 } };
      }
      try {
        const res = await openai.embeddings.create({
          model,
          input: texts,
          dimensions: EMBEDDING_DIMENSIONS,
        });
        const vectors = [...res.data]
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding as number[]);
        return {
          vectors,
          model,
          usage: { totalTokens: res.usage?.total_tokens ?? 0 },
        };
      } catch (err) {
        throw new EmbeddingError(
          `OpenAI embedding request failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    },
  };
}

/** A deterministic {@link EmbeddingClient} that records the calls it received. */
export type DeterministicEmbeddingClient = EmbeddingClient & {
  /** Each `embed` invocation's input texts, in order (for assertions). */
  readonly calls: string[][];
};

/** 32-bit FNV-1a — a fast, pure, deterministic string hash. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A deterministic, dependency-free embedding of `text` via feature hashing: each
 * token bumps a signed bucket, then the vector is L2-normalized. Identical text
 * always yields an identical vector, and texts that share tokens have higher
 * cosine similarity than texts that don't — enough to exercise (and assert) the
 * full embed → store → cosine-retrieve loop offline without a real provider.
 */
export function deterministicVector(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    const idx = fnv1a(tok) % EMBEDDING_DIMENSIONS;
    const sign = fnv1a(`${tok}#sign`) % 2 === 0 ? 1 : -1;
    v[idx] = (v[idx] ?? 0) + sign;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) {
    // Empty / token-less text → a fixed unit vector (avoids a zero vector, for
    // which cosine similarity is undefined).
    v[0] = 1;
    return v;
  }
  for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / norm;
  return v;
}

/**
 * The deterministic {@link EmbeddingClient} used in tests and as the offline
 * fallback when no `OPENAI_API_KEY` is present (mirrors `createFakeLlmClient`).
 */
export function createDeterministicEmbeddingClient(): DeterministicEmbeddingClient {
  const calls: string[][] = [];
  return {
    model: FAKE_EMBEDDING_MODEL,
    calls,
    async embed(texts: string[]): Promise<EmbedResult> {
      calls.push([...texts]);
      return {
        vectors: texts.map(deterministicVector),
        model: FAKE_EMBEDDING_MODEL,
        usage: { totalTokens: texts.reduce((n, t) => n + t.length, 0) },
      };
    },
  };
}

export type ResolveEmbeddingClientOptions = {
  apiKey?: string;
  model?: string;
};

/**
 * Returns the real OpenAI client when an API key is available (explicit option
 * or `OPENAI_API_KEY` / `OPENAI_EMBEDDING_MODEL` in the environment), otherwise
 * the deterministic fake — so the memory pipeline runs end-to-end offline.
 */
export function resolveEmbeddingClient(
  options: ResolveEmbeddingClientOptions = {},
): EmbeddingClient {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_EMBEDDING_MODEL;
  if (apiKey) {
    return createOpenAIEmbeddingClient({ apiKey, model });
  }
  return createDeterministicEmbeddingClient();
}
