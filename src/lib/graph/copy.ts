export const GRAPH_COPY = {
  title: "그래프",
  empty: "아직 연결된 노트가 없어요.",
  emptyHint: "생각·링크·메모를 담으면 노드와 관계가 여기에 쌓입니다.",
  capture: "캡처",
  error: "그래프를 불러오지 못했어요.",
  retry: "다시 시도",
  overload: "전체가 많아서 일부만 보여요. 필터로 좁혀 보세요.",
  dismiss: "닫기",
  seed: "시드",
  depth: "깊이",
  type: "유형",
  relation: "관계",
  all: "전체",
  openNote: "노트 열기",
  chatNode: "이 노드로 채팅",
  openInGraph: "그래프에서 열기",
  connected: "연결된 엣지",
  more: "더보기",
  orbitHint: "orbit · pan · zoom",
} as const;

export const GRAPH_KIND_CHIP: Record<"note" | "inbox" | "concept" | "source", string> = {
  note: "엔티티",
  concept: "개념",
  source: "소스",
  inbox: "Inbox",
};

export const GRAPH_RELATION_CHIP: Record<"link" | "backlink" | "tag" | "suggested", string> = {
  link: "연결",
  backlink: "백링크",
  tag: "태그",
  suggested: "제안",
};

export const GRAPH_KIND_BADGE: Record<"note" | "inbox" | "concept" | "source", string> = {
  note: "ENTITY",
  concept: "CONCEPT",
  source: "SOURCE",
  inbox: "INBOX",
};
