"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, HelpCircle } from "lucide-react";
import { faqCreateSchema, type FaqCreateInput } from "@/lib/validation/faq";

interface Faq {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function FaqsTable({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);

  const form = useForm<FaqCreateInput>({
    resolver: zodResolver(faqCreateSchema),
    defaultValues: { question: "", answer: "" },
  });

  const openAdd = () => {
    form.reset({ question: "", answer: "" });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (faq: Faq) => {
    form.reset({ question: faq.question, answer: faq.answer });
    setEditing(faq);
    setShowForm(true);
  };

  const onSubmit = async (data: FaqCreateInput) => {
    try {
      if (editing) {
        const updated = await apiRequest(`/api/admin/faqs/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setFaqs((prev) => prev.map((f) => (f.id === editing.id ? updated : f)));
        toast.success("FAQ updated");
      } else {
        const created = await apiRequest("/api/admin/faqs", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setFaqs((prev) => [...prev, created].sort((a, b) => a.display_order - b.display_order));
        toast.success("FAQ created");
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save FAQ");
    }
  };

  const toggleActive = async (faq: Faq) => {
    try {
      const updated = await apiRequest(`/api/admin/faqs/${faq.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !faq.is_active }),
      });
      setFaqs((prev) => prev.map((f) => (f.id === faq.id ? updated : f)));
      toast.success(updated.is_active ? "FAQ activated" : "FAQ hidden");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const deleteFaq = async (faq: Faq) => {
    if (!confirm(`Delete "${faq.question}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/admin/faqs/${faq.id}`, { method: "DELETE" });
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
      toast.success("FAQ deleted");
    } catch {
      toast.error("Failed to delete FAQ");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;

    const current = faqs[index];
    const other = faqs[target];

    try {
      const [updatedCurrent, updatedOther] = await Promise.all([
        apiRequest(`/api/admin/faqs/${current.id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_order: other.display_order }),
        }),
        apiRequest(`/api/admin/faqs/${other.id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_order: current.display_order }),
        }),
      ]);

      setFaqs((prev) => {
        const next = [...prev];
        next[index] = updatedOther;
        next[target] = updatedCurrent;
        return next.sort((a, b) => a.display_order - b.display_order);
      });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" />
          Add FAQ
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing ? "Edit FAQ" : "Add FAQ"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Question *</label>
                <input
                  {...form.register("question")}
                  placeholder="e.g., Do you ship internationally?"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
                {form.formState.errors.question && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.question.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Answer *</label>
                <textarea
                  {...form.register("answer")}
                  rows={4}
                  placeholder="Give a clear, complete answer"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
                />
                {form.formState.errors.answer && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.answer.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full btn-primary py-3 text-sm disabled:opacity-70"
              >
                {form.formState.isSubmitting ? "Saving..." : editing ? "Update FAQ" : "Add FAQ"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq, index) => (
                <tr
                  key={faq.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${!faq.is_active ? "opacity-50" : ""}`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === faqs.length - 1}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-foreground max-w-md truncate">{faq.question}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        faq.is_active
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >
                      {faq.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(faq)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(faq)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title={faq.is_active ? "Hide" : "Activate"}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteFaq(faq)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {faqs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No FAQs yet.</p>
              <button onClick={openAdd} className="text-primary hover:underline text-sm mt-1">
                Add your first FAQ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
