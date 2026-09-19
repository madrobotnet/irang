"use client";

import { LoginForm } from "./LoginForm";
import styles from "./LoginScreen.module.css";

export function LoginScreen() {
  return (
    <main className={styles.page}>
      <LoginForm />
    </main>
  );
}
