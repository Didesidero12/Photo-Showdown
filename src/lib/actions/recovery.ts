"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

/**
 * Generate an unambiguous 8-character code, excluding I, O, 0, 1
 */
function generateSecureCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    const randomIdx = crypto.randomInt(0, charset.length);
    code += charset[randomIdx];
  }
  // Format as XXXX-XXXX for readability
  return `${code.substring(0, 4)}-${code.substring(4)}`;
}

export async function generateRecoveryCode(classMembershipId: string) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Generate code and hash using HMAC with pepper
  const plaintextCode = generateSecureCode();
  const cleanCode = plaintextCode.replace("-", ""); 
  
  const pepper = process.env.RECOVERY_CODE_PEPPER;
  if (!pepper) {
    throw new Error("Server configuration error: Recovery pepper is missing");
  }

  const codeHash = crypto.createHmac("sha256", pepper).update(cleanCode).digest("hex");

  // 2. Set expiration to 30 mins
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  // 3. Get the user ID to record who created it
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    throw new Error("Unauthorized");
  }

  // 4. Invalidate any existing unused recovery codes for this membership
  // This ensures only one active recovery code per membership
  await supabase.from("recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("class_membership_id", classMembershipId)
    .is("used_at", null);

  // 5. Insert into database (RLS ensures they can only insert for their own classes)
  const { error } = await supabase.from("recovery_codes").insert({
    class_membership_id: classMembershipId,
    code_hash: codeHash,
    expires_at: expiresAt.toISOString(),
    created_by: user.id
  });

  if (error) {
    console.error("Failed to generate recovery code:", error);
    throw new Error("Failed to generate recovery code");
  }

  // 5. Return the plaintext code exactly once. We do not store it anywhere.
  return { code: plaintextCode };
}
