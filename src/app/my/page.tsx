import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./my.module.css";
import { SignOutButton } from "./SignOutButton";

export const metadata = {
  title: "My Classes — Photo Showdown",
};

export default async function StudentHome() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.is_anonymous) {
    // If not logged in, or is a teacher, redirect away
    redirect(user ? "/classes" : "/join");
  }

  // Fetch all active class memberships
  const { data: memberships } = await supabase
    .from("class_memberships")
    .select(`
      id,
      display_name,
      classes (
        id,
        name,
        teacher_id,
        profiles ( display_name )
      )
    `)
    .eq("student_id", user.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) {
    redirect("/join");
  }

  // Get the display name from the most recent membership or first one
  const displayName = memberships[0].display_name;

  // Extract class IDs for fetching assignments and submissions
  const classIds = memberships.map(m => m.classes.id);

  // Fetch all active assignments for these classes
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, class_id, status, submission_deadline, creative_intent_prompt")
    .in("class_id", classIds)
    .neq("status", "draft")
    .neq("status", "archived")
    .order("submission_deadline", { ascending: true });

  // Fetch all submissions for this student
  const { data: submissions } = await supabase
    .from("submissions")
    .select(`
      id,
      assignment_id,
      status,
      creative_intent,
      teacher_note,
      processed_url,
      created_at
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  // Map submissions by assignment
  const subMap = new Map();
  submissions?.forEach(sub => {
    subMap.set(sub.assignment_id, sub);
  });

  // Action Needed: Assignments without submissions OR returned submissions
  const actionNeeded = assignments?.filter(a => {
    const sub = subMap.get(a.id);
    if (!sub && a.status === 'accepting_submissions') return true;
    if (sub && sub.status === 'returned') return true;
    return false;
  }) || [];

  // My Work: Submissions that are submitted, approved, etc.
  const myWork = submissions?.filter(sub => sub.status !== 'returned') || [];

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.greeting}>
            <h1>Welcome back, {displayName}</h1>
          </div>
          <div className={styles.headerActions}>
            <Link href="/join" className={styles.secondaryBtn}>Join another class</Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>
          {/* Action Needed Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Action Needed</h2>
            {actionNeeded.length === 0 ? (
              <div className={styles.emptyCard}>You're all caught up!</div>
            ) : (
              <div className={styles.cardList}>
                {actionNeeded.map(a => {
                  const sub = subMap.get(a.id);
                  const cls = memberships.find(m => m.classes.id === a.class_id)?.classes;
                  return (
                    <Link href={`/assignment/${a.id}`} key={a.id} className={styles.actionCard}>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardClass}>{cls?.name}</span>
                        <h3 className={styles.cardTitle}>{a.title}</h3>
                        <span className={styles.cardDeadline}>
                          {a.submission_deadline ? `Due ${new Date(a.submission_deadline).toLocaleDateString()}` : 'No deadline'}
                        </span>
                      </div>
                      <div className={styles.cardStatus}>
                        {sub?.status === 'returned' ? (
                          <span className={styles.badgeReturned}>Returned</span>
                        ) : (
                          <span className={styles.badgePending}>Pending</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Classes Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>My Classes</h2>
            <div className={styles.cardList}>
              {memberships.map(m => (
                <div key={m.id} className={styles.classCard}>
                  <h3 className={styles.classTitle}>{m.classes.name}</h3>
                  <p className={styles.classTeacher}>Teacher: {m.classes.profiles?.display_name || "Unknown"}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* My Work Section */}
        <section className={styles.workSection}>
          <h2 className={styles.sectionTitle}>My Work</h2>
          {myWork.length === 0 ? (
            <div className={styles.emptyCard}>No completed work yet.</div>
          ) : (
            <div className={styles.workGrid}>
              {myWork.map(sub => {
                const a = assignments?.find(as => as.id === sub.assignment_id);
                const cls = memberships.find(m => m.classes.id === a?.class_id)?.classes;
                return (
                  <div key={sub.id} className={styles.workCard}>
                    {sub.processed_url ? (
                      <div className={styles.imageWrapper}>
                        <img src={sub.processed_url} alt="Submission" className={styles.workImage} />
                      </div>
                    ) : (
                      <div className={styles.placeholderImage}>Processing...</div>
                    )}
                    <div className={styles.workDetails}>
                      <span className={styles.workClass}>{cls?.name}</span>
                      <h3 className={styles.workTitle}>{a?.title || "Unknown Assignment"}</h3>
                      <p className={styles.workIntent}>"{sub.creative_intent}"</p>
                      
                      <div className={styles.workStatusRow}>
                        <span className={styles.workDate}>{new Date(sub.created_at).toLocaleDateString()}</span>
                        <span className={`${styles.badge} ${styles['badge-' + sub.status]}`}>
                          {sub.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {sub.teacher_note && (
                        <div className={styles.teacherNote}>
                          <strong>Note:</strong> {sub.teacher_note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
