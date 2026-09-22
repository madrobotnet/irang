import type { FormEvent, KeyboardEvent } from "react";
import { CHAT_COPY } from "./copy";
import { ModelChip } from "./ModelChip";
import styles from "./ChatScreen.module.css";

type ComposerProps = {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

export function Composer({ value, busy, onChange, onSend }: ComposerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <label className="sr-only" htmlFor="chat-composer">
        {CHAT_COPY.composerLabel}
      </label>
      <textarea
        id="chat-composer"
        className={styles.input}
        value={value}
        aria-label={CHAT_COPY.empty}
        rows={2}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <ModelChip />
      <button type="submit" className={styles.send} disabled={busy || value.trim().length === 0}>
        {CHAT_COPY.send}
      </button>
    </form>
  );
}
