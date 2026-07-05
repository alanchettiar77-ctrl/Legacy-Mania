// src/app/api/media/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateFile, uploadMedia, MEDIA_NAMESPACES, type MediaNamespace } from "@/lib/services/media-service";

function isValidNamespace(value: string): value is MediaNamespace {
  return value in MEDIA_NAMESPACES;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rateLimit = checkRateLimit(`media-upload:${auth.userId}`, 30, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const formData = await req.formData();
  const file = formData.get("file");
  const namespaceRaw = formData.get("namespace");

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (typeof namespaceRaw !== "string" || !isValidNamespace(namespaceRaw)) {
    return NextResponse.json({ error: "A valid namespace is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type;

  const validation = await validateFile(buffer, mimeType, namespaceRaw);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await uploadMedia(buffer, mimeType, namespaceRaw);
  return NextResponse.json(
    { ...result, dimensionWarning: validation.dimensionWarning ?? null },
    { status: 201 }
  );
}
