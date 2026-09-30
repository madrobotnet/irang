import { describe, expect, test } from "bun:test";
import type { AuthModelCatalog } from "@/lib/ai-model-catalog";
import {
  authModelChoices,
  isSelectableAuthModel,
  modelForMode,
  modelForProvider,
  savedModelFor,
} from "./model-choice";

// Fixture catalog: behavior must not depend on the shipped model data.
const catalog: AuthModelCatalog = {
  models: [{ id: "model-c", accountGated: true }, { id: "model-b" }, { id: "model-a" }],
  defaultId: "model-b",
};
const savedAuth = { provider: "xai", mode: "auth", model: "retired-model" } as const;

describe("authModelChoices", () => {
  test("keeps catalog order and annotates the default and account-gated models", () => {
    expect(authModelChoices(catalog, "model-a", null)).toEqual([
      { id: "model-c", note: "account-gated" },
      { id: "model-b", note: "recommended" },
      { id: "model-a", note: null },
    ]);
  });

  test("keeps a retired saved model as the selected first option", () => {
    const choices = authModelChoices(catalog, "retired-model", "retired-model");
    expect(choices[0]).toEqual({ id: "retired-model", note: "saved" });
    expect(choices.map((choice) => choice.id)).toEqual(["retired-model", "model-c", "model-b", "model-a"]);
    expect(authModelChoices(catalog, "stray-model", null)[0]).toEqual({ id: "stray-model", note: "unlisted" });
  });
});

describe("isSelectableAuthModel", () => {
  test("accepts catalog IDs and only the saved ID outside the catalog", () => {
    expect(isSelectableAuthModel(catalog, "model-a", null)).toBe(true);
    expect(isSelectableAuthModel(catalog, "retired-model", "retired-model")).toBe(true);
    expect(isSelectableAuthModel(catalog, "typed-api-model", "retired-model")).toBe(false);
  });

  test("matches the saved ID only for the same provider and mode", () => {
    expect(savedModelFor(savedAuth, "xai", "auth")).toBe("retired-model");
    expect(savedModelFor(savedAuth, "xai", "api")).toBeNull();
    expect(savedModelFor(savedAuth, "openrouter", "auth")).toBeNull();
    expect(savedModelFor({ provider: "typesafe", model: "jev-pinned" }, "typesafe", "api")).toBe("jev-pinned");
  });
});

describe("modelForProvider", () => {
  test("uses the mode default for a new provider and restores that provider's saved model", () => {
    const base = { saved: savedAuth, catalog, apiDefault: "api-default" };
    expect(modelForProvider({ ...base, provider: "openrouter", mode: "auth" })).toBe("model-b");
    expect(modelForProvider({ ...base, provider: "openrouter", mode: "api" })).toBe("api-default");
    expect(modelForProvider({ ...base, provider: "xai", mode: "auth" })).toBe("retired-model");
    expect(modelForProvider({ ...base, provider: "xai", mode: "api" })).toBe("api-default");
  });
});

describe("modelForMode", () => {
  test("free API text never becomes an Auth model, and switching back restores it", () => {
    const toAuth = modelForMode({ provider: "openrouter", model: "typed-api-model" }, "auth", null, catalog);
    expect(toAuth).toEqual({ model: "model-b", otherModeModel: "typed-api-model" });
    const toApi = modelForMode({ provider: "openrouter", ...toAuth }, "api", null, catalog);
    expect(toApi).toEqual({ model: "typed-api-model", otherModeModel: "model-b" });
  });

  test("keeps a listed API model and restores the last Auth choice after a round trip", () => {
    expect(modelForMode({ provider: "openrouter", model: "model-a" }, "auth", null, catalog).model).toBe("model-a");
    const back = modelForMode(
      { provider: "openrouter", model: "typed-api-model", otherModeModel: "model-c" }, "auth", null, catalog,
    );
    expect(back).toEqual({ model: "model-c", otherModeModel: "typed-api-model" });
  });

  test("a retired saved Auth model survives an API round trip without migration", () => {
    const toApi = modelForMode({ provider: "xai", model: "retired-model" }, "api", savedAuth, catalog);
    expect(toApi).toEqual({ model: "retired-model", otherModeModel: "retired-model" });
    const edited = { provider: "xai", model: "grok-typed", otherModeModel: toApi.otherModeModel };
    expect(modelForMode(edited, "auth", savedAuth, catalog)).toEqual({
      model: "retired-model", otherModeModel: "grok-typed",
    });
    expect(modelForMode({ provider: "xai", model: "grok-typed" }, "auth", savedAuth, catalog).model)
      .toBe("retired-model");
  });
});
