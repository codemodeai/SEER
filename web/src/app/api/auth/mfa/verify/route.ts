import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { factorId, code } = await req.json();

    if (!factorId || !code) {
      return NextResponse.json({ error: "Missing factorId or code" }, { status: 400 });
    }

    // Create challenge
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      console.error("MFA challenge error:", challengeError);
      return NextResponse.json({ error: challengeError.message }, { status: 400 });
    }

    // Verify the TOTP code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Mark user as MFA verified in our users table (lifetime flag)
    const admin = getSupabaseAdmin();
    await admin
      .from("users")
      .update({ mfa_verified: true })
      .eq("id", user.id);

    return NextResponse.json({ success: true, message: "MFA enabled successfully" });
  } catch (err) {
    console.error("MFA verify error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
