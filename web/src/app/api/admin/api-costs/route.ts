import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, isAdmin } from "@/lib/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// Anthropic Haiku pricing: $0.25/MTok input, $1.25/MTok output
// Average: ~$0.001 per call (estimated)
const COST_PER_CALL = 0.001;

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // --- This month's API calls + cost ---
    const { data: monthLogs } = await admin
      .from("seer_logs")
      .select("tool_used, raw_tokens, optimized_tokens, tokens_saved, timestamp")
      .gte("timestamp", monthStart);

    const logs = monthLogs ?? [];
    const totalCalls = logs.length;
    const totalRawTokens = logs.reduce((s, l) => s + (l.raw_tokens ?? 0), 0);
    const totalOptimizedTokens = logs.reduce((s, l) => s + (l.optimized_tokens ?? 0), 0);
    const totalTokensSaved = logs.reduce((s, l) => s + (l.tokens_saved ?? 0), 0);
    const estimatedCost = totalCalls * COST_PER_CALL;

    // --- Tool breakdown ---
    const toolBreakdown: Record<string, { calls: number; cost: number }> = {};
    for (const log of logs) {
      const tool = log.tool_used ?? "unknown";
      if (!toolBreakdown[tool]) toolBreakdown[tool] = { calls: 0, cost: 0 };
      toolBreakdown[tool].calls++;
      toolBreakdown[tool].cost += COST_PER_CALL;
    }

    // --- Daily usage chart ---
    const dailyUsage: Record<string, number> = {};
    for (const log of logs) {
      const day = new Date(log.timestamp).toISOString().slice(0, 10);
      dailyUsage[day] = (dailyUsage[day] ?? 0) + 1;
    }
    const dailyChart: { date: string; calls: number; cost: number }[] = [];
    const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 10);
      const calls = dailyUsage[key] ?? 0;
      dailyChart.push({ date: key, calls, cost: calls * COST_PER_CALL });
      cursor.setDate(cursor.getDate() + 1);
    }

    // --- Monthly cost history (last 6 months) ---
    const monthlyCosts: { month: string; calls: number; cost: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const { count } = await admin
        .from("seer_logs")
        .select("id", { count: "exact", head: true })
        .gte("timestamp", start.toISOString())
        .lte("timestamp", end.toISOString());

      const calls = count ?? 0;
      monthlyCosts.push({ month: label, calls, cost: calls * COST_PER_CALL });
    }

    // --- Projected next month cost ---
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedCalls = dayOfMonth > 0 ? Math.round(totalCalls / dayOfMonth * daysInMonth) : 0;
    const projectedCost = projectedCalls * COST_PER_CALL;

    // --- Top users by API usage this month ---
    const userUsage: Record<string, number> = {};
    for (const log of logs) {
      userUsage[log.tool_used] = (userUsage[log.tool_used] ?? 0) + 1;
    }

    // Get per-user breakdown
    const userCallMap: Record<string, number> = {};
    for (const log of logs) {
      // seer_logs doesn't have user_id in our select, re-fetch
    }
    const { data: userLogs } = await admin
      .from("seer_logs")
      .select("user_id")
      .gte("timestamp", monthStart);

    const perUser: Record<string, number> = {};
    for (const log of userLogs ?? []) {
      perUser[log.user_id] = (perUser[log.user_id] ?? 0) + 1;
    }

    // Get top 10 users by calls
    const topUserIds = Object.entries(perUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid]) => uid);

    let topUsers: { email: string; calls: number; cost: number }[] = [];
    if (topUserIds.length > 0) {
      const { data: userData } = await admin
        .from("users")
        .select("id, email")
        .in("id", topUserIds);

      const emailMap: Record<string, string> = {};
      for (const u of userData ?? []) emailMap[u.id] = u.email;

      topUsers = topUserIds.map(uid => ({
        email: emailMap[uid] ?? "Unknown",
        calls: perUser[uid],
        cost: perUser[uid] * COST_PER_CALL,
      }));
    }

    return NextResponse.json({
      thisMonth: {
        totalCalls,
        totalRawTokens,
        totalOptimizedTokens,
        totalTokensSaved,
        estimatedCost,
      },
      projectedCalls,
      projectedCost,
      costPerCall: COST_PER_CALL,
      toolBreakdown,
      dailyChart,
      monthlyCosts,
      topUsers,
    });
  } catch (err) {
    console.error("Admin API costs error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
