import { expect, test } from "bun:test";
import { chatAuthModels, jevAuthModels, type AuthModelCatalog } from "./ai-model-catalog";
import { ModelSchema } from "./ai-provider-options";
import { AI_PROVIDERS, isCustomProvider, JEV_PROVIDERS } from "./ai-providers";

function expectUsableCatalog(catalog: AuthModelCatalog | null): void {
  if (!catalog) throw new Error("Every Auth-capable provider needs an Auth model list");
  const ids = catalog.models.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain(catalog.defaultId);
  for (const id of ids) expect(ModelSchema.parse(id)).toBe(id);
}

test.each(AI_PROVIDERS.map((provider) => [provider.id, provider] as const))(
  "chat provider %s has an Auth list exactly when it supports Auth",
  (_id, provider) => {
    if (provider.supportsAuth) expectUsableCatalog(chatAuthModels(provider.id));
    else expect(chatAuthModels(provider.id)).toBeNull();
  },
);

test.each(JEV_PROVIDERS.map((provider) => [provider.id, provider] as const))(
  "Jev provider %s has an Auth list exactly when it supports Auth",
  (_id, provider) => {
    if (provider.supportsAuth) expectUsableCatalog(jevAuthModels(provider.id));
    else expect(jevAuthModels(provider.id)).toBeNull();
  },
);

test("API defaults are valid model IDs, and custom endpoints have no universal default", () => {
  for (const provider of [...AI_PROVIDERS, ...JEV_PROVIDERS]) {
    if (provider.id === "openai-compatible" || provider.id === "anthropic-compatible") {
      expect(isCustomProvider(provider.id)).toBe(true);
      expect(provider.model).toBe("");
    } else {
      expect(ModelSchema.parse(provider.model)).toBe(provider.model);
    }
  }
});
