"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Copy, Eye, EyeOff,
  GripVertical, Search, Settings2,
} from "lucide-react";
import {
  notificationCreateSchema,
  NOTIFICATION_TYPES,
  NOTIFICATION_DEVICES,
} from "@/lib/validation/notification";
import type { NotificationRow } from "@/lib/services/notification-service";

type Config = Record<string, unknown>;

const TYPE_LABELS: Record<string, string> = {
  sale: "Sale", limited_stock: "Limited Stock", new_arrival: "New Arrival",
  trending: "Trending", recently_sold: "Recently Sold", new_collection: "New Collection",
  offer: "Offer", flash_sale: "Flash Sale", announcement: "Announcement",
  shipping_update: "Shipping Update", event: "Event", countdown: "Countdown", custom: "Custom",
};

const EMPTY_FORM = {
  title: "", message: "", short_message: "", type: "announcement", cta_text: "", cta_url: "",
  priority: "0", icon: "", background_color: "", text_color: "",
  start_date: "", end_date: "", device: "both", is_active: true,
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

function toIsoOrNull(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotificationsTable({
  initialNotifications,
  initialConfig,
}: {
  initialNotifications: NotificationRow[];
  initialConfig: Config;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialNotifications);
  const [config, setConfig] = useState(initialConfig);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState<NotificationRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => setRows(initialNotifications), [initialNotifications]);

  const filtered = useMemo(
    () =>
      rows.filter((n) => {
        if (search && !`${n.title} ${n.message}`.toLowerCase().includes(search.toLowerCase())) return false;
        if (typeFilter !== "all" && n.type !== typeFilter) return false;
        if (statusFilter === "active" && !n.is_active) return false;
        if (statusFilter === "hidden" && n.is_active) return false;
        return true;
      }),
    [rows, search, typeFilter, statusFilter]
  );

  const isFiltered = search !== "" || typeFilter !== "all" || statusFilter !== "all";
  const previewItems = rows.filter((n) => n.is_active);

  const set = (key: keyof FormState) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (n: NotificationRow) => {
    setForm({
      title: n.title, message: n.message, short_message: n.short_message ?? "",
      type: n.type, cta_text: n.cta_text ?? "", cta_url: n.cta_url ?? "",
      priority: String(n.priority), icon: n.icon ?? "",
      background_color: n.background_color ?? "", text_color: n.text_color ?? "",
      start_date: toLocalInput(n.start_date), end_date: toLocalInput(n.end_date),
      device: n.device, is_active: n.is_active,
    });
    setEditing(n);
    setShowForm(true);
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    message: form.message.trim(),
    short_message: form.short_message.trim() || null,
    type: form.type,
    cta_text: form.cta_text.trim() || null,
    cta_url: form.cta_url.trim() || null,
    priority: Number(form.priority) || 0,
    icon: form.icon.trim() || null,
    background_color: form.background_color.trim() || null,
    text_color: form.text_color.trim() || null,
    start_date: toIsoOrNull(form.start_date),
    end_date: toIsoOrNull(form.end_date),
    device: form.device,
    is_active: form.is_active,
  });

  const submit = async () => {
    const payload = buildPayload();
    const parsed = notificationCreateSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiRequest(`/api/admin/notifications/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setRows((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
        toast.success("Notification updated");
      } else {
        const created = await apiRequest("/api/admin/notifications", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setRows((prev) => [...prev, created]);
        toast.success("Notification created");
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (n: NotificationRow) => {
    try {
      const updated = await apiRequest(`/api/admin/notifications/${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !n.is_active }),
      });
      setRows((prev) => prev.map((r) => (r.id === n.id ? updated : r)));
      toast.success(updated.is_active ? "Notification live" : "Notification hidden");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const duplicate = async (n: NotificationRow) => {
    try {
      const copy = await apiRequest(`/api/admin/notifications/${n.id}/duplicate`, { method: "POST" });
      setRows((prev) => [...prev, copy]);
      toast.success("Duplicated as hidden draft");
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const remove = async (n: NotificationRow) => {
    if (!confirm(`Delete "${n.title}"?`)) return;
    try {
      await apiRequest(`/api/admin/notifications/${n.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== n.id));
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const persistOrder = async (ordered: NotificationRow[]) => {
    setRows(ordered);
    try {
      await apiRequest("/api/admin/notifications/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: ordered.map((r) => r.id) }),
      });
    } catch {
      toast.error("Failed to reorder");
      router.refresh();
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  };

  const onDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: "activate" | "deactivate" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} notifications?`)) return;
    try {
      await apiRequest("/api/admin/notifications/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action }),
      });
      if (action === "delete") setRows((prev) => prev.filter((r) => !selected.has(r.id)));
      else
        setRows((prev) =>
          prev.map((r) => (selected.has(r.id) ? { ...r, is_active: action === "activate" } : r))
        );
      setSelected(new Set());
      toast.success(`Bulk ${action} done`);
    } catch {
      toast.error("Bulk action failed");
    }
  };

  const saveSettings = async (patch: Config) => {
    try {
      const merged = await apiRequest("/api/admin/notifications/display-settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setConfig(merged);
      toast.success("Display settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm";

  return (
    <div className="space-y-4">
      {/* Live preview */}
      {previewItems.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <p className="text-xs text-muted-foreground px-4 pt-3">Live preview</p>
          <div
            className="w-full overflow-hidden py-2.5 mt-2 select-none"
            style={{ backgroundColor: (config.backgroundColor as string) || "var(--primary, #7c3aed)" }}
          >
            <div className="flex animate-marquee hover:[animation-play-state:paused] whitespace-nowrap">
              {[...previewItems, ...previewItems].map((n, i) => (
                <span
                  key={`${n.id}-${i}`}
                  className="inline-flex items-center gap-1 text-white text-sm font-medium px-8 shrink-0"
                  style={{ color: (config.textColor as string) || undefined }}
                >
                  {n.icon ? `${n.icon} ` : ""}{n.message}
                  <span className="mx-4 text-white/40">|</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="all">All types</option>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="flex items-center gap-2 text-sm py-2.5 px-4 rounded-xl border border-border hover:bg-accent"
        >
          <Settings2 className="w-4 h-4" /> Display
        </button>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4">
          <Plus className="w-4 h-4" /> Add Notification
        </button>
      </div>

      {/* Display settings */}
      {showSettings && (
        <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Marquee speed (s)</label>
            <input
              type="number" min={5} max={120} defaultValue={Number(config.marqueeSpeedSeconds ?? 30)}
              onBlur={(e) => saveSettings({ marqueeSpeedSeconds: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Direction</label>
            <select
              defaultValue={String(config.direction ?? "left")}
              onChange={(e) => saveSettings({ direction: e.target.value })}
              className={inputCls}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Background</label>
            <input
              placeholder="#7c3aed or empty = theme" defaultValue={String(config.backgroundColor ?? "")}
              onBlur={(e) => saveSettings({ backgroundColor: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Text color</label>
            <input
              placeholder="#ffffff or empty" defaultValue={String(config.textColor ?? "")}
              onBlur={(e) => saveSettings({ textColor: e.target.value })}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" defaultChecked={config.pauseOnHover !== false}
              onChange={(e) => saveSettings({ pauseOnHover: e.target.checked })}
            />
            Pause on hover
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" defaultChecked={config.showOnMobile !== false}
              onChange={(e) => saveSettings({ showOnMobile: e.target.checked })}
            />
            Show on mobile
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" defaultChecked={config.showOnDesktop !== false}
              onChange={(e) => saveSettings({ showOnDesktop: e.target.checked })}
            />
            Show on desktop
          </label>
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-accent/40 border border-border rounded-xl px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button onClick={() => bulk("activate")} className="px-3 py-1 rounded-lg hover:bg-accent">Activate</button>
          <button onClick={() => bulk("deactivate")} className="px-3 py-1 rounded-lg hover:bg-accent">Hide</button>
          <button onClick={() => bulk("delete")} className="px-3 py-1 rounded-lg text-red-500 hover:bg-red-500/10">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 w-8"></th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const index = rows.findIndex((r) => r.id === n.id);
                return (
                  <tr
                    key={n.id}
                    draggable={!isFiltered}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(index)}
                    className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${!n.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="p-4">
                      <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSelect(n.id)} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {!isFiltered && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />}
                        <button onClick={() => move(index, -1)} disabled={index === 0 || isFiltered}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => move(index, 1)} disabled={index === rows.length - 1 || isFiltered}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30" aria-label="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-sm max-w-md">
                      <p className="font-medium truncate">{n.title}</p>
                      <p className="text-muted-foreground truncate">{n.icon ? `${n.icon} ` : ""}{n.message}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent">{TYPE_LABELS[n.type] ?? n.type}</span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {n.start_date || n.end_date
                        ? `${n.start_date ? new Date(n.start_date).toLocaleDateString() : "…"} → ${n.end_date ? new Date(n.end_date).toLocaleDateString() : "…"}`
                        : "Always"}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        n.is_active
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}>
                        {n.is_active ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(n)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(n)} title={n.is_active ? "Hide" : "Activate"}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                          {n.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => duplicate(n)} title="Duplicate"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(n)} title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>{rows.length === 0 ? "No notifications yet." : "Nothing matches your filters."}</p>
              {rows.length === 0 && (
                <button onClick={openAdd} className="text-primary hover:underline text-sm mt-1">
                  Add your first notification
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/edit dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing ? "Edit Notification" : "Add Notification"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Title * <span className="text-muted-foreground font-normal">(internal label)</span></label>
                <input value={form.title} onChange={(e) => set("title")(e.target.value)}
                  placeholder="e.g., Flash sale weekend" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Message * <span className="text-muted-foreground font-normal">(shown in the bar — emojis welcome)</span></label>
                <input value={form.message} onChange={(e) => set("message")(e.target.value)}
                  placeholder="🔥 15 people purchased Pokémon cards today." className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Short message (mobile)</label>
                <input value={form.short_message} onChange={(e) => set("short_message")(e.target.value)}
                  placeholder="Optional shorter version" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select value={form.type} onChange={(e) => set("type")(e.target.value)} className={inputCls}>
                  {NOTIFICATION_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">CTA text</label>
                <input value={form.cta_text} onChange={(e) => set("cta_text")(e.target.value)}
                  placeholder="Shop now" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">CTA link</label>
                <input value={form.cta_url} onChange={(e) => set("cta_url")(e.target.value)}
                  placeholder="/catalog/pokemon" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Priority (0–100)</label>
                <input type="number" min={0} max={100} value={form.priority}
                  onChange={(e) => set("priority")(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Icon (emoji)</label>
                <input value={form.icon} onChange={(e) => set("icon")(e.target.value)}
                  placeholder="🔥" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Start date</label>
                <input type="datetime-local" value={form.start_date}
                  onChange={(e) => set("start_date")(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End date</label>
                <input type="datetime-local" value={form.end_date}
                  onChange={(e) => set("end_date")(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Device</label>
                <select value={form.device} onChange={(e) => set("device")(e.target.value)} className={inputCls}>
                  {NOTIFICATION_DEVICES.map((d) => (
                    <option key={d} value={d}>{d === "both" ? "Desktop + Mobile" : d[0].toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => set("is_active")(e.target.checked)} />
                Active (visible on homepage)
              </label>
            </div>
            <button onClick={submit} disabled={saving}
              className="w-full btn-primary py-3 text-sm disabled:opacity-70 mt-5">
              {saving ? "Saving..." : editing ? "Update Notification" : "Add Notification"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
