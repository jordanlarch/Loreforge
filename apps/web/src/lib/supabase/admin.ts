import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for server-side storage uploads (portraits). */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const PORTRAIT_BUCKET = "character-portraits";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedPortraitType(contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType);
}
