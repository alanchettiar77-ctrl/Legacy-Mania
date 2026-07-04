import { createAdminClient } from "@/lib/supabase/server";
import FaqsTable from "./faqs-table";

export default async function AdminFaqsPage() {
  // Uses the service-role client, not the session-scoped one: the faqs table's only RLS
  // policy is "Anyone can view active faqs" (is_active = TRUE), with no admin-bypass read
  // policy. Reading via the regular client would silently hide inactive FAQs from this
  // table on every reload, making them impossible to re-activate/edit/delete through the UI.
  const supabase = await createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: faqsRaw } = await db
    .from("faqs")
    .select("*")
    .order("display_order", { ascending: true });

  const faqs = (faqsRaw ?? []) as Array<{
    id: string;
    question: string;
    answer: string;
    display_order: number;
    is_active: boolean;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FAQs</h1>
        <p className="text-muted-foreground text-sm">{faqs.length} FAQs total</p>
      </div>
      <FaqsTable initialFaqs={faqs} />
    </div>
  );
}
