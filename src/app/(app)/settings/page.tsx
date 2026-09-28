import type { Metadata } from "next";
import { SettingsView } from "@/features/settings";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return <SettingsView />;
}
