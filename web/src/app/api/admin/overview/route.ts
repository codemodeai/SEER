import { NextResponse } from "next/server";
import { getAdminUser, isAdmin } from "@/lib/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Total users + by plan
    const { data: allUsers } = await admin.from("users").select("id, plan, usage_this_month, created_at");
    const users = allUsers ?? [];
    const totalUsers = users.length;
    const planBreakdown: Record<string, number> = {};
    for (const u of users) {
      planBreakdown[u.plan] = (planBreakdown[u.plan] ?? 0) + 1;
    }

    // New users this month
    const newUsersThisMonth = users.filter(u => u.created_at >= monthStart).length;

    // MRR calculation from active subscriptions
    const { data: subs } = await admin.from("subscriptions").select("plan, status").eq("status", "active");
    const planPrices: Record<string, number> = { starter: 8, pro: 19, agency: 59 };
    let mrr = 0;
    for (const s of subs ?? []) {
      mrr += planPrices[s.plan] ?? 0;
    }

    // Revenue this month (from invoices)
    const { data: monthInvoices } = await admin
      .from("invoices")
      .select("amount_usd")
      .eq("status", "paid")
      .gte("created_at", monthStart);
    const revenueThisMonth = (monthInvoices ?? []).reduce((s, i) => s + (i.amount_usd ?? 0), 0);

    // Revenue last month
    const { data: prevInvoices } = await admin
      .from("invoices")
      .select("amount_usd")
      .eq("status", "paid")
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd);
    const revenuePrevMonth = (prevInvoices ?? []).reduce((s, i) => s + (i.amount_usd ?? 0), 0);

    // Total API calls this month
    const { count: apiCallsThisMonth } = await admin
      .from("seer_logs")
      .select("id", { count: "exact", head: true })
      .gte("timestamp", monthStart);

    // Total API calls last month
    const { count: apiCallsPrevMonth } = await admin
      .from("seer_logs")
      .select("id", { count: "exact", head: true })
      .gte("timestamp", prevMonthStart)
      .lte("timestamp", prevMonthEnd);

    // Active expenses total monthly
    const { data: expenses } = await admin
      .from("admin_expenses")
      .select("amount_usd, frequency")
      .eq("is_active", true);
    let monthlyExpenses = 0;
    for (const e of expenses ?? []) {
      if (e.frequency === "monthly") monthlyExpenses += Number(e.amount_usd);
      else if (e.frequency === "annual") monthlyExpenses += Number(e.amount_usd) / 12;
    }

    // Haiku API cost estimate (based on calls * avg cost per call)
    const COST_PER_CALL = 0.001; // ~$0.001 per Haiku call
    const apiCostThisMonth = (apiCallsThisMonth ?? 0) * COST_PER_CALL;

    // Net profit
    const netProfit = revenueThisMonth - apiCostThisMonth - monthlyExpenses;

    // Churn: users who were on paid plan last month but are now free
    // Simple proxy: count paid invoices last month vs active subs now
    const { count: paidLastMonth } = await admin
      .from("invoices")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd);
    const activeSubs = (subs ?? []).length;
    const churnRate = (paidLastMonth ?? 0) > 0
      ? Math.max(0, ((paidLastMonth ?? 0) - activeSubs) / (paidLastMonth ?? 1) * 100)
      : 0;

    // Agencies count
    const { count: agencyCount } = await admin
      .from("agencies")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      totalUsers,
      newUsersThisMonth,
      planBreakdown,
      mrr,
      revenueThisMonth,
      revenuePrevMonth,
      revenueGrowth: revenuePrevMonth > 0 ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth * 100) : 0,
      apiCallsThisMonth: apiCallsThisMonth ?? 0,
      apiCallsPrevMonth: apiCallsPrevMonth ?? 0,
      apiCostThisMonth,
      monthlyExpenses,
      netProfit,
      churnRate,
      activeSubs,
      agencyCount: agencyCount ?? 0,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
