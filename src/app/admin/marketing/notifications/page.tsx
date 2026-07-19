import { listAllNotifications, getDisplayConfig } from "@/lib/services/notification-service";
import NotificationsTable from "./notifications-table";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  // Service-role reads (RLS bypass) so inactive/scheduled rows stay visible and editable.
  // Both calls degrade gracefully if migration 007 hasn't been applied yet.
  let notifications: Awaited<ReturnType<typeof listAllNotifications>> = [];
  let config: Record<string, unknown> = {};
  try {
    [notifications, config] = await Promise.all([listAllNotifications(), getDisplayConfig()]);
  } catch (error) {
    console.error("Failed to load notifications admin data", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Homepage Notifications</h1>
        <p className="text-muted-foreground text-sm">
          {notifications.length} notifications — shown in the scrolling bar on the storefront homepage
        </p>
      </div>
      <NotificationsTable initialNotifications={notifications} initialConfig={config} />
    </div>
  );
}
