import {
  autocompletion, completionKeymap, insertCompletionText, pickedCompletion, startCompletion,
  type Completion, type CompletionSource,
} from "@codemirror/autocomplete";
import { Facet, Prec, type EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import type { NoteTitleMatch } from "@/lib/types";
import { closingBracketsAfter, OPEN_WIKILINK, wikiLinkOptions, type WikiLinkOption } from "./wikilink-completion";

export type WikiLinkEnv = {
  createLabel: (title: string) => string;
  onCreate: (title: string) => void;
};

export const wikiLinkEnv = Facet.define<WikiLinkEnv, WikiLinkEnv | null>({ combine: (values) => values[0] ?? null });

export type FetchTitles = (query: string, signal: AbortSignal) => Promise<readonly NoteTitleMatch[]>;

type WikiLinkCompletion = Completion & { type: `wiki-${WikiLinkOption["kind"]}` };

/** Completion never opens or accepts while an IME composition (Korean syllable) is in progress. */
export function isComposing(view: EditorView | undefined): boolean {
  return view !== undefined && (view.composing || view.compositionStarted);
}

export function wikiLinkInsertion(state: EditorState, completion: Completion, insert: string, from: number, to: number): TransactionSpec {
  const end = to + closingBracketsAfter(state.sliceDoc(to, to + 2));
  return { ...insertCompletionText(state, `${insert}]]`, from, end), annotations: pickedCompletion.of(completion) };
}

function toCompletion(option: WikiLinkOption, env: WikiLinkEnv | null): WikiLinkCompletion {
  const apply = (view: EditorView, completion: Completion, from: number, to: number) => {
    view.dispatch(wikiLinkInsertion(view.state, completion, option.insert, from, to));
    if (option.kind === "create") view.state.facet(wikiLinkEnv)?.onCreate(option.title);
  };
  switch (option.kind) {
    case "title":
      return { label: option.label, type: "wiki-title", apply };
    case "alias":
      return { label: option.label, detail: `→ ${option.title}`, type: "wiki-alias", apply };
    case "create":
      return { label: env?.createLabel(option.title) ?? option.title, type: "wiki-create", apply };
  }
}

export function wikiLinkSource(fetchTitles: FetchTitles): CompletionSource {
  return async (context) => {
    if (isComposing(context.view)) return null;
    const before = context.matchBefore(OPEN_WIKILINK);
    if (!before) return null;
    const typed = before.text.slice(2);
    if (!context.explicit && !typed.trim()) return null;
    const controller = new AbortController();
    context.addEventListener("abort", () => controller.abort(), { onDocChange: true });
    let matches: readonly NoteTitleMatch[] = [];
    try {
      matches = await fetchTitles(typed.trim(), controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return null;
      // A failed lookup still offers the create row; creating goes through get-or-create, so it cannot duplicate.
      console.warn("Note title lookup failed", error);
    }
    const env = context.state.facet(wikiLinkEnv);
    return { from: before.from + 2, filter: false, options: wikiLinkOptions(matches, typed).map((option) => toCompletion(option, env)) };
  };
}

const composingSafeKeymap: readonly KeyBinding[] = completionKeymap.map((binding) => {
  const run = binding.run;
  return run ? { ...binding, run: (view: EditorView) => !isComposing(view) && run(view) } : binding;
});

/** The source declines mid-composition; reopen the list once the syllable is committed inside `[[`. */
const reopenAfterComposition = EditorView.domEventHandlers({
  compositionend(_event, view) {
    // Deferred like CodeMirror's own restart: Safari fires compositionend inside an update, and a
    // Korean IME starts the next syllable's composition in the same task.
    window.setTimeout(() => {
      if (isComposing(view)) return;
      const head = view.state.selection.main.head;
      const line = view.state.doc.lineAt(head);
      if (OPEN_WIKILINK.test(line.text.slice(0, head - line.from))) startCompletion(view);
    }, 0);
    return false;
  },
});

// Lucide icon paths (ISC): file-text, corner-down-right, plus.
const ICON_PATHS: Record<WikiLinkCompletion["type"], readonly string[]> = {
  "wiki-title": [
    "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
    "M14 2v5a1 1 0 0 0 1 1h5", "M10 9H8", "M16 13H8", "M16 17H8",
  ],
  "wiki-alias": ["m15 10 5 5-5 5", "M4 4v7a4 4 0 0 0 4 4h12"],
  "wiki-create": ["M5 12h14", "M12 5v14"],
};
const SVG_NS = "http://www.w3.org/2000/svg";

function renderIcon(completion: Completion): Node | null {
  const paths = ICON_PATHS[completion.type as WikiLinkCompletion["type"]];
  if (!paths) return null;
  const svg = document.createElementNS(SVG_NS, "svg");
  const attributes = { class: "cm-wikiIcon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

const LIST = "&.cm-editor .cm-tooltip.cm-tooltip-autocomplete";
const completionTheme = EditorView.theme({
  [LIST]: { backgroundColor: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: "var(--radius-ctl)", boxShadow: "var(--elev-pop)", padding: "0.25rem", overflow: "hidden" },
  [`${LIST} > ul`]: { fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", lineHeight: "var(--text-base--line-height)", minWidth: "15rem", maxWidth: "min(28rem, calc(100vw - 2rem))", maxHeight: "18rem" },
  [`${LIST} > ul > li`]: { display: "flex", alignItems: "center", gap: "0.5rem", minHeight: "2.25rem", padding: "0.375rem 0.5rem", borderRadius: "calc(var(--radius-ctl) - 2px)" },
  [`${LIST} > ul > li[aria-selected]`]: { backgroundColor: "var(--accent-soft)", color: "var(--ink)" },
  [`&.cm-editor .cm-tooltip-autocomplete-disabled > ul > li[aria-selected]`]: { backgroundColor: "var(--desk)" },
  [`${LIST} .cm-completionLabel`]: { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" },
  [`${LIST} .cm-completionDetail`]: { marginLeft: "auto", paddingLeft: "0.75rem", flexShrink: "0", maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "normal", fontSize: "var(--text-sm)", color: "var(--mute)" },
  [`${LIST} .cm-wikiIcon`]: { width: "1rem", height: "1rem", flexShrink: "0", color: "var(--mute)" },
  [`${LIST} .cm-wikiCreate`]: { color: "var(--accent)", fontWeight: "500" },
  [`${LIST} .cm-wikiCreate .cm-wikiIcon`]: { color: "currentColor" },
  // Inside an @-block style-mod scopes plain selectors; [role] keeps this as specific as the rule it overrides.
  "@media (pointer: coarse)": { ".cm-tooltip.cm-tooltip-autocomplete > ul > li[role=option]": { minHeight: "2.75rem" } },
});

export function wikiLinkCompletion(fetchTitles: FetchTitles): Extension[] {
  return [
    autocompletion({
      override: [wikiLinkSource(fetchTitles)],
      defaultKeymap: false,
      icons: false,
      addToOptions: [{ render: renderIcon, position: 20 }],
      optionClass: (completion) => (completion.type === "wiki-create" ? "cm-wikiCreate" : ""),
    }),
    Prec.highest(keymap.of(composingSafeKeymap)),
    reopenAfterComposition,
    Prec.highest(completionTheme),
  ];
}
