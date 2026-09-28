import type { Metadata } from "next";
import { GraphExplorer } from "@/features/graph";

export const metadata: Metadata = { title: "지식 그래프" };

export default function GraphPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-10">
      <header className="mb-6 border-b border-line pb-5">
        <p className="text-sm font-medium text-accent">연결 탐색</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink lg:text-3xl">지식 그래프</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">노트, 링크, 태그 사이의 관계를 살펴보고 연결된 생각으로 이동하세요.</p>
      </header>
      <GraphExplorer />
    </div>
  );
}
