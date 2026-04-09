import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, isAdmin } from "@/lib/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET all users with details
export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const search = req.nextUrl.searchParams.get("search") ?? "";
    const planFilter = req.nextUrl.searchParams.get("plan") ?? "";
    const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
    const limit = 50;
    const offset = (page - 1) * limit;

    let query = admin
      .from("users")
      .select("id, email, name, plan, usage_this_month, created_at, seer_api_key, country, mfa_verified, onboarding_completed, fs_access", { count: "exact" });

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }
    if (planFilter) {
      query = query.eq("plan", planFilter);
    }

    const { data: users, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Get subscription info for each user
    const userIds = (users ?? []).map(u => u.id);
    const { data: subs } = await admin
      .from("subscriptions")
      .select("user_id, provider, plan, status, current_period_end")
      .in("user_id", userIds)
      .eq("status", "active");

    const subMap: Record<string, any> = {};
    for (const s of subs ?? []) {
      subMap[s.user_id] = s;
    }

    // Get usage this month for each user
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: usageLogs } = await admin
      .from("seer_logs")
      .select("user_id")
      .in("user_id", userIds)
      .gte("timestamp", monthStart);

    const usageMap: Record<string, number> = {};
    for (const log of usageLogs ?? []) {
      usageMap[log.user_id] = (usageMap[log.user_id] ?? 0) + 1;
    }

    const enrichedUsers = (users ?? []).map(u => ({
      ...u,
      subscription: subMap[u.id] ?? null,
      actualUsage: usageMap[u.id] ?? 0,
    }));

    return NextResponse.json({
      users: enrichedUsers,
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH update user plan or details
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { userId, plan } = await req.json();
    if (!userId || !plan) {
      return NextResponse.json({ error: "Missing userId or plan" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await admin.from("users").update({ plan }).eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
