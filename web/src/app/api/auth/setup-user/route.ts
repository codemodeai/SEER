import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function generateSeerApiKey(): string {
  return `sk-seer-${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user record already exists
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from("users")
      .select("id, seer_api_key")
      .eq("id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({
        seer_api_key: existing.seer_api_key,
        message: "User already exists",
      });
    }

    // Create user record with SEER API key
    const plan = user.user_metadata?.plan ?? "free";
    const seerApiKey = generateSeerApiKey();

    const { error } = await admin.from("users").insert({
      id: user.id,
      email: user.email,
      seer_api_key: seerApiKey,
      plan,
      usage_this_month: 0,
      ai_preference: "claude",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("User creation error:", error);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({ seer_api_key: seerApiKey, plan });
  } catch (err) {
    console.error("Setup user error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
