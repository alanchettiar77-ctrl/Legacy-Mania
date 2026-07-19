import {
  listNotifications,
  listActiveNotifications,
  getNotification,
  getMaxDisplayOrder,
  insertNotification,
  updateNotification as repoUpdate,
  softDeleteNotification,
  reorderNotifications,
  getDisplaySettings,
  updateDisplaySettings,
  type NotificationRow,
} from "@/lib/repositories/notification-repository";
import type {
  NotificationCreateInput,
  NotificationUpdateInput,
  DisplaySettingsInput,
} from "@/lib/validation/notification";

export type { NotificationRow };

export interface HomepageNotificationsResult {
  items: NotificationRow[];
  config: Record<string, unknown>;
}

export const DEFAULT_DISPLAY_CONFIG: Record<string, unknown> = {
  marqueeSpeedSeconds: 30,
  direction: "left",
  pauseOnHover: true,
  loop: true,
  backgroundColor: "",
  textColor: "",
  fontSize: "sm",
  fontWeight: "medium",
  paddingY: "2.5",
  borderRadius: "none",
  showOnMobile: true,
  showOnDesktop: true,
};

/**
 * Storefront feed. Never throws — the homepage must render (without a bar)
 * even if Supabase is unreachable or the migration hasn't been applied yet.
 */
export async function getHomepageNotifications(
  device: "desktop" | "mobile" | "both" = "both"
): Promise<HomepageNotificationsResult> {
  try {
    const [items, config] = await Promise.all([
      listActiveNotifications(new Date().toISOString(), device),
      getDisplaySettings(),
    ]);
    return { items, config: { ...DEFAULT_DISPLAY_CONFIG, ...(config ?? {}) } };
  } catch (error) {
    console.error("Failed to load homepage notifications", error);
    return { items: [], config: DEFAULT_DISPLAY_CONFIG };
  }
}

export async function listAllNotifications(): Promise<NotificationRow[]> {
  return listNotifications();
}

export async function createNotification(
  input: NotificationCreateInput,
  adminId: string
): Promise<NotificationRow> {
  const display_order = input.display_order ?? (await getMaxDisplayOrder()) + 1;
  return insertNotification({
    ...input,
    display_order,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function updateNotification(
  id: string,
  patch: NotificationUpdateInput,
  adminId: string
): Promise<NotificationRow | null> {
  return repoUpdate(id, { ...patch, updated_by: adminId });
}

export async function deleteNotification(id: string, adminId: string): Promise<boolean> {
  return softDeleteNotification(id, adminId);
}

/** Copies an existing notification as an inactive draft appended at the end. */
export async function duplicateNotification(
  id: string,
  adminId: string
): Promise<NotificationRow | null> {
  const source = await getNotification(id);
  if (!source) return null;
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    deleted_at: _d,
    created_by: _cb,
    updated_by: _ub,
    display_order: _o,
    ...fields
  } = source;
  return insertNotification({
    ...fields,
    title: `${source.title} (copy)`,
    is_active: false,
    display_order: (await getMaxDisplayOrder()) + 1,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function reorder(ids: string[], adminId: string): Promise<void> {
  return reorderNotifications(ids, adminId);
}

export interface BulkResult {
  processed: number;
}

export async function bulkAction(
  ids: string[],
  action: "activate" | "deactivate" | "delete",
  adminId: string
): Promise<BulkResult> {
  let processed = 0;
  for (const id of ids) {
    if (action === "delete") {
      if (await softDeleteNotification(id, adminId)) processed++;
    } else {
      const row = await repoUpdate(id, {
        is_active: action === "activate",
        updated_by: adminId,
      });
      if (row) processed++;
    }
  }
  return { processed };
}

export async function getDisplayConfig(): Promise<Record<string, unknown>> {
  const stored = await getDisplaySettings();
  return { ...DEFAULT_DISPLAY_CONFIG, ...(stored ?? {}) };
}

export async function updateDisplayConfig(
  patch: DisplaySettingsInput,
  adminId: string
): Promise<Record<string, unknown>> {
  const merged = { ...(await getDisplayConfig()), ...patch };
  await updateDisplaySettings(merged, adminId);
  return merged;
}
