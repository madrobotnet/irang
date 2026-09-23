import { CodexFailedError } from "./errors";

export type CodexTurnRequest = {
  route: "answer" | "propose_edit";
  question: string;
  notes: Array<{ noteId: string; title: string; excerpt: string }>;
};

export type CodexTurnResult = {
  text: string;
  proposal: { title: string; body: string } | null;
};

export type CodexGenerator = {
  generate(input: CodexTurnRequest): Promise<CodexTurnResult>;
  organize?(input: { title: string; body: string }): Promise<{ title: string; body: string }>;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1";

let override: CodexGenerator | null = null;

export function setCodexGeneratorForTests(next: CodexGenerator | null): void {
  override = next;
}

export function resolveCodexApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.CODEX_API_KEY ?? env.OPENAI_API_KEY ?? "";
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseProposalDraft(raw: string): { message: string; title: string; body: string } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const row = value as Record<string, unknown>;
    if (typeof row.message !== "string" || typeof row.title !== "string" || typeof row.body !== "string") {
      return null;
    }
    const message = row.message.trim();
    const title = row.title.trim();
    const body = row.body.trim();
    if (!message || !title || !body) {
      return null;
    }
    return { message, title, body };
  } catch {
    return null;
  }
}

function notesBlock(notes: CodexTurnRequest["notes"]): string {
  return notes
    .map((note) => [`noteId: ${note.noteId}`, note.title, note.excerpt].filter((line) => line.length > 0).join("\n"))
    .join("\n\n");
}

function readCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new CodexFailedError("codex_response");
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length < 1) {
    throw new CodexFailedError("codex_response");
  }
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new CodexFailedError("codex_empty");
  }
  return content;
}

class OpenAiCodexGenerator implements CodexGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private async complete(system: string, user: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) {
      throw new CodexFailedError("codex_http");
    }
    return readCompletionText((await response.json()) as unknown);
  }

  async generate(input: CodexTurnRequest): Promise<CodexTurnResult> {
    const notes = notesBlock(input.notes);
    if (input.route === "propose_edit") {
      const raw = await this.complete(
        "You draft a note edit for a person to approve. Reply with JSON only: {\"message\":\"short explanation\",\"title\":\"proposed title\",\"body\":\"proposed body\"}. Use only the supplied notes. Do not claim the edit is already saved.",
        `Question:\n${input.question}\n\nNotes:\n${notes}`,
      );
      const draft = parseProposalDraft(raw);
      if (!draft) {
        throw new CodexFailedError("codex_proposal");
      }
      return { text: draft.message, proposal: { title: draft.title, body: draft.body } };
    }
    const text = await this.complete(
      "Answer the question using only the supplied notes. Do not invent note ids. If the notes do not contain the answer, say so.",
      `Question:\n${input.question}\n\nNotes:\n${notes}`,
    );
    return { text: text.trim(), proposal: null };
  }

  async organize(input: { title: string; body: string }): Promise<{ title: string; body: string }> {
    const raw = await this.complete(
      "Rewrite the note so it is easier to scan. Reply with JSON only: {\"message\":\"ignored\",\"title\":\"title\",\"body\":\"rewritten body\"}. Do not drop facts.",
      `Title:\n${input.title}\n\nBody:\n${input.body}`,
    );
    const draft = parseProposalDraft(raw);
    if (!draft) {
      throw new CodexFailedError("codex_proposal");
    }
    return { title: draft.title, body: draft.body };
  }
}

export function getCodexGenerator(): CodexGenerator {
  if (override) {
    return override;
  }
  const apiKey = resolveCodexApiKey();
  if (!apiKey) {
    return {
      async generate(): Promise<CodexTurnResult> {
        throw new CodexFailedError("codex_unconfigured");
      },
    };
  }
  const baseUrl = (process.env.CODEX_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.CODEX_MODEL?.trim() || DEFAULT_MODEL;
  return new OpenAiCodexGenerator(apiKey, baseUrl, model);
}

/** Long-form organize draft. Null when Codex auth is not configured. */
export async function maybeOrganize(input: {
  title: string;
  body: string;
}): Promise<{ title: string; body: string } | null> {
  if (!override && !resolveCodexApiKey()) {
    return null;
  }
  const generator = getCodexGenerator();
  if (!generator.organize) {
    return null;
  }
  return generator.organize(input);
}
