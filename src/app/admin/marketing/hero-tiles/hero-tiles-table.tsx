"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import type { HeroTileRow } from "@/lib/services/hero-tile-service";
import HeroTileFormDialog from "./hero-tile-form-dialog";

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function HeroTilesTable({
  initialTiles,
  categories,
}: {
  initialTiles: HeroTileRow[];
  categories: { id: string; name: string; slug: string }[];
}) {
  const [rows, setRows] = useState(initialTiles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroTileRow | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (tile: HeroTileRow) => {
    setEditing(tile);
    setDialogOpen(true);
  };

  const onSaved = (tile: HeroTileRow) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === tile.id);
      return exists ? prev.map((r) => (r.id === tile.id ? tile : r)) : [...prev, tile];
    });
  };

  const toggleActive = async (tile: HeroTileRow) => {
    setPendingId(tile.id);
    try {
      const updated = await apiRequest(`/api/admin/hero-tiles/${tile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !tile.is_active }),
      });
      setRows((prev) => prev.map((r) => (r.id === tile.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tile");
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (tile: HeroTileRow) => {
    if (!confirm(`Delete "${tile.label}"? This can't be undone from the admin panel.`)) return;
    setPendingId(tile.id);
    try {
      await apiRequest(`/api/admin/hero-tiles/${tile.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== tile.id));
      toast.success("Hero tile deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tile");
    } finally {
      setPendingId(null);
    }
  };

  const onDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const previousRows = rows; // snapshot before mutating, not the initialTiles prop
    const reordered = [...rows];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setRows(reordered);
    setDragIndex(null);
    try {
      await apiRequest("/api/admin/hero-tiles/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder tiles");
      setRows(previousRows);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New Tile
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((tile, i) => (
          <div
            key={tile.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
          >
            <span className="text-2xl" aria-hidden="true">
              {tile.icon_emoji}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{tile.label}</p>
              <p className="text-xs text-muted-foreground">
                {tile.link_type} → {tile.link_value}
              </p>
            </div>
            <button
              onClick={() => toggleActive(tile)}
              disabled={pendingId === tile.id}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label={tile.is_active ? "Hide tile" : "Show tile"}
            >
              {tile.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => openEdit(tile)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Edit tile"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => remove(tile)}
              disabled={pendingId === tile.id}
              className="p-2 text-muted-foreground hover:text-destructive"
              aria-label="Delete tile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No hero tiles yet. The homepage falls back to its default tiles until you add one.
          </p>
        )}
      </div>

      <HeroTileFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        categories={categories}
        onSaved={onSaved}
      />
    </div>
  );
}
