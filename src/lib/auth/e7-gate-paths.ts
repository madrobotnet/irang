export const E7_GRAPH_PAGE_PATH = "/graph" as const;
export const E7_GRAPH_API_PATH = "/api/graph" as const;
export const E7_LINKS_API_PATH = "/api/links" as const;

export const E7_PROTECTED_PAGE_ROUTES = [E7_GRAPH_PAGE_PATH] as const;

export const E7_PROTECTED_API_ROUTES = [
  E7_GRAPH_API_PATH,
  E7_LINKS_API_PATH,
  "/api/links/link-id",
] as const;
