/**
 * /account — Teacher account and profile management.
 *
 * Shows teacher profile info, allows updating display_name and school.
 * Provides sign-out action.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateTeacherProfile } from "@/lib/actions/profile";
import { Sidebar } from "@/components/Sidebar";
import styles from "./account.module.css";

export const metadata = {
  title: "Account — Photo Showdown",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, school, profile_complete, created_at")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const saved = params.saved === "1";

  return (
    <div className={styles.layout}>
      <Sidebar activePath="account" />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Settings</p>
            <h1 className={styles.title}>Account</h1>
          </div>
        </header>

        {/* Profile section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Teacher profile</h2>

          {saved && (
            <div className={styles.successBanner} role="status" aria-live="polite">
              ✓ Profile saved.
            </div>
          )}

          <form action={updateTeacherProfile as unknown as (fd: FormData) => void | Promise<void>} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label htmlFor="display_name" className={styles.label}>
                Display name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="display_name"
                name="display_name"
                className={styles.input}
                defaultValue={profile.display_name}
                required
                maxLength={80}
              />
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
                defaultValue={profile.school ?? ""}
                maxLength={120}
              />
            </div>

            <button type="submit" className={styles.saveBtn} id="save-profile-btn">
              Save changes
            </button>
          </form>
        </section>

        {/* Account info section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account information</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Account created</span>
              <span className={styles.infoValue}>
                {new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Sign-in method</span>
              <span className={styles.infoValue}>Magic Link</span>
            </div>
          </div>
        </section>

        {/* Sign-out */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sign out</h2>
          <p className={styles.signOutDesc}>
            You will be redirected to the sign-in page.
          </p>
          <form action="/api/auth/sign-out" method="POST">
            <button type="submit" className={styles.signOutBtn} id="account-sign-out-btn">
              Sign out of Photo Showdown
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
