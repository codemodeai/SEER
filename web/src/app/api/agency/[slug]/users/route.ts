import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendInviteEmail } from "@/lib/send-invite-email";
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

async function getAgencyAndAuth(slug: string, userId: string) {
  const admin = getSupabaseAdmin();

  const { data: agency } = await admin
    .from("agencies")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();

  if (!agency) return null;

  const isOwner = agency.owner_id === userId;

  if (!isOwner) {
    const { data: membership } = await admin
      .from("agency_users")
      .select("role")
      .eq("agency_id", agency.id)
      .eq("user_id", userId)
      .single();

    if (!membership || membership.role !== "admin") return null;
  }

  return agency;
}

// GET /api/agency/[slug]/users — list agency members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agency = await getAgencyAndAuth(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: members, error } = await admin
      .from("agency_users")
      .select(`
        user_id,
        role,
        assigned_plan,
        joined_at,
        users!inner(email, usage_this_month, seer_api_key)
      `)
      .eq("agency_id", agency.id)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("List members error:", error);
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }

    const formatted = (members ?? []).map((m: any) => {
      const key = m.users?.seer_api_key ?? "";
      return {
        user_id: m.user_id,
        email: m.users?.email ?? "",
        role: m.role,
        assigned_plan: m.assigned_plan,
        usage_this_month: m.users?.usage_this_month ?? 0,
        joined_at: m.joined_at,
        api_key_masked: key ? `${key.slice(0, 12)}...${key.slice(-4)}` : null,
        has_api_key: !!key,
        status: "active",
      };
    });

    // Also fetch pending invites
    const { data: pendingInvites } = await admin
      .from("agency_invites")
      .select("id, email, role, assigned_plan, created_at, status")
      .eq("agency_id", agency.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const inviteFormatted = (pendingInvites ?? []).map((inv: any) => ({
      user_id: null,
      email: inv.email,
      role: inv.role,
      assigned_plan: inv.assigned_plan,
      usage_this_month: 0,
      joined_at: inv.created_at,
      api_key_masked: null,
      has_api_key: false,
      status: "pending",
      invite_id: inv.id,
    }));

    return NextResponse.json({ members: [...formatted, ...inviteFormatted] });
  } catch (err) {
    console.error("Agency users GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/users — invite a user to the agency by email
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

    const agency = await getAgencyAndAuth(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = body.role === "admin" ? "admin" : "member";
    const assignedPlan = body.assigned_plan === "pro" ? "pro" : "starter";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check seat limit (count existing members + pending invites)
    const { count: memberCount } = await admin
      .from("agency_users")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);

    const { data: agencyData } = await admin
      .from("agencies")
      .select("max_users, name")
      .eq("id", agency.id)
      .single();

    if ((memberCount ?? 0) >= (agencyData?.max_users ?? 10)) {
      return NextResponse.json(
        { error: `Seat limit reached (${agencyData?.max_users ?? 10} max). Upgrade your plan for more seats.` },
        { status: 409 }
      );
    }

    // Check if already a member (by email in users → agency_users)
    const { data: targetUser } = await admin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (targetUser) {
      // Check if this user is the owner
      if (targetUser.id === agency.owner_id) {
        return NextResponse.json({ error: "The agency owner cannot be invited" }, { status: 400 });
      }

      // Check if already a member
      const { data: existingMember } = await admin
        .from("agency_users")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("user_id", targetUser.id)
        .single();

      if (existingMember) {
        return NextResponse.json({ error: "This user is already a member of the agency" }, { status: 409 });
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await admin
      .from("agency_invites")
      .select("id")
      .eq("agency_id", agency.id)
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: "An invite is already pending for this email" }, { status: 409 });
    }

    // Create invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { error: inviteErr } = await admin.from("agency_invites").insert({
      agency_id: agency.id,
      email,
      role,
      assigned_plan: assignedPlan,
      token,
      status: "pending",
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    });

    if (inviteErr) {
      console.error("Create invite error:", inviteErr);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    // Send invite email
    const { sent, inviteUrl } = await sendInviteEmail({
      to: email,
      agencyName: agencyData?.name ?? slug,
      role,
      inviterEmail: user.email ?? "",
      token,
    });

    return NextResponse.json({
      success: true,
      invited: true,
      emailSent: sent,
      inviteUrl: sent ? undefined : inviteUrl, // Only return URL if email wasn't sent (for manual sharing)
      member: {
        user_id: null,
        email,
        role,
        assigned_plan: assignedPlan,
        status: "pending",
      },
    });
  } catch (err) {
    console.error("Agency users POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/agency/[slug]/users — update a member's role or plan
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agency = await getAgencyAndAuth(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const targetUserId = String(body.user_id ?? "").trim();

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Verify target is a member
    const { data: membership } = await admin
      .from("agency_users")
      .select("id, role")
      .eq("agency_id", agency.id)
      .eq("user_id", targetUserId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "User is not a member of this agency" }, { status: 404 });
    }

    // Only owner can promote/demote admins
    const isOwner = agency.owner_id === user.id;
    if (body.role === "admin" && !isOwner) {
      return NextResponse.json({ error: "Only the owner can promote users to admin" }, { status: 403 });
    }
    if (membership.role === "admin" && !isOwner) {
      return NextResponse.json({ error: "Only the owner can modify admin users" }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    if (body.role !== undefined) {
      if (!["admin", "member"].includes(body.role)) {
        return NextResponse.json({ error: "Role must be admin or member" }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.assigned_plan !== undefined) {
      if (!["starter", "pro"].includes(body.assigned_plan)) {
        return NextResponse.json({ error: "Plan must be starter or pro" }, { status: 400 });
      }
      updates.assigned_plan = body.assigned_plan;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateErr } = await admin
      .from("agency_users")
      .update(updates)
      .eq("agency_id", agency.id)
      .eq("user_id", targetUserId);

    if (updateErr) {
      console.error("Update member error:", updateErr);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agency users PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/users — remove a member from the agency
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agency = await getAgencyAndAuth(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("user_id");

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    // Prevent removing the owner
    if (targetUserId === agency.owner_id) {
      return NextResponse.json({ error: "Cannot remove the agency owner" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Only owner can remove admins
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: target } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", targetUserId)
        .single();

      if (target?.role === "admin") {
        return NextResponse.json({ error: "Only the owner can remove admin users" }, { status: 403 });
      }
    }

    const { error: deleteErr } = await admin
      .from("agency_users")
      .delete()
      .eq("agency_id", agency.id)
      .eq("user_id", targetUserId);

    if (deleteErr) {
      console.error("Remove member error:", deleteErr);
      return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agency users DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
