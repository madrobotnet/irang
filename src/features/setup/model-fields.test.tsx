import { describe, expect, test } from "bun:test";
import { isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AiSettingsView } from "@/lib/ai-settings";
import { chatAuthModels, jevAuthModels } from "@/lib/ai-model-catalog";
import { AiAuthPanel } from "./AiAuthPanel";
import { AuthModelSelect } from "./AuthModelSelect";
import { ChatAiFields } from "./ChatAiFields";
import { ChatModelField } from "./ChatApiFields";
import { JevAiFields } from "./JevAiFields";
import { emptyAiForm, type ChatFormState, type JevFormState } from "./ai-form";

type AnyElement = ReactElement<Record<string, unknown>>;

function findAll(node: ReactNode, match: (element: AnyElement) => boolean): AnyElement[] {
  const found: AnyElement[] = [];
  const visit = (value: ReactNode): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isValidElement<Record<string, unknown>>(value)) return;
    if (match(value)) found.push(value);
    visit(value.props.children as ReactNode);
  };
  visit(node);
  return found;
}

function findOne(node: ReactNode, match: (element: AnyElement) => boolean): AnyElement {
  const [element] = findAll(node, match);
  if (!element) throw new Error("Expected element was not rendered");
  return element;
}

const modeRadio = (mode: "api" | "auth") => (element: AnyElement) =>
  element.type === "input" && element.props.type === "radio" && element.props.value === mode;

function view(input: Pick<AiSettingsView, "chat" | "jev">): AiSettingsView {
  return {
    ...input, profiles: [], chatId: null, jevId: null,
    chatManagedByEnvironment: false, jevManagedByEnvironment: false,
  };
}

function chatTree(chat: ChatFormState, saved: AiSettingsView | null = null) {
  const changes: ChatFormState[] = [];
  const tree = ChatAiFields({
    value: chat, onChangeAction: (next) => changes.push(next), disabled: false, saved,
    errors: {}, idPrefix: "qa",
  });
  return { tree, changes };
}

function jevTree(jev: JevFormState, saved: AiSettingsView | null = null) {
  const changes: JevFormState[] = [];
  const tree = JevAiFields({
    value: jev, onChangeAction: (next) => changes.push(next), disabled: false, saved,
    errors: {}, idPrefix: "qa",
  });
  return { tree, changes };
}

const base = emptyAiForm();
const xaiAuthDefault = chatAuthModels("xai")?.defaultId;
const jevAuthDefault = jevAuthModels("openrouter")?.defaultId;

describe("model field controls", () => {
  test("Auth renders a labelled select with no text input; API keeps free text", () => {
    const auth = renderToStaticMarkup(
      <ChatModelField idPrefix="qa" chat={{ ...base.chat, enabled: true, mode: "auth", provider: "xai", model: "grok-3" }}
        savedAuthModel="grok-3" setChatAction={() => undefined} />,
    );
    expect(auth).toContain('<label for="qa-chat-model"');
    expect(auth).toContain('<select id="qa-chat-model" aria-describedby="qa-chat-model-hint"');
    expect(auth).not.toContain("<input");
    expect(auth).toContain('<option value="grok-3" selected="">');

    const api = renderToStaticMarkup(
      <ChatModelField idPrefix="qa" chat={{ ...base.chat, enabled: true, mode: "api", provider: "xai", model: "grok-private" }}
        savedAuthModel={null} setChatAction={() => undefined} />,
    );
    expect(api).toContain('<input id="qa-chat-model" aria-describedby="qa-chat-model-hint"');
    expect(api).toContain('value="grok-private"');
    expect(api).not.toContain("<select");
  });

  test("Jev Auth has no editable model text; Jev API does", () => {
    const auth = renderToStaticMarkup(jevTree({ ...base.jev, enabled: true, mode: "auth", provider: "openrouter", model: "~typesafe/jev-latest" }).tree);
    expect(auth).toContain('<select id="qa-jev-model"');
    expect(auth).not.toContain('<input id="qa-jev-model"');
    const api = renderToStaticMarkup(jevTree({ ...base.jev, enabled: true, provider: "openrouter", model: "~typesafe/jev-latest" }).tree);
    expect(api).toContain('<input id="qa-jev-model"');
    expect(api).not.toContain('<select id="qa-jev-model"');
  });

  test("errors replace the hint and mark the Auth select invalid", () => {
    const html = renderToStaticMarkup(
      <ChatModelField idPrefix="qa" chat={{ ...base.chat, enabled: true, mode: "auth", provider: "xai", model: "grok-4.7" }}
        savedAuthModel={null} setChatAction={() => undefined} error="목록에서 사용할 모델을 선택해 주세요." />,
    );
    expect(html).toContain('aria-invalid="true" aria-describedby="qa-chat-model-error"');
    expect(html).toContain('id="qa-chat-model-error" role="alert"');
    expect(html).not.toContain('id="qa-chat-model-hint"');
  });
});

