import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
const secretKey = process.env["SUPABASE_SECRET_KEY"];

if (!url) throw new Error("SUPABASE_URL is required but was not provided.");
if (!publishableKey) throw new Error("SUPABASE_PUBLISHABLE_KEY is required but was not provided.");
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required but was not provided.");

/**
 * Scoped to the requesting user's own JWT, so every query is subject to
 * Postgres RLS as that user — the server never decides row ownership itself.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(url!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Bypasses RLS with the secret key. Reserved for operations that are not
 * scoped to a single user's rows (e.g. verifying tokens). Never use this to
 * read or write a table on a user's behalf.
 */
export const supabaseAdmin: SupabaseClient = createClient(url!, secretKey!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
