import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Uses the SERVICE ROLE key — this bypasses Row Level Security entirely.
// Only ever use this for specific, trusted, server-only operations where
// RLS would otherwise incorrectly block a legitimate action (e.g.
// completing a farmer's own record immediately after signUp(), before
// their session exists because email confirmation is still pending).
// NEVER import this into anything that runs in the browser.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
