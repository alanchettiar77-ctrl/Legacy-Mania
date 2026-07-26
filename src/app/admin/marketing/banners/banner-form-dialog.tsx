"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";
import type { BannerRow } from "@/lib/services/banner-service";

type Category = { id: string; name: string };

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  cta_text: "",
  cta_url: "",
  category_id: "",
  desktop_image_url: "",
  mobile_image_url: "",
  alt_text: "",
  aria_label: "",
  image_title: "",
  overlay_enabled: false,
  overlay_opacity: 0.4,
  is_active: true,
  start_date: "",
  end_date: "",
  seo_meta_title: "",
  seo_meta_description: "",
  seo_keywords: "",
  og_title: "",
  og_description: "",
  og_image_url: "",
  canonical_url: "",
  schema_type: "",
};

type FormState = typeof EMPTY_FORM;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toIsoOrNull(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

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

export default function BannerFormDialog({
  open,
  onClose,
  onSaved,
  banner,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (banner: BannerRow) => void;
  banner: BannerRow | null;
  categories: Category[];
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<"desktop" | "mobile" | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    if (!open) return;
    if (banner) {
      setForm({
        title: banner.title,
        subtitle: banner.subtitle ?? "",
        cta_text: banner.cta_text ?? "",
        cta_url: banner.cta_url ?? "",
        category_id: banner.category_id ?? "",
        desktop_image_url: banner.desktop_image_url,
        mobile_image_url: banner.mobile_image_url ?? "",
        alt_text: banner.alt_text,
        aria_label: banner.aria_label ?? "",
        image_title: banner.image_title ?? "",
        overlay_enabled: banner.overlay_enabled,
        overlay_opacity: banner.overlay_opacity,
        is_active: banner.is_active,
        start_date: toLocalInput(banner.start_date),
        end_date: toLocalInput(banner.end_date),
        seo_meta_title: banner.seo_meta_title ?? "",
        seo_meta_description: banner.seo_meta_description ?? "",
        seo_keywords: banner.seo_keywords ?? "",
        og_title: banner.og_title ?? "",
        og_description: banner.og_description ?? "",
        og_image_url: banner.og_image_url ?? "",
        canonical_url: banner.canonical_url ?? "",
        schema_type: banner.schema_type ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, banner]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const uploadImage = (slot: "desktop" | "mobile") => {
    pendingSlot.current = slot;
    fileInput.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const slot = pendingSlot.current;
    if (!slot) return;
    setUploadingSlot(slot);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("namespace", slot === "desktop" ? "banner-desktop" : "banner-mobile");
      const { publicUrl, dimensionWarning } = await apiRequest("/api/media/upload", { method: "POST", body });
      set(slot === "desktop" ? "desktop_image_url" : "mobile_image_url", publicUrl);
      if (dimensionWarning) toast.warning(dimensionWarning);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.desktop_image_url) return toast.error("Desktop image is required");
    if (!form.alt_text.trim()) return toast.error("Alt text is required");

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || null,
        cta_text: form.cta_text || null,
        cta_url: form.cta_url || null,
        category_id: form.category_id || null,
        desktop_image_url: form.desktop_image_url,
        mobile_image_url: form.mobile_image_url || null,
        alt_text: form.alt_text,
        aria_label: form.aria_label || null,
        image_title: form.image_title || null,
        overlay_enabled: form.overlay_enabled,
        overlay_opacity: form.overlay_opacity,
        is_active: form.is_active,
        start_date: toIsoOrNull(form.start_date),
        end_date: toIsoOrNull(form.end_date),
        seo_meta_title: form.seo_meta_title || null,
        seo_meta_description: form.seo_meta_description || null,
        seo_keywords: form.seo_keywords || null,
        og_title: form.og_title || null,
        og_description: form.og_description || null,
        og_image_url: form.og_image_url || null,
        canonical_url: form.canonical_url || null,
        schema_type: form.schema_type || null,
      };
      const saved = banner
        ? await apiRequest(`/api/admin/banners/${banner.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiRequest("/api/admin/banners", { method: "POST", body: JSON.stringify(payload) });
      toast.success(banner ? "Banner updated" : "Banner created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <input type="file" accept="image/png,image/jpeg,image/webp" ref={fileInput} onChange={onFileChosen} className="hidden" />
      <form
        onSubmit={submit}
        className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{banner ? "Edit Banner" : "New Banner"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 text-sm">
            Title
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="col-span-2 text-sm">
            Subtitle
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </label>
          <label className="text-sm">
            CTA Text
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} />
          </label>
          <label className="text-sm">
            CTA URL
            <input
              className="w-full border border-border rounded-lg p-2 mt-1"
              placeholder="/catalog or https://…"
              value={form.cta_url}
              onChange={(e) => set("cta_url", e.target.value)}
            />
          </label>
          <label className="col-span-2 text-sm">
            Or link to a category (used only if CTA URL is empty)
            <select
              className="w-full border border-border rounded-lg p-2 mt-1"
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm mb-1">Desktop image (1600×600)</p>
              {form.desktop_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.desktop_image_url} alt="Desktop preview" className="rounded-lg mb-2 h-24 object-cover w-full" />
              )}
              <button
                type="button"
                onClick={() => uploadImage("desktop")}
                disabled={uploadingSlot === "desktop"}
                className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2"
              >
                <Upload className="w-4 h-4" /> {uploadingSlot === "desktop" ? "Uploading…" : "Upload"}
              </button>
            </div>
            <div>
              <p className="text-sm mb-1">Mobile image (750×1000, optional)</p>
              {form.mobile_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.mobile_image_url} alt="Mobile preview" className="rounded-lg mb-2 h-24 object-cover w-full" />
              )}
              <button
                type="button"
                onClick={() => uploadImage("mobile")}
                disabled={uploadingSlot === "mobile"}
                className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2"
              >
                <Upload className="w-4 h-4" /> {uploadingSlot === "mobile" ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          <label className="col-span-2 text-sm">
            Alt Text (required)
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.alt_text} onChange={(e) => set("alt_text", e.target.value)} />
          </label>
          <label className="text-sm">
            ARIA Label
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.aria_label} onChange={(e) => set("aria_label", e.target.value)} />
          </label>
          <label className="text-sm">
            Image Title
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.image_title} onChange={(e) => set("image_title", e.target.value)} />
          </label>

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.overlay_enabled} onChange={(e) => set("overlay_enabled", e.target.checked)} />
            Background Overlay
          </label>
          <label className="text-sm">
            Overlay Opacity ({form.overlay_opacity.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.overlay_opacity}
              onChange={(e) => set("overlay_opacity", Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>

          <label className="text-sm">
            Publish Date
            <input type="datetime-local" className="w-full border border-border rounded-lg p-2 mt-1" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </label>
          <label className="text-sm">
            Expiry Date
            <input type="datetime-local" className="w-full border border-border rounded-lg p-2 mt-1" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </label>

          <label className="col-span-2 text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active
          </label>
        </div>

        <div className="border-t border-border pt-3">
          <button type="button" onClick={() => setShowSeo((s) => !s)} className="text-sm font-semibold">
            {showSeo ? "▾" : "▸"} SEO (advanced) — not yet shown on site
          </button>
          {showSeo && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <label className="col-span-2 text-sm">
                SEO Meta Title
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_meta_title} onChange={(e) => set("seo_meta_title", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                SEO Meta Description
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_meta_description} onChange={(e) => set("seo_meta_description", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                SEO Keywords
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_keywords} onChange={(e) => set("seo_keywords", e.target.value)} />
              </label>
              <label className="text-sm">
                Open Graph Title
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_title} onChange={(e) => set("og_title", e.target.value)} />
              </label>
              <label className="text-sm">
                Open Graph Description
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_description} onChange={(e) => set("og_description", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                Open Graph Image URL
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_image_url} onChange={(e) => set("og_image_url", e.target.value)} />
              </label>
              <label className="text-sm">
                Canonical URL
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.canonical_url} onChange={(e) => set("canonical_url", e.target.value)} />
              </label>
              <label className="text-sm">
                Schema Type
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.schema_type} onChange={(e) => set("schema_type", e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
