import type { Metadata } from "next";
import { SettingsView } from "@/features/settings";
import { SETTINGS_COPY } from "@/features/settings/settings-copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SETTINGS_COPY[await getRequestLocale()].title };
}

export default function SettingsPage() {
  return <SettingsView />;
}
