import { defineCopy } from "@/lib/i18n/copy";

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

/**
 * Graph copy. Node labels and tags are stored user data and are never translated.
 * `canvas.tooltipLinks` feeds the HTML canvas tooltip, so it must stay plain text without markup.
 */
export const GRAPH_COPY = defineCopy({
  ko: {
    page: {
      title: "지식 그래프",
      eyebrow: "연결 탐색",
      description: "노트, 링크, 태그 사이의 관계를 살펴보고 연결된 생각으로 이동하세요.",
    },
    region: { explorer: "지식 그래프 탐색기", local: "로컬 지식 그래프" },
    toolbar: {
      scope: "그래프 범위",
      all: "전체",
      local: "로컬",
      depth: "깊이",
      depthLabel: "로컬 그래프 깊이",
      tagFilter: "태그 필터",
      allTags: "모든 태그",
      tagNodes: "태그 노드",
      orphans: "고립 노트",
      stats: (nodes: number, links: number) => `${nodes}개 노드 · ${links}개 연결`,
    },
    canvas: {
      zoomIn: "확대",
      zoomOut: "축소",
      fit: "화면에 맞추기",
      reset: "그래프 초기화",
      tooltipLinks: (degree: number) => `${degree}개 연결`,
    },
    status: {
      stale: "새 그래프를 불러오지 못했습니다. 이전 결과를 표시합니다.",
      loadFailed: "그래프를 불러오지 못했습니다.",
      loadFallback: "네트워크 상태를 확인해 주세요.",
      retry: "다시 시도",
      truncated: "그래프가 커서 일부 노드만 표시합니다.",
    },
    empty: {
      title: "표시할 연결이 없습니다.",
      filtered: "태그 필터를 지우거나 고립 노트를 표시해 보세요.",
      unfiltered: "노트에 위키링크를 추가하면 관계가 나타납니다.",
      clearFilter: "필터 지우기",
    },
    legend: { label: "태그 색상 범례", hint: "색상은 첫 번째 태그를 나타냅니다." },
    inspector: {
      empty: "노드를 선택하면 세부 정보와 작업을 볼 수 있습니다.",
      label: "선택한 노드",
      kind: { note: "노트", tag: "태그", unresolved: "아직 없는 노트" },
      close: "선택 해제",
      links: "연결",
      neighbors: "이웃 노드",
      noNeighbors: "직접 연결된 이웃이 없습니다.",
      open: "노트 열기",
      local: "이 노트 주변 보기",
      pin: "위치 고정",
      unpin: "고정 해제",
      create: "노트 만들고 열기",
      createFailed: "노트를 만들지 못했습니다.",
    },
    list: { summary: (count: number) => `노드를 목록으로 보기 (${count})` },
  },
  en: {
    page: {
      title: "Knowledge graph",
      eyebrow: "Explore connections",
      description: "See how your notes, links, and tags relate, then jump to a connected idea.",
    },
    region: { explorer: "Knowledge graph explorer", local: "Local knowledge graph" },
    toolbar: {
      scope: "Graph scope",
      all: "All",
      local: "Local",
      depth: "Depth",
      depthLabel: "Local graph depth",
      tagFilter: "Tag filter",
      allTags: "All tags",
      tagNodes: "Tag nodes",
      orphans: "Unlinked notes",
      stats: (nodes, links) => `${plural(nodes, "node", "nodes")} · ${plural(links, "connection", "connections")}`,
    },
    canvas: {
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      fit: "Fit to view",
      reset: "Reset graph",
      tooltipLinks: (degree) => plural(degree, "connection", "connections"),
    },
    status: {
      stale: "Couldn't load the updated graph. Showing the previous result.",
      loadFailed: "Couldn't load the graph.",
      loadFallback: "Check your network connection and try again.",
      retry: "Try again",
      truncated: "This graph is large, so only some nodes are shown.",
    },
    empty: {
      title: "No connections to show.",
      filtered: "Clear the tag filter or show unlinked notes.",
      unfiltered: "Add wikilinks to your notes to see how they connect.",
      clearFilter: "Clear filter",
    },
    legend: { label: "Tag color legend", hint: "Colors show each note's first tag." },
    inspector: {
      empty: "Select a node to see its details and actions.",
      label: "Selected node",
      kind: { note: "Note", tag: "Tag", unresolved: "Note not created yet" },
      close: "Clear selection",
      links: "Connections",
      neighbors: "Connected nodes",
      noNeighbors: "No directly connected nodes.",
      open: "Open note",
      local: "Show graph around this note",
      pin: "Pin position",
      unpin: "Unpin",
      create: "Create and open note",
      createFailed: "Couldn't create the note.",
    },
    list: { summary: (count) => `Browse nodes as a list (${count})` },
  },
});
