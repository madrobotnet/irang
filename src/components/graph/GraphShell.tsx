"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_GRAPH_MODE,
  type GraphDepth,
  type GraphNodeKind,
  type GraphQuery,
  type GraphRelation,
} from "@/domain/graph/types";
import { fetchGraph } from "@/lib/graph/client";
import { graphPageHref, graphQueryFromSearch, toggleKind, toggleRelation } from "@/lib/graph/query";
import type { GraphViewModel } from "@/lib/graph/view-model";
import { useCapture } from "@/components/capture/CaptureContext";
import { GraphView } from "./GraphView";

const GraphCanvas3D = dynamic(
  () => import("./GraphCanvas3D").then((mod) => mod.GraphCanvas3D),
  { ssr: false },
);

function sameQuery(left: GraphQuery, right: GraphQuery): boolean {
  return (
    left.seedId === right.seedId &&
    left.depth === right.depth &&
    left.mode === right.mode &&
    left.kinds.join(",") === right.kinds.join(",") &&
    left.relations.join(",") === right.relations.join(",")
  );
}

export function GraphShell() {
  const router = useRouter();
  const params = useSearchParams();
  const { openCapture } = useCapture();
  const urlQuery = useMemo(() => graphQueryFromSearch(params), [params]);
  const [query, setQuery] = useState<GraphQuery>(urlQuery);
  const [model, setModel] = useState<GraphViewModel>({
    status: "loading",
    query: urlQuery,
    payload: null,
    selectedId: null,
    bannerDismissed: false,
  });
  const [seedOpen, setSeedOpen] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);

  useEffect(() => {
    if (!sameQuery(query, urlQuery)) {
      setQuery(urlQuery);
    }
  }, [query, urlQuery]);

  const commitQuery = useCallback(
    (next: GraphQuery) => {
      setQuery(next);
      router.replace(graphPageHref(next), { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    setModel((current) => ({
      ...current,
      status: "loading",
      query,
      selectedId: null,
      bannerDismissed: false,
    }));
    void fetchGraph(query)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setModel({
          status: "ready",
          query,
          payload,
          selectedId: null,
          bannerDismissed: false,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setModel({
          status: "error",
          query,
          payload: null,
          selectedId: null,
          bannerDismissed: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModel((current) => ({ ...current, selectedId: null }));
        setSeedOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reload = useCallback(() => {
    setQuery((current) => ({ ...current }));
  }, []);

  const canvas =
    model.payload && model.payload.nodes.length > 0 ? (
      <GraphCanvas3D
        nodes={model.payload.nodes}
        edges={model.payload.edges}
        selectedId={model.selectedId}
        onSelect={(id) => {
          setModel((current) => ({ ...current, selectedId: id }));
          setInspectorExpanded(false);
        }}
      />
    ) : null;

  return (
    <GraphView
      model={model}
      seedOpen={seedOpen}
      inspectorExpanded={inspectorExpanded}
      canvas={canvas}
      onCapture={() => openCapture("note")}
      onRetry={reload}
      onDismissBanner={() => setModel((current) => ({ ...current, bannerDismissed: true }))}
      onToggleSeedOpen={() => setSeedOpen((open) => !open)}
      onSeed={(seedId) => {
        setSeedOpen(false);
        commitQuery({ ...query, seedId, mode: "local" });
      }}
      onDepth={(depth: GraphDepth) =>
        commitQuery({ ...query, depth, mode: "local", seedId: query.seedId })
      }
      onKind={(kind: GraphNodeKind) => commitQuery({ ...query, kinds: toggleKind(query.kinds, kind) })}
      onRelation={(relation: GraphRelation) =>
        commitQuery({ ...query, relations: toggleRelation(query.relations, relation) })
      }
      onAll={() =>
        commitQuery({
          ...query,
          seedId: query.mode === "full" ? query.seedId : null,
          mode: query.mode === "full" ? DEFAULT_GRAPH_MODE : "full",
        })
      }
      onToggleInspector={() => setInspectorExpanded((open) => !open)}
    />
  );
}
