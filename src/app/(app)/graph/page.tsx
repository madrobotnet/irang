import { Suspense } from "react";
import { GraphShell } from "@/components/graph/GraphShell";

export default function GraphPage() {
  return (
    <Suspense fallback={<div data-graph-view="loading" />}>
      <GraphShell />
    </Suspense>
  );
}
