/**
 * Shared Sidebar — used across all protected teacher pages.
 *
 * Active nav item is highlighted based on the `activePath` prop.
 * Assignments link is disabled until Milestone 2.
 */
import styles from "./Sidebar.module.css";

interface SidebarProps {
  activePath: "dashboard" | "classes" | "account";
}

export function Sidebar({ activePath }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <span className={styles.logoMark}>PS</span>
        <span className={styles.logoText}>SHOWDOWN</span>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        <a
          href="/dashboard"
          className={`${styles.navItem} ${activePath === "dashboard" ? styles.navActive : ""}`}
          aria-current={activePath === "dashboard" ? "page" : undefined}
        >
          <span className={styles.navIcon} aria-hidden="true">⊞</span>
          Dashboard
        </a>
        <a
          href="/classes"
          className={`${styles.navItem} ${activePath === "classes" ? styles.navActive : ""}`}
          aria-current={activePath === "classes" ? "page" : undefined}
        >
          <span className={styles.navIcon} aria-hidden="true">◈</span>
          Classes
        </a>
        <a
          href="/classes"
          className={`${styles.navItem} ${activePath === "classes" ? styles.navActive : ""}`}
        >
          <span className={styles.navIcon} aria-hidden="true">⊡</span>
          Assignments
        </a>
        <a
          href="/account"
          className={`${styles.navItem} ${activePath === "account" ? styles.navActive : ""}`}
          aria-current={activePath === "account" ? "page" : undefined}
        >
          <span className={styles.navIcon} aria-hidden="true">◯</span>
          Account
        </a>
      </nav>

      <form action="/api/auth/sign-out" method="POST" className={styles.signOutForm}>
        <button type="submit" className={styles.signOutBtn} id="sign-out-btn">
          Sign Out
        </button>
      </form>
    </aside>
  );
}
