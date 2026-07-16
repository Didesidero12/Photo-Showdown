"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateMatchup(sessionId: string, classId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "unauthorized" };
  }

  // Get the session
  const { data: session, error: sessionError } = await supabase
    .from("showdown_sessions")
    .select("id, assignment_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return { error: "session_not_found" };
  }

  if (session.status !== "active") {
    return { error: "invalid_status" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("class_memberships")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", user.id)
    .eq("status", "active")
    .single();

  if (membershipError || !membership) {
    return { error: "not_enrolled" };
  }

  // 1. Check if an active matchup already exists for this student and session
  const { data: existingMatchup } = await supabase
    .from("matchups")
    .select("id, submission_a_id, submission_b_id, completed_at")
    .eq("session_id", sessionId)
    .eq("critic_membership_id", membership.id)
    .single();

  if (existingMatchup && !existingMatchup.completed_at) {
    return { data: existingMatchup };
  }
  
  if (existingMatchup && existingMatchup.completed_at) {
    return { error: "already_completed" };
  }

  // We use the supabase service role client for complex balancing since we moved it to RPC
  // Wait, our RLS on submissions doesn't allow students to see other submissions, 
  // but RPC is SECURITY DEFINER and handles it. We can just call the RPC.
  const { data: newMatchupId, error: rpcError } = await supabase.rpc("assign_matchup_rpc", {
    p_session_id: sessionId,
    p_critic_membership_id: membership.id
  });

  if (rpcError || !newMatchupId) {
    console.error("RPC Error:", rpcError);
    if (rpcError?.message?.includes("Not enough eligible submissions")) return { error: "not_enough_submissions" };
    return { error: "pairing_failed" };
  }

  // Fetch the new matchup details to return
  const { data: newMatchup } = await supabase
    .from("matchups")
    .select("id, submission_a_id, submission_b_id")
    .eq("id", newMatchupId)
    .single();

  revalidatePath(`/assignment/[shareToken]`);
  return { data: newMatchup };
}

export function validateServerCritique(notice: string, effect: string): string | null {
  const nText = notice.trim();
  const eText = effect.trim();

  if (nText.length < 10) return "missing_notice";
  if (eText.length < 10) return "missing_effect";

  const genericPatterns = [
    /^(it )?looks (really )?good/i,
    /^(it is a )?cool photo(graph)?/i,
    /^(i )?like this( one)?/i,
    /^better lighting/i,
    /^the composition is good/i,
    /^this( one)? is better/i,
    /^nice/i,
    /^awesome/i
  ];

  for (const p of genericPatterns) {
    if (p.test(nText)) return "generic_notice";
    if (p.test(eText)) return "generic_effect";
  }

  if (nText.toLowerCase() === eText.toLowerCase()) {
    return "repeated_response";
  }

  return null;
}

export async function submitCritique(matchupId: string, selectedSubmissionId: string, notice: string, effect: string, lensType: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // 1. Verify the matchup belongs to the user and isn't completed
  const { data: matchup } = await supabase
    .from("matchups")
    .select("id, critic_membership_id, session_id, completed_at")
    .eq("id", matchupId)
    .single();

  if (!matchup) return { error: "matchup_not_found" };
  if (matchup.completed_at) return { error: "already_completed" };

  // We rely on RLS to ensure they own the membership, but let's be explicit
  const { data: membership } = await supabase
    .from("class_memberships")
    .select("id")
    .eq("id", matchup.critic_membership_id)
    .eq("student_id", user.id)
    .single();
    
  if (!membership) return { error: "unauthorized" };

  // Server-side Quality Validation
  const validationError = validateServerCritique(notice, effect);
  if (validationError) {
    await supabase.rpc("increment_session_coaching_trigger", { p_session_id: matchup.session_id, p_trigger_type: validationError });
    return { error: validationError };
  }

  // We must use admin client to update the matchup since students can't update matchups directly
  // Wait, RLS on critiques allows INSERT if active_critique and they own the matchup.
  // So we can insert the critique using the student's client!
  const { error: critiqueError } = await supabase
    .from("critiques")
    .insert({
      matchup_id: matchupId,
      selected_submission_id: selectedSubmissionId,
      lens_type: lensType,
      notice: notice,
      effect: effect
    });

  if (critiqueError) {
    console.error("Critique insertion failed:", critiqueError);
    return { error: critiqueError.message };
  }

  // Update matchup completed_at using admin
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdmin();
  await admin.from("matchups").update({ completed_at: new Date().toISOString() }).eq("id", matchupId);

  revalidatePath(`/assignment/[shareToken]`);
  return { success: true };
}
