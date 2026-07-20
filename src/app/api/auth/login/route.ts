import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { loginSchema } from "@/lib/validation/auth";
import { isLocked, getProgressiveDelayMs, recordAttemptResult } from "@/lib/services/login-throttle-service";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Server-side login. Validates on the server regardless of client checks,
 * returns only generic errors (no field-level detail, no user enumeration),
 * and sets the Supabase session cookies via the SSR client.
 *
 * Per-account lockout (5 consecutive failures / 15 min) is layered on top of
 * the existing per-IP rate limit below — the two guard different things and
 * neither replaces the other. See AUTH_AUDIT.md Finding #4.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`auth-login:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = null;
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    // Log for monitoring — field names only, never the submitted values.
    console.warn("auth.login validation failed", {
      ip,
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    await recordAuditLog({
      action: "auth.validation_failed",
      tableName: "auth",
      newValues: { ip, route: "login" },
    });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  if (await isLocked(email)) {
    await sleep(await getProgressiveDelayMs(email));
    await recordAttemptResult(email, ip, false);
    await recordAuditLog({
      action: "auth.login_blocked_locked",
      tableName: "auth",
      newValues: { ip },
    });
    // Same generic message as any other failure — never reveal lockout state.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await sleep(await getProgressiveDelayMs(email));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAttemptResult(email, ip, false);
    await recordAuditLog({
      action: "auth.login_failed",
      tableName: "auth",
      newValues: { ip },
    });

    // If this failure just pushed the account into lockout, send the reset-link
    // email exactly once (not on every subsequent blocked attempt — see the
    // isLocked() branch above, which never reaches this code path).
    if (await isLocked(email)) {
      try {
        await supabase.auth.resetPasswordForEmail(email);
      } catch (resetError) {
        console.error("Failed to send lockout reset email", resetError);
      }
    }

    // Generic — never reveal whether the email exists or which part was wrong.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await recordAttemptResult(email, ip, true);
  return NextResponse.json({ success: true });
}
