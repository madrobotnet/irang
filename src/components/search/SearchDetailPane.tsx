import type { SearchRow } from "@/lib/search/project";
import { SEARCH_COPY } from "./copy";
import paneStyles from "./SearchDetailPane.module.css";
export type SearchDetailPaneProps = {
  row: SearchRow | null;
  className?: string;
};

function detailTags(row: SearchRow): string[] {
  const tags: string[] = [];
  if (row.similarityLabel) tags.push(row.similarityLabel);
  if (row.relevance !== null) tags.push(SEARCH_COPY.relevance);
  return tags;
}

function detailMeta(row: SearchRow): string {
  const parts = [row.path];
  if (row.relevance !== null) {
    parts.push(`${SEARCH_COPY.relevance} ${Math.round(row.relevance * 100)}%`);
  }
  if (row.similarity !== null) {
    parts.push(`${SEARCH_COPY.similar} ${Math.round(row.similarity * 100)}%`);
  }
  return parts.join(" · ");
}

export function SearchDetailPane({ row, className }: SearchDetailPaneProps) {
  const tags = row ? detailTags(row) : [];

  return (
    <section
      className={[paneStyles.panel, className].filter(Boolean).join(" ")}
      aria-label="선택 항목"
      data-search-detail
      data-testid="search-detail"
    >
      {row ? (
        <>
          <span className={paneStyles.badge}>{SEARCH_COPY.detailTypeNote}</span>
          <h3 className={paneStyles.title}>{row.title}</h3>
          <div className={paneStyles.meta}>{detailMeta(row)}</div>
          <div className={paneStyles.body}>
            {row.snippet ? <p>{row.snippet}</p> : <p className={paneStyles.empty}>{SEARCH_COPY.detailNoSnippet}</p>}
          </div>
          {tags.length > 0 ? (
            <div className={paneStyles.tags}>
              {tags.map((tag) => (
                <span key={tag} className={paneStyles.tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className={paneStyles.empty}>{SEARCH_COPY.detailEmpty}</p>
      )}
    </section>
  );
}
