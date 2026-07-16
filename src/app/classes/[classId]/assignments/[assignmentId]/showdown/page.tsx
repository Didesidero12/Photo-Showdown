import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function MonitorPage(props: { params: Promise<{ classId: string; assignmentId: string }> }) {
  const { classId, assignmentId } = await props.params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) redirect("/auth/sign-in");

  // Verify teacher owns the class
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!cls) notFound();

  // Fetch assignment
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("id, title, status")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .maybeSingle();

  if (error || !assignment) notFound();

  // Get participation metrics
  // Total students enrolled
  const { count: totalStudents } = await supabase
    .from("class_memberships")
    .select("id", { count: "exact" })
    .eq("class_id", classId)
    .eq("status", "active");

  // Total completed matchups
  const { count: completedCritiques } = await supabase
    .from("matchups")
    .select("id", { count: "exact" })
    .eq("assignment_id", assignmentId)
    .not("completed_at", "is", null);

  // Fetch recent critiques for moderation feed
  const { data: recentCritiques } = await supabase
    .from("critiques")
    .select(`
      id, 
      justification, 
      lens_type, 
      created_at,
      matchups ( critic_membership_id, class_memberships(display_name) )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar activePath="classes" />
      <main style={{ flex: 1, padding: "2rem", background: "var(--background)" }}>
        <header style={{ marginBottom: "2rem" }}>
          <h1>Critique Monitoring: {assignment.title}</h1>
          <p>Phase: Quick Showdown</p>
          <a href={`/classes/${classId}/assignments/${assignmentId}`} style={{ color: "var(--primary-color)" }}>&larr; Back to Assignment</a>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem", background: "var(--background-alt)", borderRadius: "8px" }}>
            <h2>Participation Tracker</h2>
            <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "1rem" }}>
              {completedCritiques} / {totalStudents} 
            </div>
            <p>Students have completed their Quick Showdown critique.</p>
          </div>
          
          <div style={{ padding: "1.5rem", background: "var(--background-alt)", borderRadius: "8px" }}>
            <h2>Coverage Map Status</h2>
            <p style={{ marginTop: "1rem" }}>
              The dynamic pairing algorithm is actively balancing critiques across all approved submissions.
            </p>
          </div>
        </section>

        <section>
          <h2>Live Moderation Feed</h2>
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recentCritiques && recentCritiques.length > 0 ? (
              recentCritiques.map((c: any) => (
                <div key={c.id} style={{ padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--text-muted)" }}>
                    <strong>{c.matchups?.class_memberships?.display_name || "Unknown Student"}</strong>
                    <small>{new Date(c.created_at).toLocaleString()}</small>
                  </div>
                  <p><em>Lens: {c.lens_type}</em></p>
                  <p style={{ marginTop: "0.5rem" }}>"{c.justification}"</p>
                </div>
              ))
            ) : (
              <p>No critiques submitted yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
