import {
  generateCodexTurn,
  loadCodexAuth,
  organizeCodexNote,
  parseProposalDraft,
  type CodexAuth,
  type CodexTurnRequest,
  type CodexTurnResult,
} from "./codex-auth";

export type { CodexTurnRequest, CodexTurnResult };
export { parseProposalDraft };

export type CodexGenerator = {
  generate(input: CodexTurnRequest): Promise<CodexTurnResult>;
  organize?(input: { title: string; body: string }): Promise<{ title: string; body: string }>;
};

let override: CodexGenerator | null = null;

export function setCodexGeneratorForTests(next: CodexGenerator | null): void {
  override = next;
}

export function getCodexGenerator(): CodexGenerator {
  if (override) {
    return override;
  }
  return {
    async generate(input) {
      const auth = await loadCodexAuth();
      return generateCodexTurn({ auth, request: input, fetchImpl: fetch, env: process.env });
    },
    async organize(input) {
      const auth = await loadCodexAuth();
      return organizeCodexNote({
        auth,
        title: input.title,
        body: input.body,
        fetchImpl: fetch,
        env: process.env,
      });
    },
  };
}

export async function maybeOrganize(input: {
  title: string;
  body: string;
}): Promise<{ title: string; body: string } | null> {
  if (!override && !(await codexConfigured())) {
    return null;
  }
  const generator = getCodexGenerator();
  if (!generator.organize) {
    return null;
  }
  return generator.organize(input);
}

async function codexConfigured(): Promise<boolean> {
  const auth: CodexAuth = await loadCodexAuth();
  return auth.kind === "chatgpt";
}
