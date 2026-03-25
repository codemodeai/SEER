import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import QRCode from "qrcode";

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

    // Generate a proper PNG QR code from the otpauth:// URI
    // Supabase returns an SVG data URI which some scanners can't read
    const qrCodeDataUrl = await QRCode.toDataURL(data.totp.uri, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      factorId: data.id,
      qrCode: qrCodeDataUrl,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  } catch (err) {
    console.error("MFA enroll error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
