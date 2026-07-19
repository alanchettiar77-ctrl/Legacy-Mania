import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { registerSchema } from "@/lib/validation/auth";

/**
 * Server-side signup. Server-validates every field, sanitizes the display name
 * before it reaches auth metadata / profiles, and returns only generic errors.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`auth-register:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = null;
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("auth.register validation failed", {
      ip,
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    await recordAuditLog({
      action: "auth.validation_failed",
      tableName: "auth",
      newValues: { ip, route: "register" },
    });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
      },
    },
  });

  if (error) {
    await recordAuditLog({
      action: "auth.register_failed",
      tableName: "auth",
      newValues: { ip },
    });
    // Generic — avoids leaking whether the email is already registered.
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
