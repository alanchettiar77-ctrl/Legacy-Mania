import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { loginSchema } from "@/lib/validation/auth";

/**
 * Server-side login. Validates on the server regardless of client checks,
 * returns only generic errors (no field-level detail, no user enumeration),
 * and sets the Supabase session cookies via the SSR client.
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    await recordAuditLog({
      action: "auth.login_failed",
      tableName: "auth",
      newValues: { ip },
    });
    // Generic — never reveal whether the email exists or which part was wrong.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
