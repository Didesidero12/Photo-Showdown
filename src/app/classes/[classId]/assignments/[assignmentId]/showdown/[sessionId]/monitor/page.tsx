import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import MonitorClient from "./MonitorClient";
import { OverrideControls } from "./OverrideControls";
import { HideCritiqueButton } from "./HideCritiqueButton";

export default async function MonitorPage(props: { params: Promise<{ classId: string; assignmentId: string; sessionId: string }> }) {
  const { classId, assignmentId, sessionId } = await props.params;

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

  // Fetch session
  const { data: session, error } = await supabase
    .from("showdown_sessions")
    .select(`
      id, status, assignment_id, pilot_analytics, assignments!inner(title)
    `)
    .eq("id", sessionId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error || !session) notFound();

  // Get participation metrics
  const { count: totalStudents } = await supabase
    .from("class_memberships")
    .select("id", { count: "exact" })
    .eq("class_id", classId)
    .eq("status", "active");

  const { count: completedCritiques } = await supabase
    .from("matchups")
    .select("id", { count: "exact" })
    .eq("session_id", sessionId)
    .not("completed_at", "is", null);

  // Fetch recent critiques for moderation feed
  const { data: recentCritiques } = await supabase
    .from("critiques")
    .select(`
      id, 
      notice,
      effect, 
      lens_type, 
      created_at,
      is_hidden,
      hidden_reason,
      matchups!inner ( critic_membership_id )
    `)
    // Because we're using a single query, joining class_memberships cleanly via matchups can be tricky in PostgREST
    // We will do a separate fetch for names or let the client do it if needed.
    // For simplicity, we just fetch the data and we'll format it.
    .order("created_at", { ascending: false })
    .limit(50);
    
  // Since we want display names, let's just fetch all active memberships and map them
  const { data: memberships } = await supabase
    .from("class_memberships")
    .select("id, display_name")
    .eq("class_id", classId);
    
  const namesMap = new Map(memberships?.map(m => [m.id, m.display_name]) || []);

  const formattedCritiques = recentCritiques?.map((c: any) => ({
    ...c,
    studentName: namesMap.get(c.matchups.critic_membership_id) || "Unknown Student"
  })) || [];

  // Fetch overrides
  const { data: participations } = await supabase
    .from("session_participations")
    .select("class_membership_id, override_active")
    .eq("session_id", sessionId);
    
  const overrideMap = new Map(participations?.map(p => [p.class_membership_id, p.override_active]) || []);

  const studentList = memberships?.map(m => ({
    id: m.id,
    name: m.display_name,
    hasOverride: !!overrideMap.get(m.id)
  })) || [];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar activePath="classes" />
      <main style={{ flex: 1, padding: "2rem", background: "var(--background)" }}>
        <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Live Monitor: {session.assignments.title}</h1>
            <p>Phase: Quick Showdown ({session.status})</p>
            <a href={`/classes/${classId}/assignments/${assignmentId}`} style={{ color: "var(--primary-color)" }}>&larr; Back to Assignment</a>
          </div>
          <MonitorClient sessionId={sessionId} currentStatus={session.status} />
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
              The dynamic pairing algorithm is actively balancing critiques across the frozen pool of eligible submissions.
            </p>
          </div>

          <div style={{ padding: "1.5rem", background: "var(--background-alt)", borderRadius: "8px" }}>
            <h2>Pilot Analytics</h2>
            <div style={{ marginTop: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}><strong>Missing Effect Triggers:</strong> {(session.pilot_analytics as any)?.coaching_triggers?.missing_effect || 0}</p>
                <p style={{ margin: 0, fontSize: "0.9rem" }}><strong>Too Short Triggers:</strong> {(session.pilot_analytics as any)?.coaching_triggers?.too_short || 0}</p>
                <p style={{ margin: 0, fontSize: "0.9rem" }}><strong>Generic Praise Triggers:</strong> {(session.pilot_analytics as any)?.coaching_triggers?.generic_praise || 0}</p>
                <p style={{ margin: 0, fontSize: "0.9rem" }}><strong>Repeated Response Triggers:</strong> {(session.pilot_analytics as any)?.coaching_triggers?.repeated_response || 0}</p>
            </div>
          </div>
        </section>

        <OverrideControls sessionId={sessionId} students={studentList} />

        <section style={{ marginTop: "2rem" }}>
          <h2>Live Moderation Feed</h2>
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {formattedCritiques.length > 0 ? (
              formattedCritiques.map((c: any) => (
                <div key={c.id} style={{ padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "8px", opacity: c.is_hidden ? 0.5 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "var(--text-muted)" }}>
                    <strong>{c.studentName}</strong>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                      <small>{new Date(c.created_at).toLocaleString()}</small>
                      <HideCritiqueButton critiqueId={c.id} initialHidden={c.is_hidden} />
                    </div>
                  </div>
                  {c.is_hidden && (
                    <div style={{ padding: "0.5rem", marginBottom: "0.5rem", background: "var(--error-color)", color: "white", borderRadius: "4px", fontSize: "0.9rem" }}>
                      <strong>Hidden:</strong> {c.hidden_reason}
                    </div>
                  )}
                  <p><em>Notice:</em> {c.notice}</p>
                  <p style={{ marginTop: "0.5rem" }}><em>Effect:</em> {c.effect}</p>
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
