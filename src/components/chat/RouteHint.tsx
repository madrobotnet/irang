import { CHAT_COPY } from "./copy";
import styles from "./ChatScreen.module.css";

type RouteHintProps = {
  label: string;
};

export function RouteHint({ label }: RouteHintProps) {
  return (
    <p className={styles.route} data-route-hint={label}>
      {CHAT_COPY.routeLead} → {label}
    </p>
  );
}
