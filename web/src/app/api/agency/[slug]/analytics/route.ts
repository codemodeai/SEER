import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET /api/agency/[slug]/analytics — detailed analytics for agency admin
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get agency
    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Verify owner or admin
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();

      if (!membership || membership.role === "member") {
        return NextResponse.json({ error: "Only owner/admin can view analytics" }, { status: 403 });
      }
    }

    // Get all member IDs
    const { data: members } = await admin
      .from("agency_users")
      .select("user_id, role, assigned_plan, users!inner(email)")
      .eq("agency_id", agency.id);

    const memberIds = (members ?? []).map((m: any) => m.user_id);
    const allUserIds = [agency.owner_id, ...memberIds];

    // Parse date range from query params
    const range = req.nextUrl.searchParams.get("range") ?? "30d";
    const now = new Date();
    let rangeStart: Date;
    switch (range) {
      case "7d":
        rangeStart = new Date(now.getTime() - 7 * 86400000);
        break;
      case "90d":
        rangeStart = new Date(now.getTime() - 90 * 86400000);
        break;
      default:
        rangeStart = new Date(now.getTime() - 30 * 86400000);
    }

    // Fetch logs in range
    const { data: logs } = await admin
      .from("seer_logs")
      .select("user_id, tool_used, tokens_saved, timestamp")
      .in("user_id", allUserIds)
      .gte("timestamp", rangeStart.toISOString())
      .order("timestamp", { ascending: true });

    const allLogs = logs ?? [];

    // --- Aggregate metrics ---

    // 1. Total calls & tokens saved
    const totalCalls = allLogs.length;
    const totalTokensSaved = allLogs.reduce((s: number, l: any) => s + (l.tokens_saved ?? 0), 0);

    // 2. Daily usage (calls per day for chart)
    const dailyUsage: Record<string, number> = {};
    for (const log of allLogs) {
      const day = new Date(log.timestamp).toISOString().slice(0, 10);
      dailyUsage[day] = (dailyUsage[day] ?? 0) + 1;
    }
    // Fill gaps
    const dailyChart: { date: string; calls: number }[] = [];
    const cursor = new Date(rangeStart);
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 10);
      dailyChart.push({ date: key, calls: dailyUsage[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // 3. Tool breakdown
    const toolBreakdown: Record<string, number> = {};
    for (const log of allLogs) {
      toolBreakdown[log.tool_used] = (toolBreakdown[log.tool_used] ?? 0) + 1;
    }

    // 4. Top users by calls
    const userCallMap: Record<string, number> = {};
    const userTokenMap: Record<string, number> = {};
    for (const log of allLogs) {
      userCallMap[log.user_id] = (userCallMap[log.user_id] ?? 0) + 1;
      userTokenMap[log.user_id] = (userTokenMap[log.user_id] ?? 0) + (log.tokens_saved ?? 0);
    }

    // Build email lookup
    const emailMap: Record<string, string> = {};
    for (const m of members ?? []) {
      emailMap[m.user_id] = (m as any).users?.email ?? "Unknown";
    }
    // Owner email
    if (!emailMap[agency.owner_id]) {
      const { data: ownerData } = await admin
        .from("users")
        .select("email")
        .eq("id", agency.owner_id)
        .single();
      emailMap[agency.owner_id] = ownerData?.email ?? "Owner";
    }

    const topUsers = Object.entries(userCallMap)
      .map(([uid, calls]) => ({
        userId: uid,
        email: emailMap[uid] ?? "Unknown",
        calls,
        tokensSaved: userTokenMap[uid] ?? 0,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    // 5. Activity stats (current)
    const { data: activityData } = await admin
      .from("agency_activity")
      .select("status")
      .eq("agency_id", agency.id);

    const activeNow = (activityData ?? []).filter((a: any) => a.status === "active").length;
    const idleNow = (activityData ?? []).filter((a: any) => a.status === "idle").length;

    // 6. Announcement count
    const { count: announcementCount } = await admin
      .from("agency_announcements")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);

    // 7. Cloud memory projects count
    const { count: projectCount } = await admin
      .from("agency_projects")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);

    return NextResponse.json({
      totalCalls,
      totalTokensSaved,
      memberCount: (members?.length ?? 0) + 1, // +1 for owner
      activeNow,
      idleNow,
      announcementCount: announcementCount ?? 0,
      projectCount: projectCount ?? 0,
      dailyChart,
      toolBreakdown,
      topUsers,
      range,
    });
  } catch (err) {
    console.error("Agency analytics error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
