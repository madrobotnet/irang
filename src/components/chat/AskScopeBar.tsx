import type { JevUiState } from "@/lib/jev/jev-state";
import { JevBadge } from "@/components/jev/JevBadge";
import { CHAT_COPY, evidenceChipLabel } from "./copy";
import type { ChatScope } from "./scope";
import styles from "./ChatScreen.module.css";

const SCOPES: { id: ChatScope; label: (count: number) => string }[] = [
  { id: "current", label: () => CHAT_COPY.scopeCurrent },
  { id: "selected", label: () => CHAT_COPY.scopeSelected },
  { id: "all", label: () => CHAT_COPY.scopeAll },
  { id: "evidence", label: (count) => evidenceChipLabel(count) },
];

type AskScopeBarProps = {
  scope: ChatScope;
  evidenceCount: number;
  jev: JevUiState;
  onScope: (scope: ChatScope) => void;
};

export function AskScopeBar({ scope, evidenceCount, jev, onScope }: AskScopeBarProps) {
  const showOn = jev === "jev_ready" || jev === "jev_low_confidence";
  return (
    <div className={styles.scope} role="group" aria-label="범위">
      {SCOPES.map((item) => {
        const on = scope === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={on ? styles.chipOn : styles.chip}
            aria-pressed={on}
            data-scope={item.id}
            onClick={() => onScope(item.id)}
          >
            {item.label(evidenceCount)}
          </button>
        );
      })}
      <div className={styles.jev} data-jev-on={showOn ? "true" : "false"}>
        <JevBadge state={jev} />
        {showOn ? <span className={styles.onWord}>· {CHAT_COPY.on}</span> : null}
      </div>
    </div>
  );
}
