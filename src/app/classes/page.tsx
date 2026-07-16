/**
 * /classes — Teacher class list.
 *
 * Shows active classes. Archived classes shown in a collapsed section.
 * RLS ensures teachers only see their own classes.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { Sidebar } from "@/components/Sidebar";
import styles from "./classes.module.css";

export const metadata = {
  title: "Classes — Photo Showdown",
};

export default async function ClassesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/sign-in");
  }

  // Check profile completion.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, profile_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) {
    redirect("/onboarding");
  }

  // Fetch active classes
  const { data: activeClasses } = await supabase
    .from("classes")
    .select("id, name, class_code, created_at")
    .eq("teacher_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  // Fetch archived classes.
  const { data: archivedClasses } = await supabase
    .from("classes")
    .select("id, name, class_code, archived_at")
    .eq("teacher_id", user.id)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  const hasActive = (activeClasses?.length ?? 0) > 0;
  const hasArchived = (archivedClasses?.length ?? 0) > 0;

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Teacher</p>
            <h1 className={styles.title}>Classes</h1>
          </div>
          <Link href="/classes/new" className={styles.createBtn} id="create-class-btn">
            + Create Class
          </Link>
        </header>

        {hasActive ? (
          <section className={styles.section} aria-label="Active classes">
            <div className={styles.classList}>
              {activeClasses!.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/classes/${cls.id}`}
                  className={styles.classRow}
                  id={`class-row-${cls.id}`}
                >
                  <div className={styles.classCode}>{cls.class_code}</div>
                  <div className={styles.classInfo}>
                    <span className={styles.className}>{cls.name}</span>
                    <span className={styles.classDate}>
                      Created {new Date(cls.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={styles.classArrow}>→</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">📷</div>
            <h2 className={styles.emptyTitle}>Your first class starts here</h2>
            <p className={styles.emptyDesc}>
              Create a class to organize assignments and invite students.
            </p>
            <Link href="/classes/new" className={styles.emptyBtn} id="create-class-btn-empty">
              Create Class
            </Link>
          </section>
        )}

        {hasArchived && (
          <details className={styles.archivedSection}>
            <summary className={styles.archivedToggle}>
              Archived classes ({archivedClasses!.length})
            </summary>
            <div className={styles.classList} style={{ marginTop: "var(--space-4)" }}>
              {archivedClasses!.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/classes/${cls.id}`}
                  className={`${styles.classRow} ${styles.classRowArchived}`}
                  id={`class-row-archived-${cls.id}`}
                >
                  <div className={styles.classCode}>{cls.class_code}</div>
                  <div className={styles.classInfo}>
                    <span className={styles.className}>{cls.name}</span>
                    <span className={styles.classDate}>Archived</span>
                  </div>
                  <span className={styles.classArrow}>→</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
