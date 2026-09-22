import { CHAT_COPY } from "./copy";
import styles from "./ChatScreen.module.css";

export function ModelChip() {
  return (
    <span className={styles.model} data-model="codex">
      {CHAT_COPY.model}
    </span>
  );
}
