/** Desktop rail width preference; plain module so the server layout can inline the init script. */

export const RAIL_STORAGE_KEY = "sb-rail";

/** In-tab change signal so every subscriber (useSyncExternalStore) re-reads storage. */
export const RAIL_CHANGE_EVENT = "sb-rail-change";

/** Without a stored choice, the rail starts expanded on viewports at least this wide. */
const RAIL_WIDE_QUERY = "(min-width: 1280px)";

/** Runs before hydration: `<html data-rail="open">` when the rail was left expanded, or has no stored choice on a wide screen. */
export const RAIL_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(RAIL_STORAGE_KEY)});if(s==="open"||(s===null&&matchMedia(${JSON.stringify(RAIL_WIDE_QUERY)}).matches))document.documentElement.dataset.rail="open";}catch(e){}})();`;

export function readRailExpanded(): boolean {
  try {
    const stored = window.localStorage.getItem(RAIL_STORAGE_KEY);
    return stored === "open" || (stored === null && window.matchMedia(RAIL_WIDE_QUERY).matches);
  } catch {
    return document.documentElement.dataset.rail === "open";
  }
}

export function writeRailExpanded(expanded: boolean): void {
  if (expanded) document.documentElement.dataset.rail = "open";
  else delete document.documentElement.dataset.rail;
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, expanded ? "open" : "closed");
  } catch {
    // storage unavailable: the data attribute still drives layout for this page view
  }
  window.dispatchEvent(new Event(RAIL_CHANGE_EVENT));
}

export function subscribeRail(onChange: () => void): () => void {
  window.addEventListener(RAIL_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(RAIL_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
