/**
 * /my/[classId] — Student class dashboard.
 *
 * Shows active assignments for a class in which the student has active membership.
 * Due dates, submission statuses, and links to submit/view status.
 * Redirects unauthenticated users to sign-in.
 */
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./my-class.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .maybeSingle();
  return { title: cls ? `${cls.name} — Photo Showdown` : "My Class — Photo Showdown" };
}

export default async function MyClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in");

  // Verify active membership
  const { data: membership } = await supabase
    .from("class_memberships")
    .select("id, display_name, status")
    .eq("class_id", classId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!membership || membership.status !== "active") notFound();

  const { data: cls } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .maybeSingle();

  if (!cls) notFound();

  // Fetch visible assignments
  const VISIBLE_STATUSES = ["accepting_submissions", "submission_review", "ready", "complete"] as const;
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, status, submission_deadline, share_token")
    .eq("class_id", classId)
    .in("status", VISIBLE_STATUSES)
    .order("created_at", { ascending: false });

  // Fetch student's own submissions for this class (to show statuses)
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assignment_id, status, processing_status")
    .eq("class_membership_id", membership.id);

  const submissionByAssignment = new Map(
    (submissions ?? []).map((s) => [s.assignment_id, s])
  );

  const statusLabel: Record<string, string> = {
    accepting_submissions: "Open",
    submission_review: "Closed",
    ready: "Closed",
    complete: "Complete",
  };

  const subStatusLabel: Record<string, string> = {
    pending: "Submitted — Awaiting Review",
    approved: "Approved ✓",
    returned: "Returned — Revision Required",
    rejected: "Rejected",
  };

  const subStatusClass: Record<string, string> = {
    pending: styles.subPending,
    approved: styles.subApproved,
    returned: styles.subReturned,
    rejected: styles.subRejected,
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.badge}>Photo Showdown</div>
          <h1 className={styles.className}>{cls.name}</h1>
          <p className={styles.studentName}>{membership.display_name}</p>
        </div>
      </header>

      <main className={styles.main}>
        <h2 className={styles.sectionTitle}>Assignments</h2>

        {!assignments || assignments.length === 0 ? (
          <div className={styles.empty}>
            <p>No assignments yet. Check back soon.</p>
          </div>
        ) : (
          <ul className={styles.list} role="list">
            {assignments.map((a) => {
              const mySub = submissionByAssignment.get(a.id);
              const isOpen = a.status === "accepting_submissions";
              return (
                <li key={a.id} className={styles.item} id={`assignment-item-${a.id}`}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{a.title}</span>
                      {a.submission_deadline && (
                        <span className={styles.itemDeadline}>
                          Due{" "}
                          {new Date(a.submission_deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <span className={`${styles.openBadge} ${isOpen ? styles.openBadgeOpen : styles.openBadgeClosed}`}>
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </div>

                  {mySub ? (
                    <div className={styles.submissionRow}>
                      <span className={`${styles.subStatus} ${subStatusClass[mySub.status] ?? ""}`}>
                        {subStatusLabel[mySub.status] ?? mySub.status}
                      </span>
                      <div className={styles.itemActions}>
                        <Link
                          href={`/assignment/${a.share_token}/status`}
                          className={styles.viewBtn}
                          id={`view-status-${a.id}`}
                        >
                          View Status
                        </Link>
                        {mySub.status === "returned" && isOpen && (
                          <Link
                            href={`/assignment/${a.share_token}/submit`}
                            className={styles.submitBtn}
                            id={`resubmit-${a.id}`}
                          >
                            Resubmit
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.submissionRow}>
                      <span className={styles.notSubmitted}>Not yet submitted</span>
                      {isOpen && (
                        <Link
                          href={`/assignment/${a.share_token}/submit`}
                          className={styles.submitBtn}
                          id={`submit-${a.id}`}
                        >
                          Submit Photo
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
