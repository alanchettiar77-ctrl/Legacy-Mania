import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { faqCreateSchema } from "@/lib/validation/faq";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json();
  const parsed = faqCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let displayOrder = parsed.data.display_order;
  if (displayOrder === undefined) {
    const maxRes = await fetch(
      `${SUPABASE_URL}/rest/v1/faqs?select=display_order&order=display_order.desc&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    );
    const maxRows = maxRes.ok ? await maxRes.json() : [];
    displayOrder = (maxRows?.[0]?.display_order ?? -1) + 1;
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/faqs`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      question: parsed.data.question,
      answer: parsed.data.answer,
      display_order: displayOrder,
    }),
  });

  if (!insertRes.ok) {
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }

  const created = await insertRes.json();
  return NextResponse.json(created[0], { status: 201 });
}
