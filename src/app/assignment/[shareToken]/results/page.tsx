import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResultsPage(props: { params: Promise<{ shareToken: string }> }) {
  const params = await props.params;
  const shareToken = params.shareToken;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/assignment/${shareToken}`);
  }

  // Use admin client since we need to check across tables safely
  const admin = getSupabaseAdmin();
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id")
    .eq("share_token", shareToken)
    .single();

  if (!assignment) return <div>Assignment not found</div>;

  const { data: session } = await admin
    .from("showdown_sessions")
    .select("id, status")
    .eq("assignment_id", assignment.id)
    .in("status", ["reveal", "closed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    redirect(`/assignment/${shareToken}`);
  }

  // Get student membership and submission
  const { data: membership } = await admin
    .from("class_memberships")
    .select("id")
    .eq("class_id", assignment.class_id)
    .eq("student_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect(`/assignment/${shareToken}`);

  const { data: submission } = await admin
    .from("submissions")
    .select("id, storage_path_processed, creative_intent")
    .eq("assignment_id", assignment.id)
    .eq("class_membership_id", membership.id)
    .single();

  // Give-to-Get verification
  const { count: completedCritiques } = await admin
    .from("matchups")
    .select("id", { count: "exact" })
    .eq("session_id", session.id)
    .eq("critic_membership_id", membership.id)
    .not("completed_at", "is", null);

  const { data: participation } = await admin
    .from("session_participations")
    .select("critiques_required, override_active")
    .eq("session_id", session.id)
    .eq("class_membership_id", membership.id)
    .maybeSingle();

  const required = participation?.critiques_required || 1;
  const isOverridden = participation?.override_active || false;
  const isUnlocked = (completedCritiques || 0) >= required || isOverridden;

  if (!isUnlocked) {
    return (
      <div style={{ maxWidth: "800px", margin: "4rem auto", padding: "2rem", background: "var(--background-alt)", borderRadius: "12px", textAlign: "center" }}>
        <h1 style={{ marginBottom: "1rem" }}>Results Locked</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          You did not complete your Quick Showdown critique during the active phase. In order to see the feedback you received, you must give feedback to others.
        </p>
        <a href={`/my`} style={{ padding: "1rem 2rem", background: "var(--primary-color)", color: "white", borderRadius: "8px", textDecoration: "none" }}>
          Return Home
        </a>
      </div>
    );
  }

  // Reveal Data
  // Student sees any matchup where their submission was A or B
  // AND the matchup is completed.
  const { data: matchups } = await admin
    .from("matchups")
    .select(`
      id,
      submission_a_id,
      submission_b_id,
      critiques (
        selected_submission_id,
        notice,
        effect,
        lens_type,
        is_hidden
      )
    `)
    .eq("session_id", session.id)
    .not("completed_at", "is", null)
    .or(`submission_a_id.eq.${mySubmission.id},submission_b_id.eq.${mySubmission.id}`);

  // Also fetch the session's reveal settings
  const revealSettings = {
    votes: session.reveal_votes || false,
    intent: session.reveal_intent || false,
    peerCritiques: session.reveal_peer_critiques || false,
    criticIdentity: session.reveal_critic_identity || false,
    photographerIdentity: session.reveal_photographer_identity || false
  };

  // Get image URL
  const { data: imgData } = mySubmission 
    ? await admin.storage.from("submissions-processed").createSignedUrl(mySubmission.storage_path_processed, 3600)
    : { data: null };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", color: "var(--text-color)" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1>Quick Showdown Results</h1>
        <p style={{ marginTop: "1rem" }}>
          Your photograph appeared in {matchups?.length || 0} peer matchups.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
        <div>
          {imgData?.signedUrl && (
            <img src={imgData.signedUrl} alt="Your Submission" style={{ width: "100%", borderRadius: "8px" }} />
          )}
          {revealSettings.intent && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-alt)", borderRadius: "8px" }}>
              <h3>Your Creative Intent</h3>
              <p>"{mySubmission?.creative_intent}"</p>
            </div>
          )}
        </div>

        <div>
          <h2>Peer Critiques</h2>
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {matchups && matchups.length > 0 ? (
              matchups.map(m => {
                const won = m.critiques?.[0]?.selected_submission_id === mySubmission.id;
                const isHidden = m.critiques?.[0]?.is_hidden;
                const noticeText = m.critiques?.[0]?.notice || "No text provided";
                const effectText = m.critiques?.[0]?.effect || "No text provided";
                const lens = m.critiques?.[0]?.lens_type || "lighting";

                return (
                  <div key={m.id} style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", color: won ? "var(--primary-color)" : "var(--text-muted)" }}>
                        {won ? "Won Matchup" : "Lost Matchup"}
                      </span>
                      <span style={{ textTransform: "capitalize", fontSize: "0.9rem" }}>Lens: {lens}</span>
                    </div>
                    {revealSettings.peerCritiques && !isHidden && (
                      <div style={{ marginTop: "1rem", fontStyle: "italic", color: "var(--text-color)" }}>
                        <p style={{ fontWeight: "bold", color: "var(--primary-color)" }}>Notice:</p>
                        <p>"{noticeText}"</p>
                        <p style={{ fontWeight: "bold", color: "var(--primary-color)", marginTop: "0.5rem" }}>Effect:</p>
                        <p>"{effectText}"</p>
                      </div>
                    )}
                    {revealSettings.peerCritiques && isHidden && (
                      <div style={{ marginTop: "1rem", fontStyle: "italic", color: "var(--text-muted)" }}>
                        Feedback hidden by teacher.
                      </div>
                    )}
                    {revealSettings.votes && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        (Vote revealed per session settings)
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p>Your photograph did not appear in any completed matchups.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
