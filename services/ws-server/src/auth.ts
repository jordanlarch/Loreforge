/**
 * Connection auth (#14).
 *
 * The play surface lives behind Supabase auth, so every browser already holds a
 * Supabase session JWT. We verify that token offline in Hocuspocus
 * `onAuthenticate` and derive the room id from its subject so a client can only
 * join its own per-user sandbox room.
 *
 * Verification follows Supabase's JWT signing keys. Projects on the new
 * asymmetric keys (ECC P-256 → `ES256`, or RSA → `RS256`) are verified against
 * the project's public JWKS — no shared secret needed, and key rotation is
 * handled automatically. A legacy HS256 shared secret is supported as an
 * optional fallback for the migration window (tokens still signed by the old
 * symmetric secret), and is the only path for projects that haven't migrated.
 */
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

export type VerifiedUser = { userId: string };

/** Resolvers a token can be checked against; at least one must be present. */
export type Verifier = {
  /** Asymmetric public keys (current Supabase signing keys: ES256 / RS256). */
  jwks?: JWTVerifyGetKey;
  /** Legacy HS256 shared secret (Supabase legacy JWT secret). */
  secret?: Uint8Array;
};

const ASYMMETRIC_ALGS = ["ES256", "RS256"] as const;

/** Build the JWKS endpoint URL for a Supabase project base URL. */
export function jwksUrlFor(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;
}

/** Assemble a verifier from configuration (env-derived in production). */
export function buildVerifier(config: {
  jwksUrl?: string;
  legacySecret?: string;
}): Verifier {
  return {
    jwks: config.jwksUrl
      ? createRemoteJWKSet(new URL(config.jwksUrl))
      : undefined,
    secret: config.legacySecret
      ? new TextEncoder().encode(config.legacySecret)
      : undefined,
  };
}

function userFrom(payload: JWTPayload): VerifiedUser {
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) throw new Error("token missing subject");
  return { userId };
}

/**
 * Verify a Supabase access token and extract its subject (user id). Tries the
 * asymmetric JWKS first (current signing keys), then the legacy HS256 secret.
 * Throws if no configured method validates the token.
 */
export async function verifySupabaseToken(
  token: string,
  verifier: Verifier,
): Promise<VerifiedUser> {
  if (!token) throw new Error("missing token");
  if (!verifier.jwks && !verifier.secret) {
    throw new Error("no verification method configured");
  }

  let lastError: unknown;

  if (verifier.jwks) {
    try {
      const { payload } = await jwtVerify(token, verifier.jwks, {
        algorithms: [...ASYMMETRIC_ALGS],
      });
      return userFrom(payload);
    } catch (error) {
      lastError = error;
    }
  }

  if (verifier.secret) {
    try {
      const { payload } = await jwtVerify(token, verifier.secret, {
        algorithms: ["HS256"],
      });
      return userFrom(payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("token verification failed");
}

/** The per-user sandbox room id. A client may only join the room for its own id. */
export function roomForUser(userId: string): string {
  return `sandbox:${userId}`;
}
