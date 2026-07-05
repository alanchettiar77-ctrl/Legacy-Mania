import { NextResponse } from "next/server";
import { getCategoryTree } from "@/lib/services/catalog-service";

export async function GET() {
  try {
    const tree = await getCategoryTree();
    return NextResponse.json(tree);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch category tree";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
