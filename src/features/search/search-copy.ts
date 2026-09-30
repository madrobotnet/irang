import { defineCopy } from "@/lib/i18n/copy";

/** Search page copy. Korean is the source; stored note titles, snippets and tags are never translated. */
export const SEARCH_COPY = defineCopy({
  ko: {
    title: "검색",
    loading: "검색 화면을 불러오는 중입니다.",
    description: "제목, 내용, 태그로 기록을 다시 찾아보세요.",
    form: {
      queryLabel: "검색어",
      queryPlaceholder: "제목이나 내용을 검색하세요",
      submit: "검색",
      tagLabel: "태그 (선택)",
      tagPlaceholder: "태그 이름",
      clearTag: "태그 필터 지우기",
    },
    idle: { title: "검색어를 입력하세요", description: "노트 제목이나 내용에서 찾을 수 있습니다." },
    error: { title: "검색하지 못했습니다", fallback: "연결을 확인한 뒤 다시 시도하세요.", retry: "다시 시도" },
    empty: { title: "검색 결과가 없습니다", description: "다른 검색어나 태그를 입력해 보세요." },
    resultCount: (count: number) => `${count}개의 노트`,
    untitled: "제목 없는 노트",
    searchTag: (tag: string) => `태그 ${tag}로 검색`,
    /** Keyed by what each signal measures; search-model maps server signal names onto these keys. */
    signals: { keyword: "키워드", similarSpelling: "오타 유사도", characterSimilarity: "문자 유사도" },
  },
  en: {
    title: "Search",
    loading: "Loading search...",
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
    signals: { keyword: "Keyword", similarSpelling: "Similar spelling", characterSimilarity: "Character similarity" },
  },
});
