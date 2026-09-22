import { SEARCH_COPY } from "./copy";
import type { RouteTarget } from "./search-state";
import styles from "./SearchScreen.module.css";

const ROUTE_LABEL: Record<RouteTarget, string> = {
  chat: SEARCH_COPY.routeChat,
  search: SEARCH_COPY.routeSearch,
  inbox: SEARCH_COPY.routeInbox,
};

type RouteHintProps = {
  target: RouteTarget;
};

/** Soft hint. Render only when a routing judgment is already present. */
export function RouteHint({ target }: RouteHintProps) {
  return (
    <p className={styles.route} data-route-hint={target}>
      {SEARCH_COPY.routeLead} → {ROUTE_LABEL[target]}
    </p>
  );
}
