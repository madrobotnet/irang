import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

const MORE_LINKS = [
  { href: "/notes", label: "노트" },
  { href: "/graph", label: "그래프" },
  { href: "/settings", label: "설정" },
];

export default function NotesPage() {
  return (
    <PlaceholderPage
      title="더보기"
      description="노트 · 그래프 · 설정"
      moreLinks={MORE_LINKS}
    />
  );
}
