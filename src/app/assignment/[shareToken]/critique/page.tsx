import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMatchup } from "@/lib/actions/critique";
import CritiqueClient from "./CritiqueClient";
import { WaitingRoom } from "./WaitingRoom";

export default async function CritiquePage(props: { params: Promise<{ shareToken: string }> }) {
  const params = await props.params;
  const shareToken = params.shareToken;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/assignment/${shareToken}`);
  }

  const admin = getSupabaseAdmin();
  // Fetch assignment ID first
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id")
    .eq("share_token", shareToken)
    .single();

  if (!assignment) {
    return <div>Assignment not found</div>;
  }

  // Fetch active session
  const { data: session } = await admin
    .from("showdown_sessions")
    .select("id, status")
    .eq("assignment_id", assignment.id)
    .eq("status", "active")
    .single();

  if (!session) {
    redirect(`/assignment/${shareToken}`);
  }

  // Generate or fetch active matchup
  const result = await generateMatchup(session.id, assignment.class_id);

  if (result.error) {
    if (result.error === "already_completed") {
      return <WaitingRoom />;
    }
    return (
      <div style={{ padding: "2rem", color: "var(--text-color)" }}>
        <h1>Unable to load matchup</h1>
        <p>Error: {result.error}</p>
        <a href={`/my`} style={{ color: "var(--primary-color)" }}>Return Home</a>
      </div>
    );
  }

  const matchup = result.data;
  
  // We need to fetch the actual image paths for the matchup since generateMatchup only returns IDs
  // We must use the admin client since students can't SELECT submissions directly without active_critique constraints.
  // Actually, students might be able to select them if the RLS allows, but it's safer to fetch them server-side here.
  
  const { data: submissionA } = await admin.from("submissions").select("id, storage_path_processed, creative_intent").eq("id", matchup.submission_a_id).single();
  const { data: submissionB } = await admin.from("submissions").select("id, storage_path_processed, creative_intent").eq("id", matchup.submission_b_id).single();

  // Sign the URLs so the client can display them
  // The storage_path_processed is just a relative path, we need public URLs or signed URLs.
  // Wait, in previous milestones, images are in `submissions-processed` which might be public or require signed URLs.
  // Let's assume we use createSignedUrl if it's private. Let's check how `my-status` does it.
  
  // We'll pass the paths to the client, and let the client request the images or we can pre-sign them.
  // We'll pre-sign them for simplicity.
  const { data: urlA } = await admin.storage.from("submissions-processed").createSignedUrl(submissionA.storage_path_processed, 3600);
  const { data: urlB } = await admin.storage.from("submissions-processed").createSignedUrl(submissionB.storage_path_processed, 3600);

  return (
    <CritiqueClient 
      matchupId={matchup.id}
      submissionA={{ id: submissionA.id, url: urlA?.signedUrl || "", intent: submissionA.creative_intent }}
      submissionB={{ id: submissionB.id, url: urlB?.signedUrl || "", intent: submissionB.creative_intent }}
    />
  );
}
