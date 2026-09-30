import { describe, expect, spyOn, test } from "bun:test";
import { CompletionContext, type Completion, type CompletionResult } from "@codemirror/autocomplete";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { NoteTitleMatch } from "@/lib/types";
import { isComposing, wikiLinkEnv, wikiLinkInsertion, wikiLinkSource, type FetchTitles } from "./wikilink-autocomplete";
import { closingBracketsAfter, linkNameKey, OPEN_WIKILINK, wikiLinkOptions } from "./wikilink-completion";

const basil: NoteTitleMatch = { id: "n1", title: "바질", matchedAlias: null };
const basilAlias: NoteTitleMatch = { id: "n1", title: "바질", matchedAlias: "Basil" };
const pesto: NoteTitleMatch = { id: "n2", title: "바질 페스토", matchedAlias: null };

describe("wikiLinkOptions", () => {
  test("title matches insert the title and alias matches insert Title|Alias", () => {
    expect(wikiLinkOptions([basilAlias, pesto], "basil")).toEqual([
      { kind: "alias", noteId: "n1", label: "Basil", title: "바질", insert: "바질|Basil" },
      { kind: "title", noteId: "n2", label: "바질 페스토", insert: "바질 페스토" },
    ]);
  });

  test("an exact title or alias match suppresses the create row, ignoring case and spacing", () => {
    expect(wikiLinkOptions([basil, pesto], " 바질 ").map((option) => option.kind)).toEqual(["title", "title"]);
    expect(wikiLinkOptions([basilAlias], "BASIL").map((option) => option.kind)).toEqual(["alias"]);
    expect(linkNameKey("  Basil   Pesto ")).toBe(linkNameKey("basil pesto"));
  });

  test("the create row comes last with the trimmed typed text", () => {
    expect(wikiLinkOptions([pesto], "바질 ").at(-1)).toEqual({ kind: "create", title: "바질", insert: "바질" });
    expect(wikiLinkOptions([], "새 아이디어")).toEqual([{ kind: "create", title: "새 아이디어", insert: "새 아이디어" }]);
  });

  test("no create row for empty or link-unsafe text", () => {
    expect(wikiLinkOptions([basil], "  ")).toEqual([{ kind: "title", noteId: "n1", label: "바질", insert: "바질" }]);
    expect(wikiLinkOptions([], "a|b")).toEqual([]);
  });

  test("an alias of a title that cannot be a link target inserts the alias alone", () => {
    const unsafe: NoteTitleMatch = { id: "n3", title: "C# notes", matchedAlias: "csharp" };
    expect(wikiLinkOptions([unsafe], "csh")[0]).toEqual({ kind: "alias", noteId: "n3", label: "csharp", title: "C# notes", insert: "csharp" });
  });

  test("a note listed twice appears once", () => {
    expect(wikiLinkOptions([basil, basil], "바").filter((option) => option.kind === "title")).toHaveLength(1);
  });
});

describe("wikilink positions", () => {
  test("OPEN_WIKILINK matches only an unfinished target", () => {
    expect(OPEN_WIKILINK.exec("see [[바질")?.[0]).toBe("[[바질");
    expect(OPEN_WIKILINK.test("see [[바질]] and")).toBe(false);
    expect(OPEN_WIKILINK.test("[[바질|표시")).toBe(false);
  });

  test("closeBrackets' ]] after the cursor is replaced, anything else is kept", () => {
    expect(closingBracketsAfter("]] rest")).toBe(2);
    expect(closingBracketsAfter("] rest")).toBe(0);
    expect(closingBracketsAfter("")).toBe(0);
  });
});

function stateAt(doc: string) {
  const cursor = doc.indexOf("¦");
  return EditorState.create({
    doc: doc.replace("¦", ""),
    selection: EditorSelection.cursor(cursor),
    extensions: wikiLinkEnv.of({ createLabel: (title) => `create:${title}`, onCreate: () => {} }),
  });
}

const fakeView = (composing: boolean) => ({ composing, compositionStarted: composing }) as unknown as EditorView;

async function complete(doc: string, fetchTitles: FetchTitles, options: { explicit?: boolean; view?: EditorView } = {}) {
  const state = stateAt(doc);
  const context = new CompletionContext(state, state.selection.main.head, options.explicit ?? false, options.view);
  return { state, result: (await wikiLinkSource(fetchTitles)(context)) as CompletionResult | null };
}

describe("wikiLinkSource", () => {
  test("queries the trimmed text and lists alias and create rows unfiltered", async () => {
    const queries: string[] = [];
    const { result } = await complete("메모 [[bas ¦]]", async (query) => { queries.push(query); return [basilAlias]; });
    expect(queries).toEqual(["bas"]);
    expect(result?.from).toBe("메모 [[".length);
    expect(result?.filter).toBe(false);
    expect(result?.options.map((option) => [option.label, option.detail ?? null, option.type])).toEqual([
      ["Basil", "→ 바질", "wiki-alias"],
      ["create:bas", null, "wiki-create"],
    ]);
  });

  test("stays closed during IME composition, outside [[ and for an empty implicit query", async () => {
    const fetchTitles: FetchTitles = async () => { throw new Error("must not query"); };
    expect((await complete("[[바¦", fetchTitles, { view: fakeView(true) })).result).toBeNull();
    expect((await complete("바질 ¦", fetchTitles)).result).toBeNull();
    expect((await complete("[[¦", fetchTitles)).result).toBeNull();
  });

  test("a failed lookup still offers the create row", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { result } = await complete("[[바질¦", async () => { throw new Error("offline"); });
      expect(result?.options.map((option) => option.type)).toEqual(["wiki-create"]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  test("isComposing reads both CodeMirror composition flags", () => {
    expect(isComposing(fakeView(true))).toBe(true);
    expect(isComposing(fakeView(false))).toBe(false);
    expect(isComposing(undefined)).toBe(false);
  });
});

describe("wikiLinkInsertion", () => {
  const completion: Completion = { label: "x" };
  const insert = (doc: string, body: string) => {
    const state = stateAt(doc);
    const head = state.selection.main.head;
    const from = head - (OPEN_WIKILINK.exec(state.sliceDoc(0, head))?.[0].length ?? 0) + 2;
    const next = state.update(wikiLinkInsertion(state, completion, body, from, head)).state;
    return { doc: next.doc.toString(), cursor: next.selection.main.head };
  };

  test("consumes the ]] closeBrackets already added", () => {
    expect(insert("a [[bas¦]] b", "바질|Basil")).toEqual({ doc: "a [[바질|Basil]] b", cursor: "a [[바질|Basil]]".length });
  });

  test("closes the link when nothing follows", () => {
    expect(insert("[[새 아이¦", "새 아이디어")).toEqual({ doc: "[[새 아이디어]]", cursor: "[[새 아이디어]]".length });
  });
});
