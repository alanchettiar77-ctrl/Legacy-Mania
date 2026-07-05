import { NextResponse } from "next/server";
import { getFlatCategories } from "@/lib/services/catalog-service";

export async function GET() {
  try {
    const categories = await getFlatCategories();
    return NextResponse.json(categories);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
