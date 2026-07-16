/**
 * /assignment/[shareToken]/submit — Student submission page.
 *
 * - Verifies active membership server-side before showing any assignment content.
 * - Server-locked upload flow: initiate → get signed URL → upload → process.
 * - Accepts only JPG/PNG (validated server-side by magic bytes, not filename).
 * - Student cannot provide a storage path.
 */
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./submit.module.css";

interface AssignmentData {
  title: string;
  instructions: string | null;
  creative_intent_prompt: string;
  submission_deadline: string | null;
  assignment_id: string;
  existing_submission: {
    id: string;
    status: string;
    processing_status: string;
    creative_intent: string;
    teacher_note: string | null;
  } | null;
}

export default function SubmitPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const router = useRouter();

  const [data, setData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "processing" | "done" | "error"
  >("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/assignment/${shareToken}/submission-data`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setLoadError(
            d.error === "no_active_membership"
              ? "You don't have access to this assignment. Please join the class first."
              : "Could not load assignment."
          );
        } else {
          setData(d);
          if (d.existing_submission?.status === "returned") {
            setIntent(d.existing_submission.creative_intent);
          }
        }
      })
      .catch(() => setLoadError("Could not load assignment."))
      .finally(() => setLoading(false));
  }, [shareToken]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !intent.trim()) return;
    setSubmitError(null);
    setStage("uploading");

    startTransition(async () => {
      try {
        // 1. Initiate — get submissionId and signed upload URL
        const initiateRes = await fetch("/api/submissions/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: data!.assignment_id,
            creative_intent: intent.trim(),
          }),
        });
        const initiateData = await initiateRes.json();
        if (!initiateRes.ok || initiateData.error) {
          const msg: Record<string, string> = {
            assignment_not_accepting: "This assignment is no longer accepting submissions.",
            deadline_passed: "The submission deadline has passed.",
            no_active_membership: "You are not enrolled in this class.",
            submission_limit_reached: "You have reached the submission limit for this assignment.",
            creative_intent_required: "Please enter your creative intent.",
          };
          setSubmitError(msg[initiateData.error] ?? "Could not start upload. Please try again.");
          setStage("error");
          return;
        }

        const { submission_id, upload_url } = initiateData;

        // 2. Upload file directly to the signed URL
        const uploadRes = await fetch(upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) {
          setSubmitError("Upload failed. Please try again.");
          setStage("error");
          return;
        }

        // 3. Trigger processing
        setStage("processing");
        const processRes = await fetch(`/api/submissions/${submission_id}/process`, {
          method: "POST",
        });
        const processData = await processRes.json();

        if (!processRes.ok && processData.message) {
          setSubmitError(processData.message);
          setStage("error");
          return;
        }

        if (!processRes.ok) {
          setSubmitError("Image processing failed. Please try again.");
          setStage("error");
          return;
        }

        setStage("done");
        setTimeout(() => router.push(`/assignment/${shareToken}/status`), 1500);
      } catch {
        setSubmitError("An unexpected error occurred. Please try again.");
        setStage("error");
      }
    });
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.centered}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitle}>Access Denied</h1>
          <p>{loadError}</p>
          <a href={`/assignment/${shareToken}`} className={styles.backLink}>
            ← Join this class
          </a>
        </div>
      </div>
    );
  }

  const existing = data?.existing_submission;
  const isReturned = existing?.status === "returned";
  const isAlreadySubmitted =
    existing && !isReturned && existing.status !== "rejected";

  if (isAlreadySubmitted && stage === "idle") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.badge}>Photo Showdown</div>
          <h1 className={styles.title}>{data?.title}</h1>
          <div className={styles.alreadySubmitted}>
            <p>You have already submitted for this assignment.</p>
            <a href={`/assignment/${shareToken}/status`} className={styles.statusLink}>
              View your submission status →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge}>Photo Showdown</div>
        <h1 className={styles.title}>{data?.title}</h1>

        {data?.instructions && (
          <div className={styles.instructions}>
            <p>{data.instructions}</p>
          </div>
        )}

        {isReturned && existing?.teacher_note && (
          <div className={styles.returnNote} role="status">
            <p className={styles.returnNoteLabel}>Teacher note</p>
            <p className={styles.returnNoteText}>{existing.teacher_note}</p>
            <p className={styles.returnNoteHint}>Please revise your submission below.</p>
          </div>
        )}

        {data?.submission_deadline && (
          <p className={styles.deadline}>
            Due{" "}
            {new Date(data.submission_deadline).toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        {stage === "done" && (
          <div className={styles.successBanner} role="status">
            ✓ Submission received! Redirecting to status…
          </div>
        )}

        {stage !== "done" && (
          <form onSubmit={handleSubmit} className={styles.form} id="submit-form">
            {/* Photo upload */}
            <div className={styles.uploadZone} onClick={() => fileRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Preview" className={styles.preview} />
              ) : (
                <div className={styles.uploadPrompt}>
                  <span className={styles.uploadIcon}>📷</span>
                  <p>Click to select JPG or PNG</p>
                  <p className={styles.uploadHint}>
                    HEIC is not supported. Max 20 MB.
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className={styles.fileInput}
                id="photo-upload-input"
              />
            </div>

            {/* Creative Intent */}
            <div className={styles.field}>
              <label htmlFor="creative-intent" className={styles.label}>
                {data?.creative_intent_prompt}
              </label>
              <textarea
                id="creative-intent"
                rows={5}
                required
                maxLength={2000}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Describe your creative choices…"
                className={styles.textarea}
              />
              <p className={styles.charCount}>{intent.length}/2000</p>
            </div>

            {submitError && (
              <div className={styles.submitError} role="alert">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!file || !intent.trim() || stage !== "idle"}
              id="submit-photo-btn"
            >
              {stage === "uploading" && "Uploading…"}
              {stage === "processing" && "Processing image…"}
              {stage === "idle" && (isReturned ? "Resubmit Photo" : "Submit Photo")}
              {stage === "error" && "Try Again"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
