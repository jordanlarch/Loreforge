import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import {
  jwksUrlFor,
  parseRoom,
  roomForCampaign,
  roomForUser,
  verifySupabaseToken,
  type Verifier,
} from "./auth.js";

const SECRET = "test-legacy-jwt-secret-please-ignore";
const secretBytes = new TextEncoder().encode(SECRET);

// An ES256 key pair standing in for Supabase's current (ECC P-256) signing key.
let signEs256: (claims: Record<string, unknown>) => Promise<string>;
let jwksVerifier: Verifier;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: "ES256" };
  jwksVerifier = { jwks: createLocalJWKSet({ keys: [publicJwk] }) };
  signEs256 = (claims) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
});

function signHs256(
  claims: Record<string, unknown>,
  secret = SECRET,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

describe("verifySupabaseToken — asymmetric (JWKS / ES256)", () => {
  it("verifies a token signed by the current signing key", async () => {
    const token = await signEs256({ sub: "user-123", aud: "authenticated" });
    await expect(verifySupabaseToken(token, jwksVerifier)).resolves.toEqual({
      userId: "user-123",
    });
  });

  it("rejects an HS256 token when only JWKS is configured", async () => {
    const token = await signHs256({ sub: "user-123" });
    await expect(verifySupabaseToken(token, jwksVerifier)).rejects.toThrow();
  });

  it("rejects a token without a subject", async () => {
    const token = await signEs256({ aud: "authenticated" });
    await expect(verifySupabaseToken(token, jwksVerifier)).rejects.toThrow();
  });
});

describe("verifySupabaseToken — legacy HS256 fallback", () => {
  const secretVerifier: Verifier = { secret: secretBytes };

  it("verifies a legacy HS256 token via the shared secret", async () => {
    const token = await signHs256({ sub: "user-legacy" });
    await expect(verifySupabaseToken(token, secretVerifier)).resolves.toEqual({
      userId: "user-legacy",
    });
  });

  it("rejects an HS256 token signed with the wrong secret", async () => {
    const token = await signHs256({ sub: "user-legacy" }, "wrong-secret");
    await expect(verifySupabaseToken(token, secretVerifier)).rejects.toThrow();
  });
});

describe("verifySupabaseToken — both methods (migration window)", () => {
  let both: Verifier;
  beforeAll(() => {
    both = { jwks: jwksVerifier.jwks, secret: secretBytes };
  });

  it("accepts a current ES256 token", async () => {
    const token = await signEs256({ sub: "u-new" });
    await expect(verifySupabaseToken(token, both)).resolves.toEqual({
      userId: "u-new",
    });
  });

  it("accepts a legacy HS256 token", async () => {
    const token = await signHs256({ sub: "u-old" });
    await expect(verifySupabaseToken(token, both)).resolves.toEqual({
      userId: "u-old",
    });
  });
});

describe("verifySupabaseToken — misconfiguration", () => {
  it("rejects an empty token", async () => {
    await expect(verifySupabaseToken("", jwksVerifier)).rejects.toThrow();
  });

  it("throws when no verification method is configured", async () => {
    const token = await signEs256({ sub: "user-123" });
    await expect(verifySupabaseToken(token, {})).rejects.toThrow();
  });
});

describe("jwksUrlFor", () => {
  it("builds the project JWKS endpoint and trims trailing slashes", () => {
    expect(jwksUrlFor("https://abc.supabase.co")).toBe(
      "https://abc.supabase.co/auth/v1/.well-known/jwks.json",
    );
    expect(jwksUrlFor("https://abc.supabase.co/")).toBe(
      "https://abc.supabase.co/auth/v1/.well-known/jwks.json",
    );
  });
});

describe("roomForUser", () => {
  it("namespaces the sandbox room per user", () => {
    expect(roomForUser("user-123")).toBe("sandbox:user-123");
  });
});

describe("roomForCampaign", () => {
  it("namespaces a persisted campaign room", () => {
    expect(roomForCampaign("camp-abc")).toBe("campaign:camp-abc");
  });
});

describe("parseRoom", () => {
  it("parses a sandbox room", () => {
    expect(parseRoom("sandbox:user-123")).toEqual({
      kind: "sandbox",
      userId: "user-123",
    });
  });

  it("parses a campaign room", () => {
    expect(parseRoom("campaign:camp-abc")).toEqual({
      kind: "campaign",
      campaignId: "camp-abc",
    });
  });

  it("round-trips the room builders", () => {
    expect(parseRoom(roomForUser("u1"))).toEqual({ kind: "sandbox", userId: "u1" });
    expect(parseRoom(roomForCampaign("c1"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
    });
  });

  it("rejects unknown or malformed room names", () => {
    expect(parseRoom("")).toBeNull();
    expect(parseRoom("nocolon")).toBeNull();
    expect(parseRoom("other:thing")).toBeNull();
    expect(parseRoom(":missing-prefix")).toBeNull();
    expect(parseRoom("sandbox:")).toBeNull();
  });
});
