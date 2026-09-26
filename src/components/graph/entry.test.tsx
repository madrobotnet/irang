import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeTop3 } from "@/components/home/HomeTop3";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { GRAPH_COPY } from "@/lib/graph/copy";

describe("graph entry", () => {
  it("keeps graph out of Home Top3", () => {
    const html = renderToStaticMarkup(<HomeTop3 />);
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/inbox"');
    expect(html).toContain('href="/chat"');
    expect(html).not.toContain("/graph");
    expect(html).not.toContain("그래프");
  });

  it("links 그래프 from the more menu", () => {
    const shell = readFileSync(
      fileURLToPath(new URL("../shell/BrainShell.tsx", import.meta.url)),
      "utf8",
    );
    expect(shell).toContain('href="/graph"');
    expect(shell).toContain("그래프");
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
