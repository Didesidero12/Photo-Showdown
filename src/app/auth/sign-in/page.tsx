"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithMagicLink } from "@/lib/actions/auth";
import styles from "./sign-in.module.css";

function SignInContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"magic" | "password">(
    searchParams.get("tab") === "password" ? "password" : "magic"
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "invalid_credentials"
      ? "Incorrect email or password. Please try again."
      : searchParams.get("error") === "missing_fields"
      ? "Please enter your email and password."
      : null
  );
  const [loading, setLoading] = useState(false);

  // Sync tab from URL (handles back-navigation after route-handler redirect)
  useEffect(() => {
    if (searchParams.get("tab") === "password") setMode("password");
  }, [searchParams]);

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signInWithMagicLink(fd);
    setLoading(false);
    if (result?.error) {
      setError("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  }

  return (
    <>
      {/* Film burn overlay */}
      <div className={styles.filmBurn} aria-hidden="true" />

      <main className={styles.card}>
        {/* Logo / wordmark */}
        <div className={styles.logo} aria-label="Photo Showdown">
          <span className={styles.logoShot}>PHOTO</span>
          <span className={styles.logoDivider}>⬡</span>
          <span className={styles.logoShowdown}>SHOWDOWN</span>
        </div>

        <p className={styles.tagline}>
          The darkroom where great photographers are made.
        </p>

        {sent ? (
          <div className={styles.sentState} role="status">
            <div className={styles.sentIcon}>✉</div>
            <h2>Check your inbox</h2>
            <p>
              We sent a magic link to your email. Click it to enter the
              darkroom.
            </p>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className={styles.modeToggle} role="tablist">
              <button
                role="tab"
                aria-selected={mode === "magic"}
                className={mode === "magic" ? styles.activeTab : ""}
                onClick={() => setMode("magic")}
              >
                Magic Link
              </button>
              <button
                role="tab"
                aria-selected={mode === "password"}
                className={mode === "password" ? styles.activeTab : ""}
                onClick={() => setMode("password")}
              >
                Password
              </button>
            </div>

            {mode === "magic" && (
              <form onSubmit={handleMagicLink} className={styles.form}>
                <label htmlFor="sign-in-email" className={styles.label}>
                  Teacher Email
                </label>
                <input
                  id="sign-in-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@school.edu"
                  className={styles.input}
                />
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.primaryButton}
                  id="send-magic-link-btn"
                >
                  {loading ? "Sending…" : "Send Magic Link"}
                </button>
              </form>
            )}

            {mode === "password" && (
              <form action="/api/auth/password-sign-in" method="POST" className={styles.form}>
                <label htmlFor="sign-in-email-pw" className={styles.label}>
                  Teacher Email
                </label>
                <input
                  id="sign-in-email-pw"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@school.edu"
                  className={styles.input}
                />
                <label htmlFor="sign-in-password" className={styles.label}>
                  Password
                </label>
                <input
                  id="sign-in-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={styles.input}
                />
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className={styles.primaryButton}
                  id="password-sign-in-btn"
                >
                  Sign In
                </button>
              </form>
            )}

            <p className={styles.footer}>
              Students:{" "}
              <a href="/join" id="student-join-link">
                Join a class →
              </a>
            </p>
          </>
        )}
      </main>
    </>
  );
}

export default function SignInPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div>Loading...</div>}>
        <SignInContent />
      </Suspense>
    </div>
  );
}
