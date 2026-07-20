import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// We use explicit type casts in query results rather than Database generic
// to avoid @supabase/supabase-js type inference issues with custom Database types.

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr defaults to httpOnly:false (JS-writable) so the browser client can
      // manage its own session. Every auth-relevant browser call has been migrated to
      // server routes (see AUTH_AUDIT.md Finding #1), so the browser client never touches
      // this cookie anymore — safe to lock it down here.
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component – cookies are read-only here
          }
        },
      },
    }
  );
}

export async function createAdminClient() {
  // Deliberately does NOT wire up the request's cookies. @supabase/ssr's session storage
  // uses whatever session it finds via auth.getSession(), and supabase-js's Authorization
  // header prefers that session's access_token over the key passed to createServerClient
  // (see SupabaseClient#_getAccessToken: `session?.access_token ?? this.supabaseKey`). If
  // this client read the signed-in admin's cookies, Postgrest would receive the admin's own
  // "authenticated" JWT as the bearer token instead of the service-role key, so RLS would
  // still apply to the admin's requests — silently defeating the whole point of this
  // "admin"/service-role client. Passing no cookies means there's never a session to find,
  // so _getAccessToken() always falls back to the service-role key, guaranteeing RLS bypass.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
