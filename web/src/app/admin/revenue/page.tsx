"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Loader2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface RevenueData {
  mrr: number;
  arr: number;
  mrrByPlan: Record<string, { count: number; revenue: number }>;
  totalRevenue: number;
  revenueByPlan: Record<string, number>;
  monthlyRevenue: { month: string; revenue: number; invoiceCount: number }[];
  churnData: { month: string; churnRate: number; churned: number }[];
  activeSubscriptions: number;
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("12m");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/revenue?range=${range}`);
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  if (!data) return <p className="text-center text-muted py-20">Failed to load revenue data.</p>;

  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Revenue & Billing</h1>
          <p className="text-sm text-muted mt-1">MRR, churn, and revenue analytics</p>
        </div>
        <div className="flex gap-1.5">
          {["3m", "6m", "12m"].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                range === r ? "bg-charcoal text-white border-charcoal" : "bg-ivory text-muted border-sand hover:border-charcoal/30"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <DollarSign size={20} className="text-terracotta" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">${data.mrr.toLocaleString()}</p>
          <p className="text-xs text-muted">Monthly Recurring Revenue</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-accent-sage/10 flex items-center justify-center">
            <TrendingUp size={20} className="text-accent-sage" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">${data.arr.toLocaleString()}</p>
          <p className="text-xs text-muted">Annual Run Rate</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-accent-gold" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">${data.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted">Total Revenue (All Time)</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-charcoal/10 flex items-center justify-center">
            <Users size={20} className="text-charcoal" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">{data.activeSubscriptions}</p>
          <p className="text-xs text-muted">Active Subscriptions</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
        <h3 className="font-display text-lg text-charcoal mb-4">Monthly Revenue</h3>
        <div className="flex items-end gap-1 h-48">
          {data.monthlyRevenue.map((m, i) => {
            const height = maxRevenue > 0 ? (m.revenue / maxRevenue * 100) : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-charcoal text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap z-10">
                  ${m.revenue.toFixed(2)} ({m.invoiceCount} invoices)
                </div>
                <div
                  className="w-full rounded-t-md bg-terracotta/70 hover:bg-terracotta transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(height, 1)}%` }}
                />
                <span className="text-[9px] text-muted truncate w-full text-center">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR by plan */}
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-4">MRR by Plan</h3>
          <div className="space-y-3">
            {Object.entries(data.mrrByPlan).map(([plan, info]) => {
              const pct = data.mrr > 0 ? (info.revenue / data.mrr * 100) : 0;
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-charcoal capitalize">{plan}</span>
                    <span className="text-sm text-muted">${info.revenue}/mo ({info.count} users)</span>
                  </div>
                  <div className="h-2 rounded-full bg-sand overflow-hidden">
                    <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Churn */}
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-4">Monthly Churn</h3>
          {data.churnData.length === 0 ? (
            <p className="text-sm text-muted">Not enough data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.churnData.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-sand/30 last:border-0">
                  <span className="text-sm text-charcoal">{c.month}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal">{c.churnRate}%</span>
                    {c.churned > 0 && (
                      <span className="text-xs text-muted">({c.churned} lost)</span>
                    )}
                    {c.churnRate > 5 ? (
                      <ArrowUpRight size={12} className="text-terracotta" />
                    ) : (
                      <ArrowDownRight size={12} className="text-accent-sage" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue by plan (all time) */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
        <h3 className="font-display text-lg text-charcoal mb-4">Revenue by Plan (All Time)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(data.revenueByPlan).map(([plan, rev]) => (
            <div key={plan} className="text-center bg-cream-dark rounded-xl p-4">
              <p className="font-display text-xl text-charcoal">${rev.toLocaleString()}</p>
              <p className="text-xs text-muted capitalize mt-1">{plan}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
