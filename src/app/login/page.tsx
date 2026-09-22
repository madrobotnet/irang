import LoginForm from "@/components/login-form";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles["room"]}>
      <section className={styles["column"]} aria-labelledby="login-title">
        <header className={styles["heading"]}>
          <h1 id="login-title" className={styles["title"]}>세컨드 브레인</h1>
          <p className={styles["subtitle"]}>개인 지식 보관소</p>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
