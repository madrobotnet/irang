/**
 * Dev-process Jev gates for E3 (2026-09-22).
 * Consumed by inbox HTTP handlers. Do not re-ask a model to reinterpret them.
 */

export type SuggestionDeliveryGate =
  | "persist_explicit_refresh"
  | "recompute_every_read"
  | "lazy_fill_on_read";

export type RepeatPromoteGate = "idempotent_existing_note" | "conflict_already_promoted";

export type PromoteWhenDiscardedGate = "reject_discarded" | "allow_and_clear_discard";

export type DiscardWhenPromotedGate = "reject_promoted" | "allow_keep_note";

export type IngestRetryTargetGate = "honor_stored_target" | "always_inbox";

export type ClassificationShapeGate = "choice_plus_tag_nouls" | "tag_nouls_only";

export type GateChoice<TChoice extends string> = {
  choice: TChoice;
  confidence: number;
  probabilities: Record<string, number>;
};

export const E3_DEV_PROCESS_JUDGMENT: {
  suggestionDelivery: GateChoice<SuggestionDeliveryGate>;
  repeatPromote: GateChoice<RepeatPromoteGate>;
  promoteWhenDiscarded: GateChoice<PromoteWhenDiscardedGate>;
  discardWhenPromoted: GateChoice<DiscardWhenPromotedGate>;
  ingestRetryTarget: GateChoice<IngestRetryTargetGate>;
  classificationShape: GateChoice<ClassificationShapeGate>;
} = {
  suggestionDelivery: {
    choice: "persist_explicit_refresh",
    confidence: 0.99,
    probabilities: {
      lazy_fill_on_read: 0.01,
      recompute_every_read: 0,
      persist_explicit_refresh: 0.99,
    },
  },
  repeatPromote: {
    choice: "idempotent_existing_note",
    confidence: 0.87,
    probabilities: {
      conflict_already_promoted: 0.06,
      idempotent_existing_note: 0.94,
    },
  },
  promoteWhenDiscarded: {
    choice: "reject_discarded",
    confidence: 0.88,
    probabilities: {
      allow_and_clear_discard: 0.06,
      reject_discarded: 0.94,
    },
  },
  discardWhenPromoted: {
    choice: "reject_promoted",
    confidence: 0.95,
    probabilities: {
      reject_promoted: 0.97,
      allow_keep_note: 0.03,
    },
  },
  ingestRetryTarget: {
    choice: "honor_stored_target",
    confidence: 0.76,
    probabilities: {
      always_inbox: 0.12,
      honor_stored_target: 0.88,
    },
  },
  classificationShape: {
    choice: "choice_plus_tag_nouls",
    confidence: 0.71,
    probabilities: {
      tag_nouls_only: 0.14,
      choice_plus_tag_nouls: 0.86,
    },
  },
};

export const E3_DEV_GATES: {
  suggestionDelivery: SuggestionDeliveryGate;
  repeatPromote: RepeatPromoteGate;
  promoteWhenDiscarded: PromoteWhenDiscardedGate;
  discardWhenPromoted: DiscardWhenPromotedGate;
  ingestRetryTarget: IngestRetryTargetGate;
  classificationShape: ClassificationShapeGate;
} = {
  suggestionDelivery: E3_DEV_PROCESS_JUDGMENT.suggestionDelivery.choice,
  repeatPromote: E3_DEV_PROCESS_JUDGMENT.repeatPromote.choice,
  promoteWhenDiscarded: E3_DEV_PROCESS_JUDGMENT.promoteWhenDiscarded.choice,
  discardWhenPromoted: E3_DEV_PROCESS_JUDGMENT.discardWhenPromoted.choice,
  ingestRetryTarget: E3_DEV_PROCESS_JUDGMENT.ingestRetryTarget.choice,
  classificationShape: E3_DEV_PROCESS_JUDGMENT.classificationShape.choice,
};
