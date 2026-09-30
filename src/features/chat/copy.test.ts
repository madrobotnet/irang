import { expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { CHAT_COPY } from "./copy";

test("Korean and English chat copy have the same keys, leaf kinds and parameters", () => {
  expect(copyParityIssues(CHAT_COPY)).toEqual([]);
});
