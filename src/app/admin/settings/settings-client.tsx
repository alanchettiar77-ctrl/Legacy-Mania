"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import Image from "next/image";

interface SettingsClientProps {
  initialSettings: Record<string, unknown>;
}

type TabType = "upi" | "whatsapp" | "seo" | "analytics" | "store";

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("upi");
  const [settings, setSettings] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialSettings).map(([k, v]) => [k, String(v ?? "")]))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      for (const key of keys) {
        await supabase
          .from("settings")
          .upsert({ key, value: settings[key] || "" }, { onConflict: "key" });
      }
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const ext = file.name.split(".").pop();
      const path = `upi/qr-code.${ext}`;
      await supabase.storage.from("settings").upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("settings").getPublicUrl(path);
      update("upi_qr_url", publicUrl);
      await supabase.from("settings").upsert({ key: "upi_qr_url", value: publicUrl }, { onConflict: "key" });
      toast.success("UPI QR uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingQr(false);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "upi", label: "UPI Payment" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "seo", label: "SEO" },
    { id: "analytics", label: "Analytics" },
    { id: "store", label: "Store Info" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "upi" && (
          <div className="space-y-5 max-w-lg">
            <h2 className="font-bold">UPI Payment Settings</h2>
            <Field label="UPI ID" value={settings.upi_id || ""} onChange={(v) => update("upi_id", v)} placeholder="yourname@upi" />
            <Field label="UPI Display Name" value={settings.upi_name || ""} onChange={(v) => update("upi_name", v)} placeholder="Legacy Mania" />

            <div>
              <label className="block text-sm font-medium mb-2">UPI QR Code</label>
              {settings.upi_qr_url && (
                <Image src={settings.upi_qr_url} alt="UPI QR" width={160} height={160} className="mb-3 rounded-xl border border-border" />
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {uploadingQr ? "Uploading..." : "Upload QR Code"}
                <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploadingQr} />
              </label>
            </div>

            <button onClick={() => save(["upi_id", "upi_name", "upi_qr_url"])} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Save UPI Settings"}
            </button>
          </div>
        )}

        {activeTab === "whatsapp" && (
          <div className="space-y-5 max-w-lg">
            <h2 className="font-bold">WhatsApp Settings</h2>
            <Field label="WhatsApp Number (with country code)" value={settings.whatsapp_number || ""} onChange={(v) => update("whatsapp_number", v)} placeholder="919876543210" />
            <div>
              <label className="block text-sm font-medium mb-1.5">Default Message</label>
              <textarea
                value={settings.whatsapp_message || ""}
                onChange={(e) => update("whatsapp_message", e.target.value)}
                rows={3}
                placeholder="Hi! I have a question..."
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
              />
            </div>
            <button onClick={() => save(["whatsapp_number", "whatsapp_message"])} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Save WhatsApp Settings"}
            </button>
          </div>
        )}

        {activeTab === "seo" && (
          <div className="space-y-5 max-w-lg">
            <h2 className="font-bold">SEO Settings</h2>
            <Field label="Meta Title" value={settings.meta_title || ""} onChange={(v) => update("meta_title", v)} placeholder="Legacy Mania — Collect The Stories..." />
            <div>
              <label className="block text-sm font-medium mb-1.5">Meta Description</label>
              <textarea
                value={settings.meta_description || ""}
                onChange={(e) => update("meta_description", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
              />
            </div>
            <Field label="OG Image URL" value={settings.og_image_url || ""} onChange={(v) => update("og_image_url", v)} placeholder="https://..." />
            <button onClick={() => save(["meta_title", "meta_description", "og_image_url"])} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Save SEO Settings"}
            </button>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-5 max-w-lg">
            <h2 className="font-bold">Analytics Integration</h2>
            <Field label="Google Tag Manager ID" value={settings.gtm_id || ""} onChange={(v) => update("gtm_id", v)} placeholder="GTM-XXXXXXX" />
            <Field label="Google Analytics ID" value={settings.ga_id || ""} onChange={(v) => update("ga_id", v)} placeholder="G-XXXXXXXXXX" />
            <Field label="Meta Pixel ID" value={settings.meta_pixel_id || ""} onChange={(v) => update("meta_pixel_id", v)} placeholder="XXXXXXXXXXXXXXXX" />
            <Field label="Mixpanel Token" value={settings.mixpanel_token || ""} onChange={(v) => update("mixpanel_token", v)} placeholder="your_token" />
            <p className="text-xs text-muted-foreground">Changes will take effect after redeploy.</p>
            <button onClick={() => save(["gtm_id", "ga_id", "meta_pixel_id", "mixpanel_token"])} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Save Analytics Settings"}
            </button>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-5 max-w-lg">
            <h2 className="font-bold">Store Information</h2>
            <Field label="Store Name" value={settings.store_name || ""} onChange={(v) => update("store_name", v)} placeholder="Legacy Mania" />
            <Field label="Store Email" value={settings.store_email || ""} onChange={(v) => update("store_email", v)} placeholder="hello@legacymania.in" />
            <Field label="Store Phone" value={settings.store_phone || ""} onChange={(v) => update("store_phone", v)} placeholder="+91 9876543210" />
            <button onClick={() => save(["store_name", "store_email", "store_phone"])} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Save Store Settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
      />
    </div>
  );
}
