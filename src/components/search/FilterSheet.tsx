import type { SearchStatusFilter } from "@/lib/search/parse";
import type { SearchFilters } from "./search-state";
import { SEARCH_COPY } from "./copy";
import styles from "./SearchScreen.module.css";

type FilterSheetProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onApply: () => void;
};

export function FilterSheet({ filters, onChange, onApply }: FilterSheetProps) {
  return (
    <div id="search-filters" className={styles.filters}>
      <label className={styles.filterField}>
        <span>{SEARCH_COPY.filterType}</span>
        <select
          className={styles.control}
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as SearchStatusFilter | "",
            })
          }
        >
          <option value="">{SEARCH_COPY.filterAll}</option>
          <option value="draft">{SEARCH_COPY.filterDraft}</option>
          <option value="confirmed">{SEARCH_COPY.filterConfirmed}</option>
          <option value="archived">{SEARCH_COPY.filterArchived}</option>
        </select>
      </label>
      <label className={styles.filterField}>
        <span>{SEARCH_COPY.filterFrom}</span>
        <input
          className={styles.control}
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>
      <label className={styles.filterField}>
        <span>{SEARCH_COPY.filterTo}</span>
        <input
          className={styles.control}
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>
      <button type="button" className={styles.filterApply} onClick={onApply}>
        {SEARCH_COPY.filterApply}
      </button>
    </div>
  );
}
