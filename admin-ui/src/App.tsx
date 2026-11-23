import type { Component } from "solid-js";
import * as styles from "./App.css";
import { lightTheme } from "./styles/theme.css";

export const App: Component = () => {
  return (
    <div class={`${lightTheme} ${styles.layout}`}>
      <header class={styles.header}>
        <h1 class={styles.title}>Tenkyu 管理画面</h1>
        <span class={styles.badge}>v0.0.1</span>
      </header>
      <main class={styles.main}>
        <div class={styles.card}>
          <h2 class={styles.cardTitle}>管理コンソール</h2>
          <p class={styles.cardDescription}>
            管理画面の土台です。今後のタスクで主体（principals）や認証記録（auth_events）の照会画面が追加されます。
          </p>
        </div>
      </main>
    </div>
  );
};
