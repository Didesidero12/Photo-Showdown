import Link from "next/link";
import styles from "./provisioning-error.module.css";

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  profiles_upsert_failed: {
    title: "Profile Setup Failed",
    detail:
      "We couldn't create your teacher profile. This is usually a temporary database issue. Please try signing in again.",
  },
  organization_insert_failed: {
    title: "Workspace Setup Failed",
    detail:
      "We couldn't create your Personal Workspace. Please try signing in again or contact support if the problem persists.",
  },
  membership_insert_failed: {
    title: "Membership Setup Failed",
    detail:
      "Your account was partially set up. Please try signing in again — the issue is usually self-correcting.",
  },
  anonymous_user_cannot_be_provisioned: {
    title: "Account Type Mismatch",
    detail:
      "This login is only for teacher accounts. If you're a student, use your class join code instead.",
  },
  unexpected_error: {
    title: "Something Went Wrong",
    detail:
      "An unexpected error occurred during account setup. Please try again or contact support.",
  },
};

const DEFAULT_ERROR = {
  title: "Account Setup Error",
  detail:
    "Something went wrong while setting up your account. Please try signing in again.",
};

export default async function ProvisioningErrorPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "unexpected_error";
  const { title, detail } = ERROR_MESSAGES[code] ?? DEFAULT_ERROR;

  return (
    <div className={styles.container}>
      <div className={styles.filmBurn} aria-hidden="true" />

      <main className={styles.card}>
        {/* Logo */}
        <div className={styles.logo} aria-label="Photo Showdown">
          <span className={styles.logoShot}>PHOTO</span>
          <span className={styles.logoDivider}>⬡</span>
          <span className={styles.logoShowdown}>SHOWDOWN</span>
        </div>

        {/* Error icon */}
        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.icon}>⚠</span>
        </div>

        <h1 className={styles.heading}>{title}</h1>
        <p className={styles.detail}>{detail}</p>

        {code !== "anonymous_user_cannot_be_provisioned" && (
          <p className={styles.codeLabel}>
            Error code: <code className={styles.code}>{code}</code>
          </p>
        )}

        <div className={styles.actions}>
          <Link href="/auth/sign-in" className={styles.primaryButton} id="try-again-link">
            Try Signing In Again
          </Link>

          {code === "anonymous_user_cannot_be_provisioned" && (
            <Link href="/join" className={styles.secondaryButton} id="join-class-link">
              Join a Class →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
