import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { JoinForm } from "./JoinForm";
import { SwitchStudentButton } from "./SwitchStudentButton";
import styles from "./join.module.css";
import Link from "next/link";

export const metadata = {
  title: "Join Class — Photo Showdown",
};

export default async function JoinPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const hasSession = user && user.is_anonymous;
  let displayName = "Student";

  if (hasSession) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("class_memberships")
      .select("display_name")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data?.display_name) {
      displayName = data.display_name;
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.filmBurn} aria-hidden="true" />
      
      <main className={styles.card}>
        <div className={styles.logo} aria-label="Photo Showdown">
          <span className={styles.logoShot}>PHOTO</span>
          <span className={styles.logoDivider}>⬡</span>
          <span className={styles.logoShowdown}>SHOWDOWN</span>
        </div>
        
        {hasSession ? (
          <div className={styles.returningSession}>
            <p className={styles.welcomeBack}>Welcome back, {displayName}</p>
            
            <div className={styles.actions}>
              <Link href="/my" className={styles.primaryAction}>
                Continue to My Classes
              </Link>
              
              <p className={styles.orDivider}>or</p>
              
              <div className={styles.joinNew}>
                <p>Join another class</p>
                <JoinForm hasSession={true} />
              </div>
            </div>

            <div style={{ marginTop: "2rem", textAlign: "center" }}>
              <SwitchStudentButton />
            </div>
          </div>
        ) : (
          <>
            <p className={styles.tagline}>Student Entry</p>
            <JoinForm />
            <div className={styles.footerLinks}>
              <Link href="/recover" className={styles.recoverLink}>
                Have a recovery code? Restoring an account?
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
