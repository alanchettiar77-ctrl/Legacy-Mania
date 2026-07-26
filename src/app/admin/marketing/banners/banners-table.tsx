"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Copy, Eye, EyeOff, Plus } from "lucide-react";
import type { BannerRow } from "@/lib/services/banner-service";
import BannerFormDialog from "./banner-form-dialog";

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function BannersTable({
  initialBanners,
  categories,
}: {
  initialBanners: BannerRow[];
  categories: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState(initialBanners);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (banner: BannerRow) => {
    setEditing(banner);
    setDialogOpen(true);
  };

  const onSaved = (banner: BannerRow) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === banner.id);
      return exists ? prev.map((r) => (r.id === banner.id ? banner : r)) : [...prev, banner];
    });
  };

  const toggleActive = async (banner: BannerRow) => {
    try {
      const updated = await apiRequest(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !banner.is_active }),
      });
      setRows((prev) => prev.map((r) => (r.id === banner.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update banner");
    }
  };

  const remove = async (banner: BannerRow) => {
    if (!confirm(`Delete "${banner.title}"? This can't be undone from the admin panel.`)) return;
    try {
      await apiRequest(`/api/admin/banners/${banner.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== banner.id));
      toast.success("Banner deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete banner");
    }
  };

  const duplicate = async (banner: BannerRow) => {
    try {
      const copy = await apiRequest(`/api/admin/banners/${banner.id}/duplicate`, { method: "POST" });
      setRows((prev) => [...prev, copy]);
      toast.success("Banner duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate banner");
    }
  };

  const persistOrder = async (next: BannerRow[]) => {
    setRows(next);
    try {
      await apiRequest("/api/admin/banners/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: next.map((r) => r.id) }),
      });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  const onDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Banner
        </button>
      </div>

      <table className="w-full border border-border rounded-xl overflow-hidden">
        <thead className="bg-accent/20 text-left text-sm">
          <tr>
            <th className="p-3 w-8" />
            <th className="p-3">Preview</th>
            <th className="p-3">Title</th>
            <th className="p-3">Status</th>
            <th className="p-3">Schedule</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((banner, index) => (
            <tr
              key={banner.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={`border-b border-border last:border-0 hover:bg-accent/10 ${!banner.is_active ? "opacity-50" : ""}`}
            >
              <td className="p-3 cursor-grab text-muted-foreground">⠿</td>
              <td className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner.desktop_image_url} alt="" className="w-24 h-9 object-cover rounded" />
              </td>
              <td className="p-3 font-medium">{banner.title}</td>
              <td className="p-3 text-sm">{banner.is_active ? "Active" : "Hidden"}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {banner.start_date ? new Date(banner.start_date).toLocaleDateString() : "Always"}
                {banner.end_date ? ` – ${new Date(banner.end_date).toLocaleDateString()}` : ""}
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => toggleActive(banner)} aria-label="Toggle active" title="Toggle active">
                    {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => duplicate(banner)} aria-label="Duplicate" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => openEdit(banner)} aria-label="Edit" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => remove(banner)} aria-label="Delete" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                No banners yet. Click "Add Banner" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <BannerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={onSaved}
        banner={editing}
        categories={categories}
      />
    </div>
  );
}
