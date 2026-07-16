import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import styles from "./students.module.css";
import { GenerateRecoveryButton } from "./GenerateRecoveryButton";

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
  return { title: cls ? `${cls.name} Students — Photo Showdown` : "Students — Photo Showdown" };
}

export default async function ClassStudentsPage({
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

  // 1. Fetch Class
  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (clsError || !cls) {
    notFound();
  }

  // 2. Fetch Memberships
  const { data: memberships, error: memError } = await supabase
    .from("class_memberships")
    .select(`
      id,
      display_name,
      status,
      created_at
    `)
    .eq("class_id", classId)
    .order("display_name", { ascending: true });

  if (memError) {
    console.error("Failed to fetch students", memError);
  }

  return (
    <div className={styles.layout}>
      <Sidebar activePath="classes" />

      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/classes">Classes</a>
          <span aria-hidden="true">/</span>
          <a href={`/classes/${classId}`}>{cls.name}</a>
          <span aria-hidden="true">/</span>
          <span>Students</span>
        </nav>

        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Students in {cls.name}</h1>
          </div>
        </header>

        <section className={styles.rosterSection}>
          {(!memberships || memberships.length === 0) ? (
            <div className={styles.emptyState}>No students enrolled yet.</div>
          ) : (
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((mem) => (
                  <tr key={mem.id} className={mem.status !== 'active' ? styles.inactiveRow : ''}>
                    <td className={styles.nameCell}>{mem.display_name}</td>
                    <td>
                      <span className={`${styles.badge} ${styles['badge-' + mem.status]}`}>
                        {mem.status}
                      </span>
                    </td>
                    <td>
                      {new Date(mem.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric"
                      })}
                    </td>
                    <td>
                      {mem.status === 'active' && (
                        <GenerateRecoveryButton classMembershipId={mem.id} studentName={mem.display_name} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
