"use client";

import { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  Receipt,
  Building2,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";

interface OverviewData {
  totalUsers: number;
  newUsersThisMonth: number;
  planBreakdown: Record<string, number>;
  mrr: number;
  revenueThisMonth: number;
  revenuePrevMonth: number;
  revenueGrowth: number;
  apiCallsThisMonth: number;
  apiCallsPrevMonth: number;
  apiCostThisMonth: number;
  monthlyExpenses: number;
  netProfit: number;
  churnRate: number;
  activeSubs: number;
  agencyCount: number;
}

function StatCard({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  href,
  color = "terracotta",
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  icon: typeof Users;
  href?: string;
  color?: string;
}) {
  const content = (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-5 hover:border-terracotta/30 transition-all group">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center`}>
          <Icon size={20} className={`text-${color}`} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend > 0 ? "text-accent-sage" : "text-terracotta"}`}>
            {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl text-charcoal">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
      {subValue && <p className="text-[10px] text-muted/70 mt-1">{subValue}</p>}
      {href && (
        <p className="text-[10px] text-terracotta font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/overview");
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted py-20">Failed to load overview data.</p>;
  }

  const apiCallsGrowth = data.apiCallsPrevMonth > 0
    ? ((data.apiCallsThisMonth - data.apiCallsPrevMonth) / data.apiCallsPrevMonth * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-charcoal">Admin Console</h1>
        <p className="text-sm text-muted mt-1">Real-time business overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={data.totalUsers.toLocaleString()}
          subValue={`+${data.newUsersThisMonth} this month`}
          icon={Users}
          href="/admin/users"
        />
        <StatCard
          label="Monthly Recurring Revenue"
          value={`$${data.mrr.toLocaleString()}`}
          subValue={`${data.activeSubs} active subs`}
          trend={data.revenueGrowth}
          icon={DollarSign}
          href="/admin/revenue"
        />
        <StatCard
          label="API Costs (This Month)"
          value={`$${data.apiCostThisMonth.toFixed(2)}`}
          subValue={`${data.apiCallsThisMonth.toLocaleString()} calls`}
          trend={-apiCallsGrowth}
          icon={Server}
          href="/admin/api-costs"
        />
        <StatCard
          label="Net Profit (This Month)"
          value={`$${data.netProfit.toFixed(2)}`}
          subValue={`Revenue $${data.revenueThisMonth.toFixed(2)} - Costs $${(data.apiCostThisMonth + data.monthlyExpenses).toFixed(2)}`}
          icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue (This Month)"
          value={`$${data.revenueThisMonth.toFixed(2)}`}
          subValue={`Last month: $${data.revenuePrevMonth.toFixed(2)}`}
          trend={data.revenueGrowth}
          icon={DollarSign}
          href="/admin/revenue"
        />
        <StatCard
          label="Churn Rate"
          value={`${data.churnRate.toFixed(1)}%`}
          subValue="Month-over-month"
          icon={Activity}
        />
        <StatCard
          label="Monthly Expenses"
          value={`$${data.monthlyExpenses.toFixed(2)}`}
          subValue="Recurring costs (DB, hosting, etc.)"
          icon={Receipt}
          href="/admin/expenses"
        />
        <StatCard
          label="Agencies"
          value={data.agencyCount.toString()}
          subValue="Active agency portals"
          icon={Building2}
        />
      </div>

      {/* Plan distribution */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
        <h3 className="font-display text-lg text-charcoal mb-4">User Distribution by Plan</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(data.planBreakdown).map(([plan, count]) => {
            const pct = data.totalUsers > 0 ? (count / data.totalUsers * 100).toFixed(1) : "0";
            const colors: Record<string, string> = {
              free: "bg-muted/20 text-muted",
              starter: "bg-accent-gold/20 text-accent-gold",
              pro: "bg-terracotta/20 text-terracotta",
              agency: "bg-charcoal/20 text-charcoal",
            };
            return (
              <div key={plan} className="text-center">
                <div className={`w-12 h-12 rounded-full ${colors[plan] ?? "bg-sand text-warm-brown"} flex items-center justify-center mx-auto mb-2`}>
                  <span className="font-bold text-sm">{count}</span>
                </div>
                <p className="text-sm font-semibold text-charcoal capitalize">{plan}</p>
                <p className="text-xs text-muted">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Manage Users", href: "/admin/users", icon: Users },
          { label: "Revenue Analytics", href: "/admin/revenue", icon: DollarSign },
          { label: "Track Expenses", href: "/admin/expenses", icon: Receipt },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 bg-ivory rounded-xl border border-sand/60 px-4 py-3 hover:border-terracotta/30 transition-all group"
          >
            <link.icon size={18} className="text-terracotta" />
            <span className="text-sm font-medium text-charcoal">{link.label}</span>
            <ArrowUpRight size={14} className="ml-auto text-muted group-hover:text-terracotta transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
