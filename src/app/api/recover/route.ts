import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // 1. Basic Rate Limiting (10 attempts per minute per IP)
    const rawIp = request.headers.get("x-forwarded-for") || "unknown";
    const ipSecret = process.env.IP_HMAC_SECRET || "default_secret";
    const hashedIp = crypto.createHmac("sha256", ipSecret).update(rawIp).digest("hex");
    
    if (!(await checkRateLimit(`recover_${hashedIp}`, 10, 60000))) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const { code } = await request.json();

    // 2. Format Validation
    // A8B2-9F3C (excluding I, O, 0, 1). Let's just strip hyphens and check length/chars.
    if (!code || typeof code !== "string") {
      return NextResponse.json({ ok: false, error: "invalid_format" }, { status: 400 });
    }
    const cleanCode = code.replace(/[^A-Z2-9]/gi, "").toUpperCase();
    if (cleanCode.length !== 8 || /[IO01]/.test(cleanCode)) {
      return NextResponse.json({ ok: false, error: "invalid_format" }, { status: 400 });
    }

    // 3. Hash the code using HMAC with pepper
    const pepper = process.env.RECOVERY_CODE_PEPPER;
    if (!pepper) {
      console.error("Missing RECOVERY_CODE_PEPPER");
      return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
    }
    const codeHash = crypto.createHmac("sha256", pepper).update(cleanCode).digest("hex");

    // 4. Session Verification or Creation
    const supabase = await createSupabaseServerClient();
    let { data: { user } } = await supabase.auth.getUser();

    // If there is an authenticated user with an email, reject!
    if (user && user.email) {
      return NextResponse.json({ ok: false, error: "teacher_account" }, { status: 403 });
    }

    if (!user) {
      // Create a new anonymous session. We use the admin client to provision and then we'll need to set the session for the caller.
      // Wait, `supabase.auth.signInAnonymously()` works directly on the server client and automatically sets cookies!
      const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError || !signInData.user) {
        return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });
      }
      user = signInData.user;
    }

    // 5. Call the atomic RPC to claim the recovery code
    const { data: claimData, error: claimError } = await supabase.rpc("claim_recovery_code", {
      provided_code_hash: codeHash,
    });

    if (claimError) {
      console.error("RPC Error:", claimError);
      return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
    }

    // claimData is JSONB returning { ok: boolean, error?: string, message?: string }
    const result = claimData as { ok: boolean; error?: string; message?: string } | null;
    
    if (!result || !result.ok) {
      return NextResponse.json({ ok: false, error: result?.error || "claim_failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (err) {
    console.error("Recovery API Error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
