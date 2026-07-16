/**
 * Teacher dashboard — Milestone 1.
 *
 * Guards:
 *  1. Must be authenticated.
 *  2. Must have a complete profile (profile_complete = true).
 *  3. Must be provisioned (profile + org + membership).
 *
 * Empty state links to /classes/new for first-time teachers.
 * Class list is fetched and displayed when classes exist.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ensureTeacherProvisioned } from "@/lib/actions/provisioning";
import { Sidebar } from "@/components/Sidebar";
import styles from "./dashboard.module.css";

export const metadata = {
  title: "Dashboard — Photo Showdown",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/sign-in");
  }

  // Ensure provisioning is complete.
  const provision = await ensureTeacherProvisioned();
  if (!provision.ok) {
    redirect(`/auth/provisioning-error?code=${provision.error}`);
  }

  // Fetch teacher profile via authenticated client
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, profile_complete")
    .eq("id", user.id)
    .single();

  // Redirect to onboarding if profile is not yet complete.
  if (!profile?.profile_complete) {
    redirect("/onboarding");
  }

  const displayName = profile.display_name;

  // Fetch active classes for this teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, class_code, archived_at, created_at")
    .eq("teacher_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const hasClasses = (classes?.length ?? 0) > 0;

  return (
    <div className={styles.layout}>
      <Sidebar activePath="dashboard" />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.welcome}>Welcome back</p>
            <h1 className={styles.title}>{displayName}</h1>
          </div>
          {hasClasses && (
            <Link href="/classes/new" className={styles.createBtn} id="create-class-btn-header">
              + Create Class
            </Link>
          )}
        </header>

        {hasClasses ? (
          <section className={styles.classGrid} aria-label="Your classes">
            {classes!.map((cls) => (
              <Link key={cls.id} href={`/classes/${cls.id}`} className={styles.classCard} id={`class-card-${cls.id}`}>
                <div className={styles.classCode}>{cls.class_code}</div>
                <h2 className={styles.className}>{cls.name}</h2>
                <span className={styles.classArrow}>→</span>
              </Link>
            ))}
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
      </main>
    </div>
  );
}
