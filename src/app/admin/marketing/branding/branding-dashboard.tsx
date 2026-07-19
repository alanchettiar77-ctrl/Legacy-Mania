"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload, Trash2, Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, Star, Home, Pencil, X,
} from "lucide-react";
import type { Branding } from "@/lib/services/branding-service";
import type { Category } from "@/types";
import BrandLogo from "@/components/brand-logo";

const SLOT_LABELS: Array<{ key: keyof Branding; label: string; hint: string }> = [
  { key: "logo_url", label: "Site Logo", hint: "Header, footer, admin — everywhere" },
  { key: "hero_logo_url", label: "Hero Logo", hint: "Homepage hero section" },
  { key: "badge_logo_url", label: "Badge Logo", hint: "Small badge / compact spots" },
  { key: "favicon_url", label: "Favicon", hint: "Browser tab icon" },
  { key: "apple_touch_icon_url", label: "Apple Touch Icon", hint: "iOS home screen" },
  { key: "og_image_url", label: "Open Graph Image", hint: "Link previews (1200×630)" },
  { key: "twitter_card_url", label: "Twitter Card", hint: "Twitter/X link previews" },
  { key: "pwa_icon_url", label: "PWA Icon", hint: "App icon (512×512)" },
];

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? options?.headers
        : { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function BrandingDashboard({
  initialBranding,
  initialCategories,
}: {
  initialBranding: Branding;
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [branding, setBranding] = useState(initialBranding);
  const [categories, setCategories] = useState(initialCategories);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<keyof Branding | null>(null);
  const pendingCategory = useRef<string | null>(null);

  // ---- Brand asset slots ----

  const patchBranding = async (patch: Partial<Branding>) => {
    const updated = await apiRequest("/api/admin/branding", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setBranding(updated);
  };

  const uploadTo = (slot: keyof Branding) => {
    pendingSlot.current = slot;
    pendingCategory.current = null;
    fileInput.current?.click();
  };

  const uploadCategoryIcon = (categoryId: string) => {
    pendingCategory.current = categoryId;
    pendingSlot.current = null;
    fileInput.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const slot = pendingSlot.current;
    const categoryId = pendingCategory.current;
    const label = slot ?? "category icon";
    setUploadingSlot(slot ?? categoryId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("namespace", "branding");
      const { publicUrl } = await apiRequest("/api/media/upload", { method: "POST", body: form });

      if (slot) {
        await patchBranding({ [slot]: publicUrl } as Partial<Branding>);
      } else if (categoryId) {
        const updated = await apiRequest(`/api/admin/categories/${categoryId}/branding`, {
          method: "PATCH",
          body: JSON.stringify({ icon_url: publicUrl }),
        });
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      }
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to upload ${label}`);
    } finally {
      setUploadingSlot(null);
    }
  };

  const clearSlot = async (slot: keyof Branding) => {
    if (!confirm("Remove this asset? The built-in default will be used instead.")) return;
    try {
      await patchBranding({ [slot]: "" } as Partial<Branding>);
      toast.success("Removed — using default");
    } catch {
      toast.error("Failed to remove");
    }
  };

  // ---- Categories ----

  const patchCategory = async (id: string, patch: Record<string, unknown>) => {
    try {
      const updated = await apiRequest(`/api/admin/categories/${id}/branding`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
      return false;
    }
  };

  const persistOrder = async (ordered: Category[]) => {
    setCategories(ordered);
    try {
      await apiRequest("/api/admin/categories/order", {
        method: "PATCH",
        body: JSON.stringify({ ids: ordered.map((c) => c.id) }),
      });
    } catch {
      toast.error("Failed to reorder");
      router.refresh();
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  };

  const onDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...categories];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  const saveAppearance = async (id: string, appearance: Record<string, unknown>) => {
    const cleaned = Object.fromEntries(
      Object.entries(appearance).filter(([, v]) => v !== "" && v !== undefined)
    );
    if (await patchCategory(id, { appearance: cleaned })) {
      toast.success("Appearance saved");
      setEditing(null);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm";

  return (
    <div className="space-y-8">
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChosen}
        aria-label="Upload brand asset"
      />

      {/* Live logo preview */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs text-muted-foreground mb-3">Live logo preview (header/footer)</p>
        <div className="flex items-center gap-6">
          <BrandLogo logoUrl={branding.logo_url || undefined} hidden={branding.logo_hidden} />
          {branding.logo_hidden && (
            <span className="text-xs text-muted-foreground">Logo hidden — nothing renders</span>
          )}
          <button
            onClick={() =>
              patchBranding({ logo_hidden: !branding.logo_hidden })
                .then(() => toast.success(branding.logo_hidden ? "Logo restored" : "Logo hidden"))
                .catch(() => toast.error("Failed"))
            }
            className="ml-auto flex items-center gap-2 text-sm py-2 px-4 rounded-xl border border-border hover:bg-accent"
          >
            {branding.logo_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {branding.logo_hidden ? "Restore logo" : "Hide logo"}
          </button>
        </div>
      </div>

      {/* Brand asset slots */}
      <section>
        <h2 className="font-bold text-lg mb-3">Brand Assets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SLOT_LABELS.map(({ key, label, hint }) => {
            const value = branding[key];
            const url = typeof value === "string" ? value : "";
            return (
              <div key={key} className="bg-card border border-border rounded-2xl p-4 flex flex-col">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mb-3">{hint}</p>
                <div className="h-20 rounded-xl bg-background border border-dashed border-border flex items-center justify-center mb-3 overflow-hidden">
                  {url ? (
                    <Image src={url} alt={`${label} preview`} width={160} height={64} className="max-h-16 w-auto object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Default</span>
                  )}
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => uploadTo(key)}
                    disabled={uploadingSlot === key}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingSlot === key ? "Uploading..." : url ? "Replace" : "Upload"}
                  </button>
                  {url && (
                    <button
                      onClick={() => clearSlot(key)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                      title="Remove (use default)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          PNG, JPG or WEBP, max 2 MB. SVG is not accepted for security reasons.
        </p>
      </section>

      {/* Category branding */}
      <section>
        <h2 className="font-bold text-lg mb-3">Categories — Icons, Order & Visibility</h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {categories.map((cat, index) => {
            const a = (cat.appearance ?? {}) as Record<string, string | boolean>;
            return (
              <div
                key={cat.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                className={`flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-accent/20 ${!cat.is_active ? "opacity-50" : ""}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(index, -1)} disabled={index === 0}
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === categories.length - 1}
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {cat.icon_url || cat.image_url ? (
                    <Image src={cat.icon_url || cat.image_url!} alt={`${cat.name} icon`} width={48} height={48} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-xl">🃏</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    /{cat.slug}
                    {typeof a.badge === "string" && a.badge ? ` · badge: ${a.badge}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => uploadCategoryIcon(cat.id)}
                    disabled={uploadingSlot === cat.id}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title="Upload icon"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  {cat.icon_url && (
                    <button
                      onClick={() =>
                        confirm("Remove this icon? The category image / emoji fallback will be used.") &&
                        patchCategory(cat.id, { icon_url: null }).then((ok) => ok && toast.success("Icon removed"))
                      }
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                      title="Remove icon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(cat)}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Edit appearance"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => patchCategory(cat.id, { is_featured: !cat.is_featured })}
                    className={`p-1.5 rounded-lg hover:bg-accent ${cat.is_featured ? "text-yellow-500" : "text-muted-foreground"}`}
                    title={cat.is_featured ? "Unfeature" : "Feature"}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => patchCategory(cat.id, { show_on_homepage: !cat.show_on_homepage })}
                    className={`p-1.5 rounded-lg hover:bg-accent ${cat.show_on_homepage ? "text-primary" : "text-muted-foreground"}`}
                    title={cat.show_on_homepage ? "Remove from homepage" : "Show on homepage"}
                  >
                    <Home className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => patchCategory(cat.id, { is_active: !cat.is_active })}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                    title={cat.is_active ? "Hide everywhere (products kept)" : "Make visible"}
                  >
                    {cat.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">No categories yet.</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Hiding a category removes it from homepage, navigation, catalog and search — products are never deleted.
        </p>
      </section>

      {/* Appearance dialog */}
      {editing && (
        <AppearanceDialog
          category={editing}
          onClose={() => setEditing(null)}
          onSave={saveAppearance}
          inputCls={inputCls}
        />
      )}
    </div>
  );
}

function AppearanceDialog({
  category,
  onClose,
  onSave,
  inputCls,
}: {
  category: Category;
  onClose: () => void;
  onSave: (id: string, appearance: Record<string, unknown>) => void;
  inputCls: string;
}) {
  const a = (category.appearance ?? {}) as Record<string, string | boolean>;
  const [form, setForm] = useState({
    backgroundColor: String(a.backgroundColor ?? ""),
    gradient: String(a.gradient ?? ""),
    borderColor: String(a.borderColor ?? ""),
    textColor: String(a.textColor ?? ""),
    borderRadius: String(a.borderRadius ?? "2xl"),
    shadow: String(a.shadow ?? "none"),
    badge: String(a.badge ?? ""),
    animationEnabled: a.animationEnabled !== false,
  });

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Appearance — {category.name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Background colour</label>
            <input value={form.backgroundColor} onChange={(e) => set("backgroundColor")(e.target.value)}
              placeholder="#1a1a2e" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Gradient (CSS)</label>
            <input value={form.gradient} onChange={(e) => set("gradient")(e.target.value)}
              placeholder="linear-gradient(...)" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Border colour</label>
            <input value={form.borderColor} onChange={(e) => set("borderColor")(e.target.value)}
              placeholder="#7c3aed" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Text colour</label>
            <input value={form.textColor} onChange={(e) => set("textColor")(e.target.value)}
              placeholder="#ffffff" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Border radius</label>
            <select value={form.borderRadius} onChange={(e) => set("borderRadius")(e.target.value)} className={inputCls}>
              {["none", "sm", "md", "lg", "xl", "2xl", "full"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Shadow</label>
            <select value={form.shadow} onChange={(e) => set("shadow")(e.target.value)} className={inputCls}>
              {["none", "sm", "md", "lg"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Badge text</label>
            <input value={form.badge} onChange={(e) => set("badge")(e.target.value)}
              placeholder="HOT" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" checked={form.animationEnabled}
              onChange={(e) => set("animationEnabled")(e.target.checked)} />
            Hover animation
          </label>
        </div>
        <button
          onClick={() => onSave(category.id, form)}
          className="w-full btn-primary py-2.5 text-sm mt-5"
        >
          Save Appearance
        </button>
      </div>
    </div>
  );
}
