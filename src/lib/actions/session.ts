"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Creates and starts a new Showdown Session for an assignment.
 * Freezes the submission pool by copying approved submissions to session_submissions.
 */
export async function startShowdownSession(
  assignmentId: string, 
  classId: string, 
  lensType: string,
  revealIntent: boolean,
  revealVotes: boolean
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // Verify teacher ownership
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, teacher_id")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!assignment) return { error: "assignment_not_found" };

  const admin = getSupabaseAdmin();

  // Find approved submissions
  const { data: eligibleSubmissions } = await admin
    .from("submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("status", "approved");

  if (!eligibleSubmissions || eligibleSubmissions.length < 3) {
    return { error: "not_enough_submissions" };
  }

  // Create Session
  const { data: session, error: sessionErr } = await admin
    .from("showdown_sessions")
    .insert({
      assignment_id: assignmentId,
      teacher_id: user.id,
      status: "active",
      lens_type: lensType,
      reveal_intent: revealIntent,
      reveal_votes: revealVotes,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    console.error("Session creation error:", sessionErr);
    return { error: "session_creation_failed" };
  }

  // Freeze the pool
  const sessionSubs = eligibleSubmissions.map(s => ({
    session_id: session.id,
    submission_id: s.id
  }));

  const { error: freezeErr } = await admin
    .from("session_submissions")
    .insert(sessionSubs);

  if (freezeErr) {
    console.error("Freeze error:", freezeErr);
    return { error: "pool_freeze_failed" };
  }

  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  return { data: session.id };
}

export async function transitionSessionStatus(sessionId: string, newStatus: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // Only the owning teacher can do this (enforced by RLS)
  const { error } = await supabase
    .from("showdown_sessions")
    .update({ 
      status: newStatus as any,
      closed_at: newStatus === "closed" ? new Date().toISOString() : undefined
    })
    .eq("id", sessionId)
    .eq("teacher_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/"); // Ideally targeted revalidate
  return { success: true };
}

export async function grantOverride(sessionId: string, classMembershipId: string, reason: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  // Verification that user owns the session is handled by RLS on session_participations
  const { error } = await supabase
    .from("session_participations")
    .upsert({
      session_id: sessionId,
      class_membership_id: classMembershipId,
      override_active: true,
      override_reason: reason,
      override_actor_id: user.id,
      override_timestamp: new Date().toISOString()
    }, { onConflict: "session_id,class_membership_id" });

  if (error) {
    console.error("Grant override error:", error);
    return { error: error.message };
  }
  revalidatePath(`/classes`);
  return { success: true };
}

export async function revokeOverride(sessionId: string, classMembershipId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { error } = await supabase
    .from("session_participations")
    .upsert({
      session_id: sessionId,
      class_membership_id: classMembershipId,
      override_active: false,
      override_actor_id: user.id,
      override_timestamp: new Date().toISOString()
    }, { onConflict: "session_id,class_membership_id" });

  if (error) return { error: error.message };
  revalidatePath(`/classes`);
  return { success: true };
}

export async function toggleCritiqueHidden(critiqueId: string, isHidden: boolean, reason?: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  const { error } = await supabase.rpc("toggle_critique_hidden", {
    p_critique_id: critiqueId,
    p_is_hidden: isHidden,
    p_reason: reason || null
  });

  if (error) {
    console.error("toggleCritiqueHidden err:", error);
    return { error: "failed_to_update" };
  }

  revalidatePath(`/classes/[classId]/assignments/[assignmentId]/showdown/[sessionId]/monitor`);
  return { success: true };
}
