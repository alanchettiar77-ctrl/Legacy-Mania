import { createBrowserClient } from "@supabase/ssr";

// We use explicit type casts in query results rather than Database generic
// to avoid @supabase/supabase-js type inference issues with custom Database types.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
