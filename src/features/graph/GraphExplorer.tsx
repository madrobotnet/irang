"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Focus, Maximize2, Minus, Network, Pin, PinOff, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api-client";
import type { GraphData, GraphNode, NoteRef, TagCount } from "@/lib/types";
import { graphKey, stablePaletteIndex, visibleLegendTags } from "./graph-model";
import type { GraphCanvasHandle } from "./ForceGraphCanvas";

const ForceGraphCanvas = dynamic(() => import("./ForceGraphCanvas").then((module) => module.ForceGraphCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-80 w-full rounded-card" />,
});

type Props = { noteId?: string; depth?: 1 | 2 | 3; height?: number; compact?: boolean };
const PALETTE_CLASSES = ["bg-accent", "bg-ok", "bg-warn", "bg-danger"] as const;

export function GraphExplorer({ noteId, depth: initialDepth = 1, height = 560, compact = false }: Props) {
  const router = useRouter();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(noteId ?? null);
  const [depth, setDepth] = useState<1 | 2 | 3>(initialDepth);
  const [includeTags, setIncludeTags] = useState(false);
  const [includeOrphans, setIncludeOrphans] = useState(true);
  const [tag, setTag] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pins, setPins] = useState<{ graph: GraphData | undefined; ids: Set<string> }>({ graph: undefined, ids: new Set() });
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const filters = { focusId, depth, includeTags, includeOrphans, tag };
  const key = graphKey(filters);
  const { data, error, isLoading, mutate } = useSWR<GraphData>(key, { keepPreviousData: true, shouldRetryOnError: false });
  const { data: tagData } = useSWR<{ tags: TagCount[] }>(compact ? null : "/api/tags", { shouldRetryOnError: false });
  const selected = data?.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedNodeId = selected?.id;
  useEffect(() => {
    if (selectedNodeId) inspectorRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedNodeId]);
  const selectedNeighbors = useMemo(() => {
    if (!data || !selectedId) return [];
    const ids = new Set<string>();
    for (const link of data.links) {
      if (link.source === selectedId) ids.add(link.target);
      if (link.target === selectedId) ids.add(link.source);
    }
    return data.nodes.filter((node) => ids.has(node.id));
  }, [data, selectedId]);
  const legend = useMemo(() => visibleLegendTags(data?.nodes ?? []), [data]);

  const recordPin = (nodeId: string, isPinned: boolean) => setPins((current) => {
    const ids = new Set(current.graph === data ? current.ids : []);
    if (isPinned) ids.add(nodeId); else ids.delete(nodeId);
    return { graph: data, ids };
  });
  const enterLocal = (id: string) => {
    setFocusId(id);
    setSelectedId(id);
  };
  const reset = () => {
    setSelectedId(null);
    setTag("");
    setIncludeTags(false);
    setIncludeOrphans(true);
    setDepth(initialDepth);
    setPins({ graph: data, ids: new Set() });
    if (!noteId) setFocusId(null);
    canvasRef.current?.reset();
  };
  const createUnresolved = async (node: GraphNode) => {
    setCreating(true);
    setActionError(null);
    try {
      const { note } = await api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title: node.label } });
      router.push(`/notes/${note.id}`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "노트를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };
  const togglePin = () => {
    if (!selected) return;
    const isPinned = canvasRef.current?.togglePin(selected.id) ?? false;
    recordPin(selected.id, isPinned);
  };

  return (
    <section className="space-y-3" aria-label={compact ? "로컬 지식 그래프" : "지식 그래프 탐색기"}>
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-desk p-2">
        {!noteId ? (
          <div className="flex rounded-ctl border border-line bg-card p-0.5" aria-label="그래프 범위">
            <Button size="sm" variant={!focusId ? "primary" : "ghost"} onClick={() => { setFocusId(null); setSelectedId(null); }}>전체</Button>
            <Button size="sm" variant={focusId ? "primary" : "ghost"} disabled={!focusId && selected?.kind !== "note"} onClick={() => selected?.kind === "note" && enterLocal(selected.id)}>로컬</Button>
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-mute">
          깊이
          <select aria-label="로컬 그래프 깊이" className="h-8 rounded-ctl border border-line bg-card px-2 text-ink focus-ring" value={depth} onChange={(event) => setDepth(Number(event.target.value) as 1 | 2 | 3)}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </label>
        {!compact ? (
          <label className="flex items-center gap-2 text-sm text-mute">
            태그 필터
            <select className="h-8 max-w-40 rounded-ctl border border-line bg-card px-2 text-ink focus-ring" value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="">모든 태그</option>
              {tagData?.tags.map((item) => <option key={item.tag} value={item.tag}>{item.tag} ({item.count})</option>)}
            </select>
          </label>
        ) : null}
        <label className="flex min-h-8 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={includeTags} onChange={(event) => setIncludeTags(event.target.checked)} />태그 노드</label>
        <label className="flex min-h-8 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={includeOrphans} onChange={(event) => setIncludeOrphans(event.target.checked)} />고립 노트</label>
        <span className="ml-auto text-sm text-mute" aria-live="polite">{data ? `${data.nodes.length}개 노드 · ${data.links.length}개 연결` : ""}</span>
      </div>

      {error && data ? <p role="alert" className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">새 그래프를 불러오지 못했습니다. 이전 결과를 표시합니다.</p> : null}
      {error && !data ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4">
          <p className="font-medium text-danger">그래프를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-ink">{error instanceof Error ? error.message : "네트워크 상태를 확인해 주세요."}</p>
          <Button className="mt-3" size="sm" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>다시 시도</Button>
        </div>
      ) : isLoading && !data ? (
        <Skeleton className="w-full rounded-card" style={{ height }} />
      ) : data && data.nodes.length === 0 ? (
        <EmptyState icon={Network} title="표시할 연결이 없습니다." description={tag ? "태그 필터를 지우거나 고립 노트를 표시해 보세요." : "노트에 위키링크를 추가하면 관계가 나타납니다."} action={tag ? <Button size="sm" onClick={() => setTag("")}>필터 지우기</Button> : undefined} />
      ) : data ? (
        <>
          <div className="relative overflow-hidden rounded-card border border-line bg-card shadow-card">
            <ForceGraphCanvas
              ref={canvasRef}
              data={data}
              height={height}
              selectedId={selectedId}
              onSelect={(node) => setSelectedId(node?.id ?? null)}
              onPinChange={recordPin}
            />
            <div className="absolute left-2 top-2 flex gap-1 rounded-ctl border border-line bg-card/90 p-1 shadow-card">
              <Button iconOnly size="sm" variant="ghost" aria-label="확대" onClick={() => canvasRef.current?.zoomBy(1.35)}><Plus aria-hidden className="size-4" /></Button>
              <Button iconOnly size="sm" variant="ghost" aria-label="축소" onClick={() => canvasRef.current?.zoomBy(0.75)}><Minus aria-hidden className="size-4" /></Button>
              <Button iconOnly size="sm" variant="ghost" aria-label="화면에 맞추기" onClick={() => canvasRef.current?.fit()}><Maximize2 aria-hidden className="size-4" /></Button>
              <Button iconOnly size="sm" variant="ghost" aria-label="그래프 초기화" onClick={reset}><RotateCcw aria-hidden className="size-4" /></Button>
            </div>
          </div>
          {data.truncated ? <p role="status" className="text-sm text-warn">그래프가 커서 일부 노드만 표시합니다.</p> : null}
          {legend.length ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute" aria-label="태그 색상 범례">
              <span>색상은 첫 번째 태그를 나타냅니다.</span>
              {legend.map((item) => <span key={item} className="inline-flex items-center gap-1"><span aria-hidden className={`size-2 rounded-pill ${PALETTE_CLASSES[stablePaletteIndex(item, PALETTE_CLASSES.length)]}`} />#{item}</span>)}
            </div>
          ) : null}
          <div ref={inspectorRef} className="scroll-mb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom,0px)+1.25rem)]">
            <Inspector node={selected} neighbors={selectedNeighbors} pinned={selected ? pins.graph === data && pins.ids.has(selected.id) : false} creating={creating} actionError={actionError} onClose={() => { setSelectedId(null); setActionError(null); }} onSelect={setSelectedId} onPin={togglePin} onLocal={enterLocal} onCreate={createUnresolved} />
          </div>
          <AccessibleGraphList data={data} selectedId={selectedId} onSelect={(node) => setSelectedId(node.id)} />
        </>
      ) : null}
    </section>
  );
}

function Inspector({ node, neighbors, pinned, creating, actionError, onClose, onSelect, onPin, onLocal, onCreate }: { node: GraphNode | null; neighbors: GraphNode[]; pinned: boolean; creating: boolean; actionError: string | null; onClose(): void; onSelect(id: string): void; onPin(): void; onLocal(id: string): void; onCreate(node: GraphNode): void }) {
  if (!node) return <p className="rounded-card border border-dashed border-line px-4 py-3 text-sm text-mute">노드를 선택하면 세부 정보와 작업을 볼 수 있습니다.</p>;
  return (
    <aside id="graph-inspector" className="rounded-card border border-line bg-card p-4 shadow-card" aria-label="선택한 노드">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium text-mute">{node.kind === "note" ? "노트" : node.kind === "tag" ? "태그" : "아직 없는 노트"}</p><h2 className="truncate text-lg font-semibold text-ink">{node.label}</h2></div>
        <Button iconOnly size="sm" variant="ghost" aria-label="선택 해제" onClick={onClose}><X aria-hidden className="size-4" /></Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">{node.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}<Badge tone="neutral" count={node.degree}>연결</Badge></div>
      {neighbors.length ? <div className="mt-3"><p className="text-xs font-medium text-mute">이웃 노드</p><div className="mt-1 flex flex-wrap gap-1">{neighbors.map((neighbor) => <button key={neighbor.id} type="button" className="rounded-pill border border-line bg-desk px-2 py-1 text-xs text-ink hover:bg-line/50 focus-ring" onClick={() => onSelect(neighbor.id)}>{neighbor.label}</button>)}</div></div> : <p className="mt-3 text-sm text-mute">직접 연결된 이웃이 없습니다.</p>}
      {actionError ? <p role="alert" className="mt-3 text-sm text-danger">{actionError}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {node.kind === "note" ? <Link className={buttonClassName({ variant: "primary", size: "sm" })} href={`/notes/${node.id}`}>노트 열기</Link> : null}
        {node.kind === "note" ? <Button size="sm" leading={<Focus aria-hidden className="size-4" />} onClick={() => onLocal(node.id)}>이 노트 주변 보기</Button> : null}
        <Button size="sm" leading={pinned ? <PinOff aria-hidden className="size-4" /> : <Pin aria-hidden className="size-4" />} onClick={onPin}>{pinned ? "고정 해제" : "위치 고정"}</Button>
        {node.kind === "unresolved" ? <Button size="sm" variant="primary" loading={creating} onClick={() => void onCreate(node)}>노트 만들고 열기</Button> : null}
      </div>
    </aside>
  );
}

function AccessibleGraphList({ data, selectedId, onSelect }: { data: GraphData; selectedId: string | null; onSelect(node: GraphNode): void }) {
  return (
    <details className="rounded-card border border-line bg-desk p-3">
      <summary className="cursor-pointer font-medium text-ink focus-ring">접근 가능한 노드 목록 ({data.nodes.length})</summary>
      <ul className="mt-3 grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {data.nodes.map((node) => <li key={node.id}><button type="button" aria-pressed={selectedId === node.id} className="flex min-h-11 w-full items-center justify-between rounded-ctl px-3 py-2 text-left text-sm text-ink hover:bg-line/50 focus-ring aria-pressed:bg-accent-soft" onClick={() => onSelect(node)}><span className="truncate">{node.label}</span><span className="ml-2 shrink-0 text-xs text-mute">{node.degree}</span></button></li>)}
      </ul>
    </details>
  );
}
