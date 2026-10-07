import { defineCopy } from "@/lib/i18n/copy";

/** Search page copy. Korean is the source; stored note titles, snippets and tags are never translated. */
export const SEARCH_COPY = defineCopy({
  ko: {
    title: "검색",
    loading: "검색 화면을 불러오는 중…",
    description: "제목, 내용, 태그로 노트를 다시 찾아보세요.",
    form: {
      queryLabel: "검색어",
      queryPlaceholder: "제목이나 내용을 검색하세요",
      submit: "검색",
      tagLabel: "태그 (선택)",
      tagPlaceholder: "태그 이름",
      clearTag: "태그 필터 지우기",
    },
    idle: { title: "검색어를 입력하세요", description: "노트 제목과 내용에서 일치하는 부분을 찾아요." },
    error: { title: "검색하지 못했어요", fallback: "네트워크 연결을 확인한 뒤 다시 시도하세요.", retry: "다시 시도" },
    empty: { title: "검색 결과가 없어요", description: "다른 검색어나 태그를 입력해 보세요." },
    resultCount: (count: number) => `노트 ${count}개`,
    untitled: "제목 없는 노트",
    searchTag: (tag: string) => `${tag} 태그로 검색`,
    /** Keyed by what each signal measures; search-model maps server signal names onto these keys. */
    signals: { keyword: "키워드", similarSpelling: "비슷한 철자", characterSimilarity: "문자 유사도", learnedMeaning: "학습 모델 · 의미 유사도" },
    index: {
      states: {
        disabled: "의미 검색이 꺼져 있어요.",
        unavailable: "지금은 의미 검색을 사용할 수 없어요.",
        indexing: "의미 검색 색인을 만드는 중이에요.",
        ready: "의미 검색 색인이 준비됐어요.",
      },
      progress: (indexed: number, total: number) => `노트 ${total}개 중 ${indexed}개 색인됨`,
      lexical: "제목, 키워드, 비슷한 철자로 계속 검색할 수 있어요.",
    },
    passage: (heading: string, start: number, end: number) => `${heading || "원문"} · ${start === end ? `${start}줄` : `${start}–${end}줄`}`,
  },
  en: {
    title: "Search",
    loading: "Loading search…",
    description: "Find your notes again by title, content, or tag.",
    form: {
      queryLabel: "Search terms",
      queryPlaceholder: "Search titles and content",
      submit: "Search",
      tagLabel: "Tag (optional)",
      tagPlaceholder: "Tag name",
      clearTag: "Clear tag filter",
    },
    idle: { title: "Enter a search term", description: "Find matches in note titles and content." },
    error: { title: "Search failed", fallback: "Check your connection and try again.", retry: "Try again" },
    empty: { title: "No results", description: "Try a different search term or tag." },
    resultCount: (count) => (count === 1 ? "1 note" : `${count} notes`),
    untitled: "Untitled note",
    searchTag: (tag) => `Search by tag ${tag}`,
    signals: { keyword: "Keyword", similarSpelling: "Similar spelling", characterSimilarity: "Character similarity", learnedMeaning: "Learned model · Meaning similarity" },
    index: {
      states: {
        disabled: "Meaning search is disabled.",
        unavailable: "Meaning search is currently unavailable.",
        indexing: "The meaning search index is being built.",
        ready: "The meaning search index is ready.",
      },
      progress: (indexed, total) => `${indexed} of ${total} notes indexed`,
      lexical: "Title, keyword, and similar-spelling search remain available.",
    },
    passage: (heading, start, end) => `${heading || "Source"} · ${start === end ? `line ${start}` : `lines ${start}–${end}`}`,
  },
});
