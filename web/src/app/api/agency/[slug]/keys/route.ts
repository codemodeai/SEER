import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

function generateSeerApiKey(): string {
  return `sk-seer-${crypto.randomBytes(24).toString("hex")}`;
}

async function getAuthUser() {
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
  return user;
}

// POST /api/agency/[slug]/keys — regenerate a member's API key
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify agency + admin access
    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();
      if (!membership || membership.role !== "admin") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await req.json();
    const targetUserId = String(body.user_id ?? "").trim();
    const action = body.action; // "regenerate" or "revoke"

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Verify target is a member of this agency
    const { data: membership } = await admin
      .from("agency_users")
      .select("id")
      .eq("agency_id", agency.id)
      .eq("user_id", targetUserId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "User is not a member of this agency" }, { status: 404 });
    }

    if (action === "revoke") {
      await admin
        .from("users")
        .update({ seer_api_key: null })
        .eq("id", targetUserId);

      return NextResponse.json({ success: true, action: "revoked" });
    } else {
      // Regenerate
      const newKey = generateSeerApiKey();
      await admin
        .from("users")
        .update({ seer_api_key: newKey })
        .eq("id", targetUserId);

      const masked = `${newKey.slice(0, 12)}...${newKey.slice(-4)}`;
      return NextResponse.json({ success: true, action: "regenerated", api_key_masked: masked });
    }
  } catch (err) {
    console.error("Agency keys error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
