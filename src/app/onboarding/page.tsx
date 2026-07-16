/**
 * /onboarding — First-login profile completion for new teachers.
 *
 * Teachers land here after their first Magic Link confirmation.
 * Collects: display_name (required), school (optional).
 * Does NOT ask for a password.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeTeacherProfile } from "@/lib/actions/profile";
import styles from "./onboarding.module.css";

export const metadata = {
  title: "Welcome — Photo Showdown",
  description: "Complete your teacher profile to get started.",
};

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/sign-in");
  }

  // If profile is already complete, skip onboarding.
  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_complete")
    .eq("id", user.id)
    .single();

  if (profile?.profile_complete) {
    redirect("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoRow}>
          <span className={styles.logoMark}>PS</span>
          <span className={styles.logoText}>SHOWDOWN</span>
        </div>

        <div className={styles.headingGroup}>
          <h1 className={styles.heading}>Set up your profile</h1>
          <p className={styles.subheading}>
            This takes 30 seconds. You only do this once.
          </p>
        </div>

        <form action={completeTeacherProfile as unknown as (fd: FormData) => void | Promise<void>} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="display_name" className={styles.label}>
              Your name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              className={styles.input}
              placeholder="e.g. Ms. Rivera"
              required
              maxLength={80}
              autoFocus
              autoComplete="name"
            />
            <span className={styles.hint}>This is how students will see you.</span>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="school" className={styles.label}>
              School or program <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="text"
              id="school"
              name="school"
              className={styles.input}
              placeholder="e.g. Lincoln High School — Photography Dept."
              maxLength={120}
              autoComplete="organization"
            />
          </div>

          <button type="submit" className={styles.submitBtn} id="onboarding-submit-btn">
            Continue to dashboard →
          </button>
        </form>

        <p className={styles.footer}>
          Signed in as <span className={styles.email}>{user.email}</span>
        </p>
      </div>

      {/* Decorative background */}
      <div className={styles.backdrop} aria-hidden="true" />
    </div>
  );
}
