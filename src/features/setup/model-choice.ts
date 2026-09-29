import type { AuthModelCatalog } from "@/lib/ai-model-catalog";

export type ConnectionMode = "api" | "auth";

/** Redacted saved metadata; enough to restore a persisted model ID without migrating it. */
export type SavedModelRef = {
  readonly provider: string;
  readonly mode?: ConnectionMode;
  readonly model: string;
} | null;

export function savedModelFor(saved: SavedModelRef, provider: string, mode: ConnectionMode): string | null {
  return saved && saved.provider === provider && (saved.mode ?? "api") === mode ? saved.model : null;
}

/** Auth accepts catalog IDs and the unchanged saved ID, even after the provider retires it. */
export function isSelectableAuthModel(
  catalog: AuthModelCatalog,
  model: string,
  savedAuthModel: string | null,
): boolean {
  return model === savedAuthModel || catalog.models.some((entry) => entry.id === model);
}

export type AuthModelChoice = {
  readonly id: string;
  readonly note: "recommended" | "account-gated" | "saved" | "unlisted" | null;
};

/**
 * Options for an Auth model select. A current value outside the catalog stays
 * first, so the select never displays a different model than it submits.
 */
export function authModelChoices(
  catalog: AuthModelCatalog,
  current: string,
  savedAuthModel: string | null,
): readonly AuthModelChoice[] {
  const listed = catalog.models.map((entry): AuthModelChoice => ({
    id: entry.id,
    note: entry.id === catalog.defaultId ? "recommended" : entry.accountGated ? "account-gated" : null,
  }));
  if (!current || catalog.models.some((entry) => entry.id === current)) return listed;
  return [{ id: current, note: current === savedAuthModel ? "saved" : "unlisted" }, ...listed];
}

/** Model for a newly chosen provider: its saved ID for that mode, else the mode's default. */
export function modelForProvider(input: {
  readonly provider: string;
  readonly mode: ConnectionMode;
  readonly saved: SavedModelRef;
  readonly catalog: AuthModelCatalog | null;
  readonly apiDefault: string;
}): string {
  return savedModelFor(input.saved, input.provider, input.mode)
    ?? (input.mode === "auth" && input.catalog ? input.catalog.defaultId : input.apiDefault);
}

/**
 * Model after an API/Auth switch on the same provider. The outgoing ID is kept in
 * `otherModeModel` so switching back restores it. Auth adopts only a selectable ID,
 * so free API text never becomes an Auth model without a choice from the list.
 */
export function modelForMode(
  draft: { readonly provider: string; readonly model: string; readonly otherModeModel?: string },
  mode: ConnectionMode,
  saved: SavedModelRef,
  catalog: AuthModelCatalog | null,
): { readonly model: string; readonly otherModeModel: string } {
  const candidates = [draft.otherModeModel, savedModelFor(saved, draft.provider, mode), draft.model]
    .filter((id): id is string => Boolean(id));
  if (mode === "api" || !catalog) {
    return { model: candidates[0] ?? draft.model, otherModeModel: draft.model };
  }
  const savedAuth = savedModelFor(saved, draft.provider, "auth");
  return {
    model: candidates.find((id) => isSelectableAuthModel(catalog, id, savedAuth)) ?? catalog.defaultId,
    otherModeModel: draft.model,
  };
}
