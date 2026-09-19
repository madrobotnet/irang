import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

const MORE_LINKS = [
  { href: "/notes", label: "노트" },
  { href: "/graph", label: "그래프" },
  { href: "/settings", label: "설정" },
];

export default function GraphPage() {
  return (
    <PlaceholderPage
      title="그래프"
      description="P1 범위 밖 · 링크만 제공"
      moreLinks={MORE_LINKS}
    />
  );
}
