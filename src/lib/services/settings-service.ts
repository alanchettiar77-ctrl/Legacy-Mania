import { upsertSetting } from "@/lib/repositories/settings-repository";

export async function saveSettings(entries: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(entries).map(([key, value]) => upsertSetting(key, value))
  );
}
