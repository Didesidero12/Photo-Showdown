/**
 * /classes/new — Create a new class.
 *
 * Security: class creation server action derives organization_id and
 * teacher_id entirely from the authenticated session — no client input
 * can override these values.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClass } from "@/lib/actions/classes";
import { Sidebar } from "@/components/Sidebar";
import styles from "./new.module.css";

export const metadata = {
  title: "Create Class — Photo Showdown",
};

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
    .select("profile_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const errorMessages: Record<string, string> = {
    name_required: "Class name is required.",
    name_too_long: "Class name must be 120 characters or fewer.",
    no_organization: "Your account is not associated with an organization. Please sign out and sign in again.",
    create_failed: "Something went wrong. Please try again.",
  };
  const errorMsg = params.error ? (errorMessages[params.error] ?? "An error occurred.") : null;

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />

      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span aria-hidden="true">/</span>
          <span>New</span>
        </nav>

        <header className={styles.header}>
          <h1 className={styles.title}>Create a class</h1>
          <p className={styles.subtitle}>
            A unique 6-character code will be generated automatically for student join links.
          </p>
        </header>

        <div className={styles.formWrap}>
          <form action={createClass as unknown as (fd: FormData) => void | Promise<void>} className={styles.form}>
            {errorMsg && (
              <div className={styles.errorBanner} role="alert" aria-live="polite">
                {errorMsg}
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="name" className={styles.label}>
                Class name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className={styles.input}
                placeholder="e.g. Photography I — Period 3"
                required
                maxLength={120}
                autoFocus
              />
            </div>

            <div className={styles.actions}>
              <a href="/classes" className={styles.cancelBtn}>Cancel</a>
              <button type="submit" className={styles.submitBtn} id="create-class-submit-btn">
                Create Class
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
