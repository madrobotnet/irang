import { describe, expect, it } from "vitest";
import { E3_DEV_GATES, E3_DEV_PROCESS_JUDGMENT } from "./dev-process-gates";

describe("E3 dev-process Jev gates", () => {
  it("consumes the recorded judgment choices", () => {
    expect(E3_DEV_GATES.suggestionDelivery).toBe(
      E3_DEV_PROCESS_JUDGMENT.suggestionDelivery.choice,
    );
    expect(E3_DEV_GATES.suggestionDelivery).toBe("persist_explicit_refresh");
    expect(E3_DEV_GATES.repeatPromote).toBe("idempotent_existing_note");
    expect(E3_DEV_GATES.promoteWhenDiscarded).toBe("reject_discarded");
    expect(E3_DEV_GATES.discardWhenPromoted).toBe("reject_promoted");
    expect(E3_DEV_GATES.ingestRetryTarget).toBe("honor_stored_target");
    expect(E3_DEV_GATES.classificationShape).toBe("choice_plus_tag_nouls");
  });
});
