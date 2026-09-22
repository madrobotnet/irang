import type { FormEvent } from "react";
import type { JevUiState } from "@/lib/jev/jev-state";
import { JevBadge } from "@/components/jev/JevBadge";
import { SEARCH_COPY } from "./copy";
import styles from "./SearchScreen.module.css";

type SearchBarProps = {
  draft: string;
  badge: JevUiState;
  showOn: boolean;
  filtersOpen: boolean;
  filtersActive: boolean;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onToggleFilters: () => void;
};

export function SearchBar({
  draft,
  badge,
  showOn,
  filtersOpen,
  filtersActive,
  onDraft,
  onSubmit,
  onToggleFilters,
}: SearchBarProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.bar} onSubmit={submit} role="search">
      <input
        id="search-q"
        className={styles.input}
        type="search"
        name="query"
        value={draft}
        placeholder={SEARCH_COPY.placeholder}
        aria-label={SEARCH_COPY.placeholder}
        autoComplete="off"
        onChange={(event) => onDraft(event.target.value)}
      />
      <button type="submit" className={styles.submit}>
        {SEARCH_COPY.submit}
      </button>
      <button
        type="button"
        className={filtersActive ? styles.filterActive : styles.filter}
        aria-expanded={filtersOpen}
        aria-controls="search-filters"
        onClick={onToggleFilters}
      >
        {SEARCH_COPY.filter}
      </button>
      <div className={styles.jev} data-jev-on={showOn ? "true" : "false"}>
        <JevBadge state={badge} />
        {showOn ? <span className={styles.onWord}>· {SEARCH_COPY.on}</span> : null}
      </div>
    </form>
  );
}
