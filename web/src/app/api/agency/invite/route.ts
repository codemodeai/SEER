import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

function generateSeerApiKey(): string {
  return `sk-seer-${crypto.randomBytes(24).toString("hex")}`;
}

// GET /api/agency/invite?token=xxx — get invite details (public, no auth needed)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: invite } = await admin
      .from("agency_invites")
      .select("id, agency_id, email, role, assigned_plan, status, expires_at, agencies!inner(name, slug)")
      .eq("token", token)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({
        error: invite.status === "accepted" ? "This invite has already been accepted" : "This invite has expired",
      }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await admin.from("agency_invites").update({ status: "expired" }).eq("id", invite.id);
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    const agency = (invite as any).agencies;

    return NextResponse.json({
      invite: {
        email: invite.email,
        role: invite.role,
        assignedPlan: invite.assigned_plan,
        agencyName: agency?.name ?? "Unknown Agency",
        agencySlug: agency?.slug ?? "",
      },
    });
  } catch (err) {
    console.error("Invite GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/invite — accept an invite (requires auth)
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

    const body = await req.json();
    const token = String(body.token ?? "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch invite
    const { data: invite } = await admin
      .from("agency_invites")
      .select("id, agency_id, email, role, assigned_plan, status, expires_at, invited_by")
      .eq("token", token)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invite is no longer valid" }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await admin.from("agency_invites").update({ status: "expired" }).eq("id", invite.id);
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // Verify email matches
    const userEmail = (user.email ?? "").toLowerCase();
    if (userEmail !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite was sent to ${invite.email}. Please log in with that email address.` },
        { status: 403 }
      );
    }

    // Check if user already a member
    const { data: existing } = await admin
      .from("agency_users")
      .select("id")
      .eq("agency_id", invite.agency_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Already a member — just mark invite accepted and redirect
      await admin.from("agency_invites").update({ status: "accepted" }).eq("id", invite.id);
      const { data: agency } = await admin
        .from("agencies")
        .select("slug")
        .eq("id", invite.agency_id)
        .single();
      return NextResponse.json({ success: true, agencySlug: agency?.slug });
    }

    // Ensure user has a record in users table (setup-user should have done this)
    const { data: userRecord } = await admin
      .from("users")
      .select("id, seer_api_key")
      .eq("id", user.id)
      .single();

    if (!userRecord) {
      return NextResponse.json(
        { error: "Account setup incomplete. Please visit your dashboard first, then try again." },
        { status: 400 }
      );
    }

    // Auto-generate API key if missing
    if (!userRecord.seer_api_key) {
      const apiKey = generateSeerApiKey();
      await admin.from("users").update({ seer_api_key: apiKey }).eq("id", user.id);
    }

    // Check seat limit
    const { data: agency } = await admin
      .from("agencies")
      .select("id, slug, max_users, owner_id")
      .eq("id", invite.agency_id)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency no longer exists" }, { status: 404 });
    }

    if (user.id === agency.owner_id) {
      await admin.from("agency_invites").update({ status: "accepted" }).eq("id", invite.id);
      return NextResponse.json({ success: true, agencySlug: agency.slug });
    }

    const { count: memberCount } = await admin
      .from("agency_users")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);

    if ((memberCount ?? 0) >= (agency.max_users ?? 10)) {
      return NextResponse.json({ error: "This agency has reached its member limit" }, { status: 409 });
    }

    // Add user to agency
    const { error: insertErr } = await admin.from("agency_users").insert({
      agency_id: invite.agency_id,
      user_id: user.id,
      role: invite.role,
      assigned_plan: "starter",
      invited_by: invite.invited_by,
    });

    // Upgrade user plan to agency (unlimited access) — stored on users table, not agency_users
    if (!insertErr) {
      await admin.from("users").update({ plan: "agency" }).eq("id", user.id);
    }

    if (insertErr) {
      console.error("Accept invite — insert error:", insertErr);
      return NextResponse.json({ error: "Failed to join agency" }, { status: 500 });
    }

    // Mark invite as accepted
    await admin.from("agency_invites").update({ status: "accepted" }).eq("id", invite.id);

    return NextResponse.json({ success: true, agencySlug: agency.slug });
  } catch (err) {
    console.error("Invite POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
