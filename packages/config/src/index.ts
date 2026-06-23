import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  DIRECT_URL: z.string().startsWith("postgresql://").optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_REF: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  // AI generators (Realms generator pipeline). Optional/env-gated: the app runs
  // without it, but generation endpoints return a clean "not configured" error.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  // Embeddings / memory tier (@app/memory, P5). Optional/env-gated: without a
  // key the memory tier falls back to a deterministic local embedding so dev and
  // tests run offline (`docs/data-sources.md` §6).
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverSchema.parse(env);
}

export function parseClientEnv(
  env: Record<string, string | undefined> = process.env,
): ClientEnv {
  return clientSchema.parse(env);
}

/** Validates env at boot; throws with a clear message if misconfigured. */
export function requireServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(
      `[@app/config] Missing or invalid server env: ${missing}. Copy .env.example → .env.local`,
    );
  }
  return result.data;
}
