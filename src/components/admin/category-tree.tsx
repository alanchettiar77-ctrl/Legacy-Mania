"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, Eye, EyeOff, Trash2, GripVertical } from "lucide-react";
import type { CategoryWithChildren } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryTreeProps {
  categories: CategoryWithChildren[];
  onChanged: () => void;
}

export default function CategoryTree({ categories, onChanged }: CategoryTreeProps) {
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  async function toggleActive(cat: CategoryWithChildren) {
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !cat.is_active }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update category");
      return;
    }
    onChanged();
  }

  async function handleDelete(cat: CategoryWithChildren) {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone from here.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete category");
      return;
    }
    onChanged();
  }

  async function reorderSiblings(siblingIds: string[]) {
    setError(null);
    const res = await fetch("/api/admin/categories/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: siblingIds }),
    });
    if (!res.ok) {
      setError("Failed to reorder categories");
      return;
    }
    onChanged();
  }

  function renderLevel(nodes: CategoryWithChildren[], depth: number) {
    return (
      <ul className={cn("space-y-1", depth > 0 && "ml-5 mt-1 border-l border-border pl-3")}>
        {nodes.map((cat, index) => (
          <li
            key={cat.id}
            draggable
            onDragStart={() => setDragId(cat.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId || dragId === cat.id) return;
              const ids = nodes.map((n) => n.id);
              const fromIndex = ids.indexOf(dragId);
              if (fromIndex === -1) return;
              ids.splice(fromIndex, 1);
              ids.splice(index, 0, dragId);
              setDragId(null);
              reorderSiblings(ids);
            }}
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{cat.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    cat.is_active
                      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  )}
                >
                  {cat.is_active ? "Active" : "Hidden"}
                </span>
                <button
                  aria-label={cat.is_active ? "Hide" : "Unhide"}
                  onClick={() => toggleActive(cat)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                >
                  {cat.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <Link
                  href={`/admin/categories/${cat.id}/edit`}
                  aria-label="Edit"
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <button
                  aria-label="Delete"
                  onClick={() => handleDelete(cat)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {cat.children && cat.children.length > 0 && renderLevel(cat.children, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-500 mb-3 px-3 py-2 rounded-lg bg-red-500/10">{error}</p>
      )}
      {renderLevel(categories, 0)}
    </div>
  );
}
