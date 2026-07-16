/**
 * Client component — loads the signed image URL from the API and renders it.
 * This approach keeps getSupabaseAdmin() out of page.tsx (static scan compliance).
 */
"use client";

import { useEffect, useState } from "react";
import styles from "./submission-review.module.css";

export function SubmissionPhoto({
  submissionId,
  processingStatus,
}: {
  submissionId: string;
  processingStatus: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(processingStatus === "ready");

  useEffect(() => {
    if (processingStatus !== "ready") return;
    fetch(`/api/submissions/${submissionId}/image`)
      .then((r) => r.json())
      .then((d) => { if (d.url) setUrl(d.url); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [submissionId, processingStatus]);

  if (processingStatus === "failed") {
    return (
      <div className={styles.photoPlaceholder}>
        <p className={styles.processingFailed}>Image processing failed.</p>
      </div>
    );
  }

  if (processingStatus !== "ready") {
    return (
      <div className={styles.photoPlaceholder}>
        <p className={styles.processingPending}>
          {processingStatus === "processing" ? "Processing your image…" : "Upload pending…"}
        </p>
      </div>
    );
  }

  if (loading || !url) {
    return (
      <div className={styles.photoPlaceholder}>
        <p className={styles.processingPending}>Loading image…</p>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Student submission photograph"
      className={styles.photo}
      id="submission-photo"
    />
  );
}
