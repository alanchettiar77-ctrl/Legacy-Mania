import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRaw } = await (supabase as any).from("settings").select("*");
  const settings = settingsRaw as Array<{ key: string; value: unknown }> | null;

  const settingsMap: Record<string, unknown> = {};
  settings?.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure your store settings</p>
      </div>
      <SettingsClient initialSettings={settingsMap} />
    </div>
  );
}
