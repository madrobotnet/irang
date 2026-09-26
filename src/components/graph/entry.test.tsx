import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { GRAPH_COPY } from "@/lib/graph/copy";

describe("graph entry", () => {
  it("links 관계 from desk rail nav", () => {
    const nav = readFileSync(
      fileURLToPath(new URL("../shell/desk-nav.ts", import.meta.url)),
      "utf8",
    );
    expect(nav).toContain('href: "/graph"');
    expect(nav).toContain('label: "관계"');
  });

  it("opens the current note in the graph from the notes editor", () => {
    const html = renderToStaticMarkup(
      <NoteEditor
        note={{
          id: "note-9",
          title: "시드",
          body: "본문",
          status: "draft",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
          purgeAt: null,
        }}
        draftTitle="시드"
        draftBody="본문"
        dirty={false}
        saving={false}
        trashed={false}
        onChangeTitle={() => undefined}
        onChangeBody={() => undefined}
        onSave={() => undefined}
        onTrash={() => undefined}
      />,
    );
    expect(html).toContain(GRAPH_COPY.openInGraph);
    expect(html).toContain('href="/graph?seedId=note-9"');
  });
});
