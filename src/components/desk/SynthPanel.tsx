import styles from "./SynthPanel.module.css";

export type SynthPanelProps = {
  title?: string;
  placeholder?: string;
  children?: React.ReactNode;
};

export function SynthPanel({
  title = "합성 · 채팅",
  placeholder = "이어서 질문하기…",
  children,
}: SynthPanelProps) {
  return (
    <aside className={styles.panel} aria-label={title} data-desk-synth>
      <div className={styles.head}>
        <h2>{title}</h2>
      </div>
      <div className={styles.body}>
        {children ?? (
          <>
            <div className={styles.bubbleAi}>
              <div className={styles.tag}>세컨드 브레인</div>
              검색 결과나 라이브러리 항목을 골라 질문하면 여기서 이어서 합성할 수 있어요.
            </div>
          </>
        )}
        <div className={styles.composer}>
          <span>{placeholder}</span>
          <button type="button" className={styles.send} aria-label="보내기">
            →
          </button>
        </div>
      </div>
    </aside>
  );
}
