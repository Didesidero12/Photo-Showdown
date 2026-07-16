/**
 * Client component — Assignment lifecycle controls (Publish, Move to Review, Archive).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startShowdownSession } from "@/lib/actions/session";
import styles from "./assignment-detail.module.css";

interface Props {
  assignmentId: string;
  classId: string;
  currentStatus: string;
}

export function AssignmentActionsBar({ assignmentId, classId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function doTransition(action: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/assignments/${assignmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, class_id: classId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className={styles.actionsBar}>
      {error && <span className={styles.actionError}>{error}</span>}
      {currentStatus === "draft" && (
        <button
          className={styles.publishBtn}
          onClick={() => doTransition("publish")}
          disabled={isPending}
          id="publish-assignment-btn"
        >
          {isPending ? "Publishing…" : "Publish Assignment"}
        </button>
      )}
      {currentStatus === "accepting_submissions" && (
        <button
          className={styles.reviewBtn}
          onClick={() => doTransition("move_to_review")}
          disabled={isPending}
          id="close-submissions-btn"
        >
          {isPending ? "Closing…" : "Close Submissions"}
        </button>
      )}
      {(currentStatus === "submission_review" || currentStatus === "ready") && (
        <button
          className={styles.reviewBtn}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await startShowdownSession(assignmentId, classId, "lighting", false, false);
              if (res.error) {
                if (res.error === "not_enough_submissions") {
                  setError("Cannot start session: at least 3 approved submissions are required.");
                } else {
                  setError(res.error);
                }
              } else {
                router.push(`/classes/${classId}/assignments/${assignmentId}/showdown/${res.data}/monitor`);
              }
            });
          }}
          disabled={isPending}
          style={{ background: "var(--primary-color)", color: "white", border: "none" }}
        >
          {isPending ? "Starting…" : "Start Quick Showdown Session"}
        </button>
      )}

      {!["archived", "complete"].includes(currentStatus) && (
        <button
          className={styles.archiveBtn}
          onClick={() => doTransition("archive")}
          disabled={isPending}
          id="archive-assignment-btn"
        >
          Archive
        </button>
      )}
    </div>
  );
}
