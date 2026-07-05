// src/app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { deleteMedia, MEDIA_NAMESPACES, type MediaNamespace } from "@/lib/services/media-service";

type RouteParams = { params: Promise<{ path: string[] }> };

function isValidNamespace(value: string): value is MediaNamespace {
  return value in MEDIA_NAMESPACES;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { path } = await params;
  const [namespace, ...rest] = path;

  if (!namespace || !isValidNamespace(namespace)) {
    return NextResponse.json({ error: "Invalid media namespace" }, { status: 400 });
  }
  if (rest.length === 0) {
    return NextResponse.json({ error: "A file path is required" }, { status: 400 });
  }

  await deleteMedia(path.join("/"), namespace);
  return NextResponse.json({ success: true });
}
