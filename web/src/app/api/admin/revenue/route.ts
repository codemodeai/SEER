import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, isAdmin } from "@/lib/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const range = req.nextUrl.searchParams.get("range") ?? "12m";

    // Determine how many months to look back
    const monthsBack = range === "6m" ? 6 : range === "3m" ? 3 : 12;
    const now = new Date();

    // --- Monthly revenue chart ---
    const monthlyRevenue: { month: string; revenue: number; invoiceCount: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const { data: invoices } = await admin
        .from("invoices")
        .select("amount_usd")
        .eq("status", "paid")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      const rev = (invoices ?? []).reduce((s, i) => s + (i.amount_usd ?? 0), 0);
      monthlyRevenue.push({ month: label, revenue: rev, invoiceCount: (invoices ?? []).length });
    }

    // --- Current MRR ---
    const { data: activeSubs } = await admin
      .from("subscriptions")
      .select("plan, user_id, provider")
      .eq("status", "active");

    const planPrices: Record<string, number> = { starter: 8, pro: 19, agency: 59 };
    let mrr = 0;
    const mrrByPlan: Record<string, { count: number; revenue: number }> = {};
    for (const s of activeSubs ?? []) {
      const price = planPrices[s.plan] ?? 0;
      mrr += price;
      if (!mrrByPlan[s.plan]) mrrByPlan[s.plan] = { count: 0, revenue: 0 };
      mrrByPlan[s.plan].count++;
      mrrByPlan[s.plan].revenue += price;
    }

    // --- Churn tracking (monthly) ---
    const churnData: { month: string; churnRate: number; churned: number }[] = [];
    for (let i = Math.min(monthsBack - 1, 5); i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i, 0, 23, 59, 59);
      const nextMStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = nextMStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      // Paid users in prev month
      const { data: prevPaid } = await admin
        .from("invoices")
        .select("user_id")
        .eq("status", "paid")
        .gte("created_at", mStart.toISOString())
        .lte("created_at", mEnd.toISOString());

      // Paid users in current month
      const { data: currPaid } = await admin
        .from("invoices")
        .select("user_id")
        .eq("status", "paid")
        .gte("created_at", nextMStart.toISOString())
        .lte("created_at", nextMEnd.toISOString());

      const prevIds = new Set((prevPaid ?? []).map(p => p.user_id));
      const currIds = new Set((currPaid ?? []).map(p => p.user_id));
      const churned = [...prevIds].filter(id => !currIds.has(id)).length;
      const rate = prevIds.size > 0 ? (churned / prevIds.size * 100) : 0;

      churnData.push({ month: label, churnRate: Math.round(rate * 10) / 10, churned });
    }

    // --- Revenue by provider ---
    const { data: allInvoices } = await admin
      .from("invoices")
      .select("amount_usd, plan, created_at")
      .eq("status", "paid");
    const totalRevenue = (allInvoices ?? []).reduce((s, i) => s + (i.amount_usd ?? 0), 0);

    // Revenue by plan (all time)
    const revenueByPlan: Record<string, number> = {};
    for (const inv of allInvoices ?? []) {
      revenueByPlan[inv.plan] = (revenueByPlan[inv.plan] ?? 0) + (inv.amount_usd ?? 0);
    }

    // ARR
    const arr = mrr * 12;

    return NextResponse.json({
      mrr,
      arr,
      mrrByPlan,
      totalRevenue,
      revenueByPlan,
      monthlyRevenue,
      churnData,
      activeSubscriptions: (activeSubs ?? []).length,
    });
  } catch (err) {
    console.error("Admin revenue error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
