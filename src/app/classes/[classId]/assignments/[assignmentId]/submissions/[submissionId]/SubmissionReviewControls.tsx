/**
 * Client component — Submission review controls (Approve, Return, Reject).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./submission-review.module.css";

interface Props {
  submissionId: string;
  canApprove: boolean;
  canReturn: boolean;
  canReject: boolean;
  assignmentId: string;
  classId: string;
}

export function SubmissionReviewControls({
  submissionId,
  canApprove,
  canReturn,
  canReject,
  assignmentId,
  classId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNoteFor, setShowNoteFor] = useState<"returned" | "rejected" | null>(null);

  async function submit(action: "approved" | "returned" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, teacher_note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Review failed.");
        return;
      }
      router.push(`/classes/${classId}/assignments/${assignmentId}`);
    });
  }

  return (
    <div className={styles.controls}>
      {error && (
        <div className={styles.controlError} role="alert">
          {error}
        </div>
      )}

      {showNoteFor && (
        <div className={styles.noteField}>
          <label htmlFor="teacher-note" className={styles.noteFieldLabel}>
            Private note to student{" "}
            <span className={styles.noteOptional}>(optional)</span>
          </label>
          <textarea
            id="teacher-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Explain what needs to change…"
            className={styles.noteTextarea}
          />
          <div className={styles.noteActions}>
            <button
              className={styles.confirmBtn}
              onClick={() => submit(showNoteFor)}
              disabled={isPending}
              id={`confirm-${showNoteFor}-btn`}
            >
              {isPending ? "Saving…" : `Confirm ${showNoteFor === "returned" ? "Return" : "Rejection"}`}
            </button>
            <button
              className={styles.cancelNoteBtn}
              onClick={() => setShowNoteFor(null)}
              disabled={isPending}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showNoteFor && (
        <div className={styles.buttonRow}>
          {canApprove && (
            <button
              className={styles.approveBtn}
              onClick={() => submit("approved")}
              disabled={isPending}
              id="approve-submission-btn"
            >
              {isPending ? "…" : "Approve"}
            </button>
          )}
          {canReturn && (
            <button
              className={styles.returnBtn}
              onClick={() => setShowNoteFor("returned")}
              disabled={isPending}
              id="return-submission-btn"
            >
              Return for Changes
            </button>
          )}
          {canReject && (
            <button
              className={styles.rejectBtn}
              onClick={() => setShowNoteFor("rejected")}
              disabled={isPending}
              id="reject-submission-btn"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
