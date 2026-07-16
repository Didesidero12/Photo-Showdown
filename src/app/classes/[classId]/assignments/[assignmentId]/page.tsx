/**
 * /classes/[classId]/assignments/[assignmentId] — Assignment detail page.
 *
 * Shows: title, status, deadline, share link, QR code, lifecycle controls,
 * and paginated submissions list.
 *
 * Only the owning teacher can access this page (RLS + server check).
 */
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { AssignmentActionsBar } from "./AssignmentActionsBar";
import { QRCodeSection } from "./QRCodeSection";
import styles from "./assignment-detail.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assignments")
    .select("title")
    .eq("id", assignmentId)
    .maybeSingle();
  return { title: data ? `${data.title} — Photo Showdown` : "Assignment — Photo Showdown" };
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string }>;
}) {
  const { classId, assignmentId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) redirect("/auth/sign-in");

  // Verify teacher owns the class
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!cls) notFound();

  // Fetch assignment (RLS ensures teacher ownership)
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("id, title, instructions, status, share_token, submission_deadline, creative_intent_prompt, max_submissions_per_student, created_at")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .maybeSingle();

  if (error || !assignment) notFound();

  // Fetch submissions for this assignment
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, status, processing_status, creative_intent, submitted_at, class_membership_id")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/assignment/${assignment.share_token}`;

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    accepting_submissions: "Accepting Submissions",
    submission_review: "Under Review",
    ready: "Ready",
    active_critique: "Active Critique",
    results_reveal: "Results Reveal",
    reflection: "Reflection",
    complete: "Complete",
    archived: "Archived",
  };

  const submissionStatusLabel: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    returned: "Returned",
    rejected: "Rejected",
  };

  const processingStatusLabel: Record<string, string> = {
    pending: "Uploading…",
    processing: "Processing…",
    ready: "Ready",
    failed: "Failed",
  };

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span>/</span>
          <a href={`/classes/${classId}`}>{cls.name}</a>
          <span>/</span>
          <span>{assignment.title}</span>
        </nav>

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{assignment.title}</h1>
            <div className={styles.meta}>
              <ul>
                <li><strong>Status:</strong> <span className={styles.statusBadge}>{statusLabel[assignment.status] || assignment.status}</span></li>
                <li><strong>Max Submissions:</strong> {assignment.max_submissions_per_student}</li>
                <li><strong>Deadline:</strong> {assignment.submission_deadline ? new Date(assignment.submission_deadline).toLocaleString() : "None"}</li>
              </ul>
            </div>
          </div>
          <AssignmentActionsBar
            assignmentId={assignmentId}
            classId={classId}
            currentStatus={assignment.status}
          />
        </header>

        {assignment.instructions && (
          <section className={styles.instructions}>
            <h2 className={styles.sectionLabel}>Instructions</h2>
            <p className={styles.instructionsText}>{assignment.instructions}</p>
          </section>
        )}

        {/* Share & QR */}
        <section className={styles.shareSection} aria-label="Share assignment">
          <h2 className={styles.sectionLabel}>Share Link & QR Code</h2>
          <div className={styles.shareRow}>
            <div className={styles.shareUrlBox}>
              <input
                readOnly
                value={shareUrl}
                id="share-url-input"
                className={styles.shareUrlInput}
                aria-label="Assignment share URL"
              />
              <button
                className={styles.copyBtn}
                id="copy-share-url-btn"
                onClick={undefined}
                type="button"
                data-url={shareUrl}
              >
                Copy
              </button>
            </div>
            <QRCodeSection shareUrl={shareUrl} />
          </div>
          <p className={styles.shareHint}>
            Students without class membership will be prompted to enter the class join code before
            accessing this assignment.
          </p>
        </section>

        {/* Submissions */}
        <section className={styles.submissionsSection} aria-label="Submissions">
          <h2 className={styles.sectionLabel}>
            Submissions{" "}
            <span className={styles.count}>({submissions?.length ?? 0})</span>
          </h2>

          {!submissions || submissions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No submissions yet.</p>
            </div>
          ) : (
            <ul className={styles.submissionList} role="list">
              {submissions.map((s) => (
                <li key={s.id} className={styles.submissionItem}>
                  <Link
                    href={`/classes/${classId}/assignments/${assignmentId}/submissions/${s.id}`}
                    className={styles.submissionLink}
                    id={`submission-${s.id}`}
                  >
                    <div className={styles.submissionInfo}>
                      <span className={styles.submissionDate}>
                        {new Date(s.submitted_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className={styles.submissionIntent}>
                        {s.creative_intent.slice(0, 80)}
                        {s.creative_intent.length > 80 ? "…" : ""}
                      </span>
                    </div>
                    <div className={styles.submissionBadges}>
                      {s.processing_status === "failed" ? (
                        <span className={`${styles.badge} ${styles.proc_failed}`}>Processing Failed</span>
                      ) : s.processing_status === "ready" && s.status === "pending" ? (
                        <span className={`${styles.badge} ${styles.sub_pending}`}>Awaiting Review</span>
                      ) : (
                        <span className={`${styles.badge} ${styles[`sub_${s.status}`]}`}>
                          {submissionStatusLabel[s.status] ?? s.status}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
