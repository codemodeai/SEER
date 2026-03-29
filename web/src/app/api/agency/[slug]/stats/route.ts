import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET /api/agency/[slug]/stats — aggregate usage stats for agency
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

    // Verify access (owner or member)
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get all member user IDs
    const { data: members } = await admin
      .from("agency_users")
      .select("user_id, role, assigned_plan, users!inner(email, usage_this_month, seer_api_key)")
      .eq("agency_id", agency.id);

    const memberIds = (members ?? []).map((m: any) => m.user_id);

    // Include owner in stats
    const allUserIds = [agency.owner_id, ...memberIds];

    // Get current month usage per member from seer_logs
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: logs } = await admin
      .from("seer_logs")
      .select("user_id, tokens_saved, tool_used")
      .in("user_id", allUserIds)
      .gte("timestamp", monthStart);

    // Aggregate stats
    const totalCalls = logs?.length ?? 0;
    const totalTokensSaved = (logs ?? []).reduce((sum: number, l: any) => sum + (l.tokens_saved ?? 0), 0);

    // Per-member breakdown
    const perMember = (members ?? []).map((m: any) => {
      const memberLogs = (logs ?? []).filter((l: any) => l.user_id === m.user_id);
      return {
        user_id: m.user_id,
        email: m.users?.email ?? "",
        role: m.role,
        assigned_plan: m.assigned_plan,
        usage_this_month: m.users?.usage_this_month ?? 0,
        calls_this_month: memberLogs.length,
        tokens_saved: memberLogs.reduce((s: number, l: any) => s + (l.tokens_saved ?? 0), 0),
        has_api_key: !!m.users?.seer_api_key,
      };
    });

    // Tool usage breakdown
    const toolBreakdown: Record<string, number> = {};
    for (const log of logs ?? []) {
      toolBreakdown[log.tool_used] = (toolBreakdown[log.tool_used] ?? 0) + 1;
    }

    return NextResponse.json({
      totalCalls,
      totalTokensSaved,
      memberCount: members?.length ?? 0,
      perMember,
      toolBreakdown,
    });
  } catch (err) {
    console.error("Agency stats error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
