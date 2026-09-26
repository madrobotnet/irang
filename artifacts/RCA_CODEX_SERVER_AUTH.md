# Codex cite generation ignored server auth

Tip under test: `9d3f36716fdcccf7e74108f52baebd8e46e65657`.

Oak's probe, `POST /api/chat/threads/:id/messages` inside `second-brain-app`, returned HTTP 502 with `code=codex_failed`. `CODEX_API_KEY` and `OPENAI_API_KEY` were absent. Promote, discard, and the cite-gate 422 path were already fine. This note covers why that 502 happened and what the branch changes.

## Classification

Env-only bug. The generator never opened a Codex CLI auth file, so a host `codex login` session could not be used even if the container could see it. Mounting `auth.json` on the old image still returns 502.

After this branch, the app reads that file. The live probe still needs the file mounted into the container. That mount is the next Oak step, and it does not replace the code change.

## What 502 codex_failed mapped to

`postChatMessage` calls `getCodexGenerator().generate` (`src/server/chat/service.ts` lines 255-265). Any throw that is not already a `CodexFailedError` is wrapped as one. `failureResponse` maps every `CodexFailedError` to HTTP 502 `{ "ok": false, "code": "codex_failed" }` (`src/server/chat/http.ts` lines 43-44). The JSON body does not include the internal reason string. No assistant message is stored.

On `9d3f367`, the reason string was `codex_unconfigured`.

`resolveCodexApiKey` (`src/server/chat/codex.ts` lines 28-32 at that SHA) returned `env.CODEX_API_KEY ?? env.OPENAI_API_KEY`, trimmed, or null. `getCodexGenerator` (lines 141-156) threw `CodexFailedError("codex_unconfigured")` when that value was null. When a key was present, `OpenAiCodexGenerator.complete` (lines 86-101) posted to `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <that key>`. `maybeOrganize` (line 163) used the same env predicate and skipped long-form organize when the key was absent.

Searched the tree at that SHA for `CODEX_API_KEY`, `OPENAI_API_KEY`, `auth.json`, `chatgpt`, and `~/.codex`. The only credential predicate on the generate path was `resolveCodexApiKey`. There is no `~/.codex` read, no device-login client, and no ChatGPT account header.

## Fix

`CodexAuth` is `chatgpt`, `blocked`, or `absent`. `CODEX_API_KEY` and `OPENAI_API_KEY` are not read. An `auth_mode` of `apikey`, or any other non-ChatGPT mode, is `blocked`.

`codexAuthFilePath` (`src/server/chat/codex-auth.ts` lines 39-42) is `$CODEX_HOME/auth.json`, or `~/.codex/auth.json` when `CODEX_HOME` is unset. `loadCodexAuth` (lines 54-66) reads it. `resolveCodexAuth` (lines 44-52) and `authFromFile` (lines 166-189) decide.

1. A present auth file with `auth_mode` `chatgpt` or `chatgptAuthTokens`, or with no `auth_mode`, becomes `chatgpt` when `tokens.access_token` and an account id exist. The account id is `tokens.account_id`, otherwise the `chatgpt_account_id` claim under `https://api.openai.com/auth` in the access token. A ChatGPT file that cannot produce both is `blocked`.
2. A missing file is `absent`, including when `CODEX_API_KEY` or `OPENAI_API_KEY` is set.
3. A file that exists but cannot be parsed, uses another auth mode, or cannot be read (other than ENOENT) is `blocked`.

`getCodexGenerator` (`src/server/chat/codex.ts` lines 25-45) loads that decision on each call. `absent` and `blocked` throw `CodexFailedError`, which is still HTTP 502 `codex_failed`.

A `chatgpt` session posts from `postResponses` (`src/server/chat/codex-auth.ts` lines 288-324) to `$CODEX_CHATGPT_BASE_URL/responses` (default `https://chatgpt.com/backend-api/codex/responses`) with the access token, `chatgpt-account-id`, and `originator: codex_cli_rs`. The body uses the Responses shape (`instructions`, `input`, `store: false`, `stream: true`). The default model is `gpt-5.4-mini` unless `CODEX_MODEL` is set. An access token whose `exp` is within 60 seconds is refreshed by `refreshOnce` (lines 343-390) with `POST https://auth.openai.com/oauth/token` using the Codex CLI OAuth client id, then written back to `auth.json` mode `0600`. One in-process refresh is shared so two turns do not rotate the same refresh token twice. HTTP 401 retries that refresh once.

## What this does not change

`http.ts` still collapses every generation failure to `codex_failed`. Traefik, TypeSafe keys, and the cite-gate 422 path are untouched. `agentIdentity`, `personalAccessToken`, header auth, and Bedrock modes in `auth.json` are not wired. A file in one of those modes is `blocked` and returns 502. Env keys are ignored.

The unit tests stub `fetch`. They do not call OpenAI.

## Next probe for Oak

The running image built from `9d3f367` will keep returning 502 until it is replaced and the auth file is visible to uid 1001 (`nextjs` in the Dockerfile).

1. On a machine with a browser, run `codex login` and confirm `$CODEX_HOME/auth.json` or `~/.codex/auth.json` exists. Do not print the file. If the CLI stored the session in the OS keyring only, `auth.json` will be missing. Log in with file storage, or copy the file the official headless procedure already describes.
2. On the VPS, install the file at `/var/lib/second-brain/codex/auth.json` with mode `0600` and directory mode `0700`, owned by uid 1001 and gid 1001.
3. Mount that directory read-write and set `CODEX_HOME` on the app service. Do not set `CODEX_API_KEY` or `OPENAI_API_KEY`. This build ignores both.

```yaml
environment:
  CODEX_HOME: /codex-home
volumes:
  - /var/lib/second-brain/codex:/codex-home:rw
```

4. Deploy this branch's image. Re-run the same internal `POST /api/chat/threads/:id/messages`. A usable session returns 200 with `citations`. A missing or unreadable file still returns 502 `codex_failed`.
5. If the responses call rejects the model, set `CODEX_MODEL` to the slug `codex` uses for that ChatGPT account and probe again.
