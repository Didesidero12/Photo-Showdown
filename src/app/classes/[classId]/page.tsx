/**
 * /classes/[classId] — Class detail page.
 *
 * Shows class name, code, student count, assignments list, and archive/unarchive action.
 * Only the teacher who owns the class can view it (RLS + server check).
 */
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

import { archiveClass, unarchiveClass } from "@/lib/actions/classes";
import { Sidebar } from "@/components/Sidebar";
import styles from "./classDetail.module.css";

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
  return { title: cls ? `${cls.name} — Photo Showdown` : "Class — Photo Showdown" };
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) {
    redirect("/onboarding");
  }

  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, name, class_code, archived_at, created_at, teacher_id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error || !cls) {
    notFound();
  }

  const isArchived = !!cls.archived_at;

  const { count: studentCount } = await supabase
    .from("class_memberships")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("status", "active");

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, status, submission_deadline, created_at")
    .eq("class_id", classId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  async function archiveAction() { "use server"; await archiveClass(classId); }
  async function unarchiveAction() { "use server"; await unarchiveClass(classId); }

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    accepting_submissions: "Accepting Submissions",
    submission_review: "Under Review",
    ready: "Ready",
    active_critique: "Critique",
    results_reveal: "Results",
    reflection: "Reflection",
    complete: "Complete",
    archived: "Archived",
  };

  const statusClass: Record<string, string> = {
    draft: styles.statusDraft,
    accepting_submissions: styles.statusAccepting,
    submission_review: styles.statusReview,
    ready: styles.statusReady,
    complete: styles.statusComplete,
  };

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />

      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span aria-hidden="true">/</span>
          <span>{cls.name}</span>
        </nav>

        {isArchived && (
          <div className={styles.archivedBanner} role="status">
            This class is archived and not visible to students.
          </div>
        )}

        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{cls.name}</h1>
            <p className={styles.createdDate}>
              Created{" "}
              {new Date(cls.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {isArchived ? (
            <form action={unarchiveAction}>
              <button type="submit" className={styles.unarchiveBtn} id="unarchive-class-btn">
                Restore Class
              </button>
            </form>
          ) : (
            <form action={archiveAction}>
              <button type="submit" className={styles.archiveBtn} id="archive-class-btn">
                Archive Class
              </button>
            </form>
          )}
        </header>

        <section className={styles.codeSection} aria-label="Class join code">
          <div className={styles.codeCard}>
            <p className={styles.codeLabel}>Student join code</p>
            <div className={styles.codeDisplay} id="class-code-display">
              {cls.class_code}
            </div>
            <p className={styles.codeHint}>Share this code with students to join the class.</p>
          </div>
        </section>

        <section className={styles.statsRow} aria-label="Class statistics">
          <Link href={`/classes/${classId}/students`} className={styles.statCard} style={{ textDecoration: 'none' }}>
            <span className={styles.statValue}>{studentCount ?? 0}</span>
            <span className={styles.statLabel}>Students enrolled</span>
          </Link>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{assignments?.length ?? 0}</span>
            <span className={styles.statLabel}>Assignments</span>
          </div>
        </section>

        <section className={styles.assignmentsSection} aria-label="Assignments">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Assignments</h2>
            {!isArchived && (
              <Link
                href={`/classes/${classId}/assignments/new`}
                className={styles.createBtn}
                id="create-assignment-btn"
              >
                + New Assignment
              </Link>
            )}
          </div>

          {!assignments || assignments.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden="true">⊡</div>
              <p className={styles.emptyText}>No assignments yet.</p>
              {!isArchived && (
                <Link href={`/classes/${classId}/assignments/new`} className={styles.emptyLink}>
                  Create your first assignment
                </Link>
              )}
            </div>
          ) : (
            <ul className={styles.assignmentList} role="list">
              {assignments.map((a) => (
                <li key={a.id} className={styles.assignmentItem}>
                  <Link
                    href={`/classes/${classId}/assignments/${a.id}`}
                    className={styles.assignmentLink}
                    id={`assignment-${a.id}`}
                  >
                    <div className={styles.assignmentInfo}>
                      <span className={styles.assignmentTitle}>{a.title}</span>
                      {a.submission_deadline && (
                        <span className={styles.assignmentDeadline}>
                          Due{" "}
                          {new Date(a.submission_deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <span className={`${styles.statusBadge} ${statusClass[a.status] ?? ""}`}>
                      {statusLabel[a.status] ?? a.status}
                    </span>
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
