/**
 * /classes/[classId]/assignments/[assignmentId]/submissions/[submissionId]
 * — Teacher submission review page.
 *
 * Displays: photo (signed URL), student display name, Creative Intent,
 * processing status, submission timestamp, and review controls.
 *
 * Approval is blocked if processing_status != 'ready'.
 */
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { SubmissionReviewControls } from "./SubmissionReviewControls";
import { SubmissionPhoto } from "./SubmissionPhoto";
import styles from "./submission-review.module.css";


export async function generateMetadata() {
  return { title: "Review Submission — Photo Showdown" };
}

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{
    classId: string;
    assignmentId: string;
    submissionId: string;
  }>;
}) {
  const { classId, assignmentId, submissionId } = await params;

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

  // Fetch assignment title for breadcrumb
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) notFound();

  // Fetch submission — RLS ensures teacher access
  const { data: sub, error: subError } = await supabase
    .from("submissions")
    .select("id, status, processing_status, creative_intent, teacher_note, submitted_at, reviewed_at, storage_path_processed, class_membership_id")
    .eq("id", submissionId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (subError || !sub) notFound();

  // Fetch student display name via class_membership_id
  const { data: membership } = await supabase
    .from("class_memberships")
    .select("display_name")
    .eq("id", sub.class_membership_id)
    .maybeSingle();

  // Image loaded client-side by SubmissionPhoto component via /api/submissions/[id]/image

  const statusLabel: Record<string, string> = {
    pending: "Pending Review",
    approved: "Approved",
    returned: "Returned for Changes",
    rejected: "Rejected",
  };

  const processingLabel: Record<string, string> = {
    pending: "Upload pending…",
    processing: "Processing image…",
    ready: "Ready",
    failed: "Processing failed",
  };

  const canApprove = sub.processing_status === "ready" && sub.status === "pending";
  const canReturn = ["pending", "approved"].includes(sub.status);
  const canReject = ["pending", "approved"].includes(sub.status);

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span>/</span>
          <a href={`/classes/${classId}`}>{cls.name}</a>
          <span>/</span>
          <a href={`/classes/${classId}/assignments/${assignmentId}`}>{assignment.title}</a>
          <span>/</span>
          <span>Review Submission</span>
        </nav>

        <div className={styles.grid}>
          {/* Left: image */}
          <section className={styles.imageSection} aria-label="Submission photograph">
            <SubmissionPhoto
              submissionId={submissionId}
              processingStatus={sub.processing_status}
            />
          </section>

          {/* Right: metadata + controls */}
          <section className={styles.detailSection}>
            <div className={styles.studentRow}>
              <span className={styles.studentName}>
                {membership?.display_name ?? "Unknown student"}
              </span>
              <span className={`${styles.statusChip} ${styles[`status_${sub.status}`]}`}>
                {statusLabel[sub.status] ?? sub.status}
              </span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Processing</span>
              <span className={`${styles.metaValue} ${styles[`proc_${sub.processing_status}`]}`}>
                {processingLabel[sub.processing_status] ?? sub.processing_status}
              </span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Submitted</span>
              <span className={styles.metaValue}>
                {new Date(sub.submitted_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {sub.reviewed_at && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Reviewed</span>
                <span className={styles.metaValue}>
                  {new Date(sub.reviewed_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            <div className={styles.intentSection}>
              <p className={styles.intentLabel}>Creative Intent</p>
              <blockquote className={styles.intentText}>
                {sub.creative_intent}
              </blockquote>
            </div>

            {sub.teacher_note && (
              <div className={styles.noteSection}>
                <p className={styles.noteLabel}>Previous Note</p>
                <p className={styles.noteText}>{sub.teacher_note}</p>
              </div>
            )}

            {sub.processing_status !== "ready" && (
              <div className={styles.processingWarning} role="status">
                Approval is not available until image processing is complete.
              </div>
            )}

            <SubmissionReviewControls
              submissionId={submissionId}
              canApprove={canApprove}
              canReturn={canReturn}
              canReject={canReject}
              assignmentId={assignmentId}
              classId={classId}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
