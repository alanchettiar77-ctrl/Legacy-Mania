import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/utils";

/**
 * Server-side PKCE code exchange for the password-recovery link. Supabase's
 * resetPasswordForEmail() redirect points here instead of straight to
 * /reset-password, so the recovery session is established via the server
 * client (httpOnly cookies) rather than the browser client (which can never
 * write an httpOnly cookie and would otherwise overwrite the protected
 * session cookie non-httpOnly the moment it touched auth state).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const next = getSafeRedirect(req.nextUrl.searchParams.get("next"), "/reset-password");
  return NextResponse.redirect(new URL(next, req.url));
}
