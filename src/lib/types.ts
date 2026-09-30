import type { LocalizedText } from "./i18n/locale";

/** Shared wire types (API responses). Server modules map DB rows into these. */

export type NoteSummary = {
  id: string;
  title: string;
  /** First ~200 chars of the body as plain text (markdown stripped). */
  excerpt: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  dailyDate: string | null; // YYYY-MM-DD
  updatedAt: string; // ISO
  createdAt: string; // ISO
};

export type Note = NoteSummary & {
  body: string; // markdown
  aliases: string[];
  sourceUrl: string | null;
  deletedAt: string | null;
};

export type NoteRef = { id: string; title: string };

export type LinkContext = NoteRef & {
  /** The line/paragraph around the reference, plain text, <= 240 chars. */
  context: string;
};

export type NoteLinks = {
  outgoing: NoteRef[];
  backlinks: LinkContext[];
  /** [[targets]] in this note that match no existing note. */
  unresolved: string[];
  /** Notes whose body mentions this note's title/aliases as plain text (not linked). */
  unlinkedMentions: LinkContext[];
};

export type RelatedNote = NoteRef & { excerpt: string; score: number };

export type TagCount = { tag: string; count: number };

export type InboxSource = "web" | "url" | "share" | "api";

export type InboxSuggestions = {
  status: "ready" | "unavailable" | "failed";
  tags: { tag: string; probability: number }[];
  kind: { choice: string; confidence: number } | null;
  duplicateOf: { noteId: string; title: string; probability: number } | null;
};

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  source: InboxSource;
  url: string | null;
  createdAt: string;
  suggestions: InboxSuggestions | null;
};

export type SearchMatch = "keyword" | "fuzzy" | "semantic";

export type SearchHit = {
  noteId: string;
  title: string;
  /** Plain-text snippet around the best match, <= 220 chars. */
  snippet: string;
  tags: string[];
  updatedAt: string;
  score: number;
  matchedBy: SearchMatch[];
};

export type SearchResponse = { query: string; hits: SearchHit[]; tookMs: number };

export type GraphNodeKind = "note" | "tag" | "unresolved";

export type GraphNode = {
  id: string; // note id, "tag:<name>", or "ghost:<title>"
  kind: GraphNodeKind;
  label: string;
  tags: string[];
  degree: number;
  updatedAt: string | null;
};

export type GraphLinkKind = "link" | "tag" | "unresolved";

export type GraphLink = { source: string; target: string; kind: GraphLinkKind };

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
  focusId: string | null;
  truncated: boolean;
};

export type ChatThread = { id: string; title: string; updatedAt: string; createdAt: string };

export type Citation = { index: number; noteId: string; title: string; excerpt: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

export type HomeData = {
  inboxCount: number;
  inboxPreview: InboxItem[];
  daily: NoteSummary | null;
  pinned: NoteSummary[];
  recent: NoteSummary[];
  /** Older notes worth revisiting (not updated in 14+ days), random but stable per day. */
  resurface: NoteSummary[];
  stats: { notes: number; links: number; tags: number };
};

export type ApiErrorBody = { error: { code: string; message: string; localized?: LocalizedText; retryAfterSeconds?: number } };
