/**
 * /assignment/[shareToken] — Public assignment entry point.
 *
 * Security model:
 * - Resolves assignment from share_token ONLY.
 * - Exposes ONLY: class name, assignment title (for confirmation), assignment status.
 * - Does NOT expose: instructions, UUIDs, org identifiers, storage paths, submissions.
 * - If the authenticated student has active membership → redirect to /assignment/[token]/submit
 * - If not → render class join code form. Joining does NOT auto-enroll.
 */
"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./assignment-entry.module.css";

interface AssignmentInfo {
  class_name: string;
  assignment_title: string;
  status: string;
  session_status: string | null;
  creative_intent_prompt: string;
  is_member: boolean;
}

export default function AssignmentEntryPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<AssignmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [classCode, setClassCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, startJoinTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/assignment/${shareToken}/info`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setFetchError(data.error === "not_found" ? "Assignment not found." : "Could not load assignment.");
        } else {
          setInfo(data);
          if (data.is_member) {
            if (data.session_status === "active") {
              router.replace(`/assignment/${shareToken}/critique`);
            } else if (data.session_status === "reveal") {
              router.replace(`/assignment/${shareToken}/results`);
            } else {
              router.replace(`/assignment/${shareToken}/submit`);
            }
          }
        }
      })
      .catch(() => setFetchError("Could not load assignment."))
      .finally(() => setLoading(false));
  }, [shareToken, router]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    startJoinTransition(async () => {
      const res = await fetch(`/api/assignment/${shareToken}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_code: classCode, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg: Record<string, string> = {
          invalid_code: "That class code is not valid. Please check and try again.",
          class_archived: "This class is no longer active.",
          membership_suspended: "Your account has been suspended from this class.",
          code_class_mismatch: "That code does not match the expected class. Please try again.",
        };
        setJoinError(msg[data.error] ?? "Could not join class. Please try again.");
        return;
      }
      router.push(`/assignment/${shareToken}/submit`);
    });
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} aria-label="Loading…" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.centered}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Assignment Unavailable</h1>
          <p className={styles.errorMsg}>{fetchError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge}>Photo Showdown</div>
        <h1 className={styles.title}>{info?.assignment_title}</h1>
        <p className={styles.className}>{info?.class_name}</p>

        <div className={styles.divider} />

        <div className={styles.joinSection}>
          <h2 className={styles.joinHeading}>Join to access this assignment</h2>
          <p className={styles.joinSubheading}>
            Enter your class code to verify your enrollment. Your teacher shared this code with you
            directly.
          </p>

          <form onSubmit={handleJoin} className={styles.joinForm} id="join-class-form">
            <div className={styles.field}>
              <label htmlFor="display-name" className={styles.label}>
                Your name
              </label>
              <input
                id="display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should your teacher identify you?"
                maxLength={80}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="class-code" className={styles.label}>
                Class code
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

            {joinError && (
              <div className={styles.joinError} role="alert">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              className={styles.joinBtn}
              disabled={isJoining || !classCode || !displayName}
              id="join-class-submit-btn"
            >
              {isJoining ? "Joining…" : "Join & View Assignment"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
