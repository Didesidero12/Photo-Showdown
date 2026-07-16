/**
 * /assignment/[shareToken]/status — Student submission status page.
 *
 * Shows the student's own submission status, processing state,
 * and any private teacher note. Never shows other students' data.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./status.module.css";

interface StatusData {
  title: string;
  submission: {
    status: string;
    processing_status: string;
    creative_intent: string;
    teacher_note: string | null;
    submitted_at: string;
    reviewed_at: string | null;
    image_url: string | null;
  } | null;
}

export default function StatusPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assignment/${shareToken}/my-status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(
            d.error === "no_active_membership"
              ? "You are not enrolled in this class."
              : "Could not load status."
          );
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Could not load status."))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const sub = data?.submission;

  const statusMessages: Record<string, { label: string; desc: string; color: string }> = {
    pending: {
      label: "Pending Review",
      desc: "Your submission is awaiting your teacher's review.",
      color: styles.gold,
    },
    approved: {
      label: "Approved",
      desc: "Your photograph has been approved.",
      color: styles.green,
    },
    returned: {
      label: "Returned for Changes",
      desc: "Your teacher has returned this submission. Please review the note below and resubmit.",
      color: styles.orange,
    },
    rejected: {
      label: "Rejected",
      desc: "Your submission has been rejected.",
      color: styles.red,
    },
  };

  const processingMessages: Record<string, string> = {
    pending: "Your photo is being uploaded…",
    processing: "Your photo is being processed…",
    ready: "Processing complete.",
    failed: "Image processing failed. Please try submitting again.",
  };

  const info = sub ? statusMessages[sub.status] : null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge}>Photo Showdown</div>
        <h1 className={styles.title}>{data?.title}</h1>

        {!sub ? (
          <div className={styles.noSub}>
            <p>You have not submitted yet.</p>
            <Link href={`/assignment/${shareToken}/submit`} className={styles.submitLink}>
              Submit your photograph →
            </Link>
          </div>
        ) : (
          <div className={styles.status}>
            {/* Processing status */}
            {sub.processing_status !== "ready" && (
              <div className={`${styles.processingBanner} ${sub.processing_status === "failed" ? styles.failed : ""}`}>
                {processingMessages[sub.processing_status]}
              </div>
            )}

            {/* Submission image */}
            {sub.image_url && (
              <img
                src={sub.image_url}
                alt="Your submission"
                className={styles.photo}
                id="my-submission-photo"
              />
            )}

            {/* Status chip */}
            <div className={`${styles.statusChip} ${info?.color ?? ""}`}>
              {info?.label ?? sub.status}
            </div>
            <p className={styles.statusDesc}>{info?.desc}</p>

            {/* Submitted at */}
            <p className={styles.submittedAt}>
              Submitted{" "}
              {new Date(sub.submitted_at).toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>

            {/* Creative intent (own) */}
            <div className={styles.intentBox}>
              <p className={styles.intentLabel}>Your creative intent</p>
              <blockquote className={styles.intentText}>{sub.creative_intent}</blockquote>
            </div>

            {/* Teacher note — only for returned/rejected */}
            {sub.teacher_note && ["returned", "rejected"].includes(sub.status) && (
              <div className={styles.noteBox} role="status">
                <p className={styles.noteLabel}>Teacher note</p>
                <p className={styles.noteText}>{sub.teacher_note}</p>
              </div>
            )}

            {/* Resubmit link if returned */}
            {sub.status === "returned" && (
              <Link href={`/assignment/${shareToken}/submit`} className={styles.resubmitLink} id="resubmit-link">
                ← Revise and resubmit
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
