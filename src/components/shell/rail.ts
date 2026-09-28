/** Desktop rail width preference; plain module so the server layout can inline the init script. */

export const RAIL_STORAGE_KEY = "sb-rail";

/** In-tab change signal so every subscriber (useSyncExternalStore) re-reads storage. */
export const RAIL_CHANGE_EVENT = "sb-rail-change";

/** Runs before hydration: `<html data-rail="open">` when the rail was left expanded. */
export const RAIL_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(RAIL_STORAGE_KEY)})==="open")document.documentElement.dataset.rail="open";}catch(e){}})();`;

export function readRailExpanded(): boolean {
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === "open";
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