describe("chat model switching", () => {
  test("API text is replaced by a listed Auth model and restored when switching back", () => {
    const typed = { ...base.chat, enabled: true, provider: "xai" as const, model: "grok-private", consent: true };
    const toAuth = chatTree(typed);
    (findOne(toAuth.tree, modeRadio("auth")).props.onChange as () => void)();
    const authState = toAuth.changes.at(-1);
    expect(authState).toMatchObject({ mode: "auth", model: xaiAuthDefault, otherModeModel: "grok-private", consent: false });
    if (!authState) throw new Error("Auth switch did not update the form");

    const toApi = chatTree(authState);
    (findOne(toApi.tree, modeRadio("api")).props.onChange as () => void)();
    expect(toApi.changes.at(-1)).toMatchObject({ mode: "api", model: "grok-private", otherModeModel: xaiAuthDefault });
  });

  test("provider switch restores that provider's saved retired model and defaults others", () => {
    const saved = view({ chat: { provider: "xai", mode: "auth", model: "grok-3", hasApiKey: false, hasCredential: true }, jev: null });
    const current = { ...base.chat, enabled: true, mode: "auth" as const, provider: "openrouter" as const, model: "openai/gpt-6-sol" };
    const select = (value: string) => {
      const { tree, changes } = chatTree(current, saved);
      const provider = findOne(tree, (element) => element.type === "select" && element.props.id === "qa-chat-provider");
      (provider.props.onChange as (event: Pick<ChangeEvent<HTMLSelectElement>, "target">) => void)({
        target: { value } as HTMLSelectElement,
      });
      return changes.at(-1);
    };
    expect(select("xai")).toMatchObject({ provider: "xai", mode: "auth", model: "grok-3", otherModeModel: undefined });
    expect(select("github-copilot")).toMatchObject({ mode: "auth", model: chatAuthModels("github-copilot")?.defaultId });
    expect(select("anthropic")).toMatchObject({ mode: "api", model: "claude-sonnet-5-5" });
  });

  test("choosing a model keeps a ready Auth attempt and the login panel identity", () => {
    const attempt = "44444444-4444-4444-8444-444444444444";
    const chat = { ...base.chat, enabled: true, mode: "auth" as const, provider: "xai" as const, model: "grok-4.7", authAttemptId: attempt, consent: true };
    const before = chatTree(chat);
    const field = findOne(before.tree, (element) => element.type === ChatModelField);
    const fieldTree = ChatModelField(field.props as Parameters<typeof ChatModelField>[0]);
    const select = findOne(fieldTree, (element) => element.type === AuthModelSelect);
    (select.props.onChangeAction as (model: string) => void)("grok-4.5");
    const next = before.changes.at(-1);
    expect(next).toMatchObject({ model: "grok-4.5", authAttemptId: attempt, consent: true, mode: "auth" });
    if (!next) throw new Error("Model selection did not update the form");

    const panelKey = (tree: ReactNode) => findOne(tree, (element) => element.type === AiAuthPanel).key;
    expect(panelKey(chatTree(next).tree)).toBe(panelKey(before.tree));
  });
});

test.each(["openai", "google"] as const)("%s Auth renders the shared login panel beside the model select", (provider) => {
  const model = chatAuthModels(provider)?.defaultId ?? "";
  const { tree } = chatTree({ ...base.chat, enabled: true, mode: "auth", provider, model, consent: true });
  expect(findOne(tree, (element) => element.type === AiAuthPanel).props.provider).toBe(provider);
  expect(findOne(tree, (element) => element.type === ChatModelField).props.chat).toMatchObject({ mode: "auth", model });
});

describe("Jev model switching", () => {
  test("OpenRouter Auth selects a listed Jev model and API restores typed text", () => {
    const typed = { ...base.jev, enabled: true, provider: "openrouter" as const, model: "~typesafe/jev-custom", consent: true };
    const toAuth = jevTree(typed);
    (findOne(toAuth.tree, modeRadio("auth")).props.onChange as () => void)();
    const authState = toAuth.changes.at(-1);
    expect(authState).toMatchObject({ mode: "auth", model: jevAuthDefault, otherModeModel: "~typesafe/jev-custom" });
    if (!authState) throw new Error("Jev Auth switch did not update the form");

    const toApi = jevTree(authState);
    (findOne(toApi.tree, modeRadio("api")).props.onChange as () => void)();
    expect(toApi.changes.at(-1)).toMatchObject({ mode: "api", model: "~typesafe/jev-custom" });
  });

  test("a saved retired Jev Auth model stays selected", () => {
    const saved = view({ chat: null, jev: { provider: "openrouter", mode: "auth", model: "~typesafe/jev-1.0", hasApiKey: false, hasCredential: true } });
    const html = renderToStaticMarkup(jevTree({
      ...base.jev, enabled: true, mode: "auth", provider: "openrouter", model: "~typesafe/jev-1.0", consent: true,
    }, saved).tree);
    expect(html).toContain('<option value="~typesafe/jev-1.0" selected="">');
  });
});
