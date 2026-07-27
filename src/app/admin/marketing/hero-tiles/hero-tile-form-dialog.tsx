"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { HeroTileRow } from "@/lib/services/hero-tile-service";
import { COLOR_THEMES, LINK_TYPES } from "@/lib/validation/hero-tile";

type Category = { id: string; name: string; slug: string };

const EMPTY_FORM = {
  label: "",
  icon_emoji: "",
  color_theme: "sunrise" as (typeof COLOR_THEMES)[number],
  link_type: "category" as (typeof LINK_TYPES)[number],
  link_value: "",
  is_active: true,
};

type FormState = typeof EMPTY_FORM;

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function HeroTileFormDialog({
  open,
  onClose,
  editing,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: HeroTileRow | null;
  categories: Category[];
  onSaved: (tile: HeroTileRow) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        label: editing.label,
        icon_emoji: editing.icon_emoji,
        color_theme: editing.color_theme,
        link_type: editing.link_type,
        link_value: editing.link_value,
        is_active: editing.is_active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editing, open]);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const saved = editing
        ? await apiRequest(`/api/admin/hero-tiles/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(form),
          })
        : await apiRequest("/api/admin/hero-tiles", {
            method: "POST",
            body: JSON.stringify(form),
          });
      onSaved(saved);
      toast.success(editing ? "Tile updated" : "Tile created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{editing ? "Edit Tile" : "New Tile"}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., Pikachu"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Icon (emoji)</label>
            <input
              value={form.icon_emoji}
              onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="⚡"
              maxLength={8}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Color Theme</label>
            <select
              value={form.color_theme}
              onChange={(e) => setForm({ ...form, color_theme: e.target.value as FormState["color_theme"] })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {COLOR_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Link Type</label>
            <select
              value={form.link_type}
              onChange={(e) =>
                setForm({ ...form, link_type: e.target.value as FormState["link_type"], link_value: "" })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {LINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {form.link_type === "category" ? (
            <div>
              <label className="text-sm font-medium text-foreground">Category</label>
              <select
                value={form.link_value}
                onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-foreground">
                {form.link_type === "custom_url" ? "URL or path" : "Link value"}
              </label>
              <input
                value={form.link_value}
                onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={form.link_type === "custom_url" ? "/about" : "slug or path"}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible on the homepage)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.label || !form.icon_emoji || !form.link_value}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
