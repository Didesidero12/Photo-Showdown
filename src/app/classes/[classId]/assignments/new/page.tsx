/**
 * /classes/[classId]/assignments/new — Create Assignment page.
 */
"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import styles from "./new-assignment.module.css";

export default function NewAssignmentPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await fetch(`/api/assignments/create`, {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          title: formData.get("title"),
          instructions: formData.get("instructions"),
          submission_deadline: formData.get("submission_deadline") || null,
          creative_intent_prompt: formData.get("creative_intent_prompt"),
        }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to create assignment.");
        return;
      }
      router.push(`/classes/${classId}/assignments/${data.assignment_id}`);
    });
  }

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span>/</span>
          <a href={`/classes/${classId}`}>Class</a>
          <span>/</span>
          <span>New Assignment</span>
        </nav>

        <h1 className={styles.title}>Create Assignment</h1>

        <form onSubmit={handleSubmit} className={styles.form} id="new-assignment-form">
          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>Assignment Title</label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Light and Shadow Study"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="instructions" className={styles.label}>Instructions</label>
            <textarea
              id="instructions"
              name="instructions"
              rows={5}
              placeholder="Describe what students should photograph and any creative constraints..."
              className={styles.textarea}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="creative_intent_prompt" className={styles.label}>
              Creative Intent Prompt
            </label>
            <input
              id="creative_intent_prompt"
              name="creative_intent_prompt"
              type="text"
              maxLength={300}
              defaultValue="Explain the creative choices behind your photograph."
              className={styles.input}
            />
            <p className={styles.hint}>
              Students will answer this question when submitting their photograph.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="submission_deadline" className={styles.label}>
              Submission Deadline <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="submission_deadline"
              name="submission_deadline"
              type="datetime-local"
              className={styles.input}
            />
            <p className={styles.hint}>
              The server enforces this deadline — the browser clock is not trusted.
            </p>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <a href={`/classes/${classId}`} className={styles.cancelBtn}>
              Cancel
            </a>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending}
              id="submit-new-assignment"
            >
              {isPending ? "Creating…" : "Create Assignment"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
