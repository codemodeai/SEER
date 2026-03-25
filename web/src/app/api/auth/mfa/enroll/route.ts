import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Enroll TOTP factor
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "SEER Authenticator",
    });

    if (error) {
      console.error("MFA enroll error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  } catch (err) {
    console.error("MFA enroll error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
