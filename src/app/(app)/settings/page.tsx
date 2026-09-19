import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

const MORE_LINKS = [
  { href: "/notes", label: "노트" },
  { href: "/graph", label: "그래프" },
  { href: "/settings", label: "설정" },
];

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="설정"
      description="테마 등 · P1 준비 중"
      moreLinks={MORE_LINKS}
    />
  );
}
