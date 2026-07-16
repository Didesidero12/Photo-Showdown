"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./join.module.css";

export function JoinForm({ hasSession }: { hasSession?: boolean }) {
  const router = useRouter();
  const [classCode, setClassCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_code: classCode,
          display_name: displayName,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        // Safe mapping of errors
        const msg: Record<string, string> = {
          invalid_code: "We couldn’t join that class. Check the code and try again.",
          invalid_display_name: "Please enter a valid display name.",
          class_archived: "This class is no longer active.",
          membership_suspended: "Your account has been suspended from this class.",
          membership_removed: "You have been removed from this class. Ask your teacher to restore your access.",
          teacher_account: "You are signed in as a teacher. Please use a separate browser profile or sign out to join as a student.",
        };
        setError(msg[data.error] ?? "We couldn’t join that class. Check the code and try again.");
        setLoading(false);
        return;
      }
      
      router.push(`/my/${data.classId}`);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className={styles.form} id="student-join-form">
      {!hasSession && (
        <div>
          <label htmlFor="display-name" className={styles.label}>
            Your Name
          </label>
          <input
            id="display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First and last name"
            maxLength={80}
            className={styles.input}
          />
        </div>
      )}

      <div>
        <label htmlFor="class-code" className={styles.label}>
          Class Code
        </label>
        <input
          id="class-code"
          type="text"
          required
          value={classCode}
          onChange={(e) => setClassCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          maxLength={6}
          className={`${styles.input} ${styles.codeInput}`}
          autoCapitalize="characters"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        className={styles.submitBtn}
        id="join-class-submit-btn"
        disabled={loading}
      >
        {loading ? "Joining..." : "Join Class"}
      </button>
    </form>
  );
}
