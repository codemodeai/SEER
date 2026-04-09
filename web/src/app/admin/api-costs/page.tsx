"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Loader2,
  TrendingUp,
  Zap,
  DollarSign,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";

interface ApiCostData {
  thisMonth: {
    totalCalls: number;
    totalRawTokens: number;
    totalOptimizedTokens: number;
    totalTokensSaved: number;
    estimatedCost: number;
  };
  projectedCalls: number;
  projectedCost: number;
  costPerCall: number;
  toolBreakdown: Record<string, { calls: number; cost: number }>;
  dailyChart: { date: string; calls: number; cost: number }[];
  monthlyCosts: { month: string; calls: number; cost: number }[];
  topUsers: { email: string; calls: number; cost: number }[];
}

export default function AdminApiCostsPage() {
  const [data, setData] = useState<ApiCostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/api-costs");
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-terracotta" />
      </div>
    );
  }

  if (!data) return <p className="text-center text-muted py-20">Failed to load API cost data.</p>;

  const maxDailyCalls = Math.max(...data.dailyChart.map(d => d.calls), 1);
  const maxMonthlyCost = Math.max(...data.monthlyCosts.map(m => m.cost), 0.01);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-charcoal">API Costs & Usage</h1>
        <p className="text-sm text-muted mt-1">Anthropic Haiku API usage tracking and cost projection</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <DollarSign size={20} className="text-terracotta" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">${data.thisMonth.estimatedCost.toFixed(2)}</p>
          <p className="text-xs text-muted">Cost This Month</p>
          <p className="text-[10px] text-muted/70 mt-0.5">${data.costPerCall}/call avg</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
            <TrendingUp size={20} className="text-accent-gold" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">${data.projectedCost.toFixed(2)}</p>
          <p className="text-xs text-muted">Projected Next Month</p>
          <p className="text-[10px] text-muted/70 mt-0.5">~{data.projectedCalls.toLocaleString()} calls</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-accent-sage/10 flex items-center justify-center">
            <Zap size={20} className="text-accent-sage" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">{data.thisMonth.totalCalls.toLocaleString()}</p>
          <p className="text-xs text-muted">API Calls This Month</p>
        </div>
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <div className="w-10 h-10 rounded-xl bg-charcoal/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-charcoal" />
          </div>
          <p className="mt-3 font-display text-2xl text-charcoal">{data.thisMonth.totalTokensSaved.toLocaleString()}</p>
          <p className="text-xs text-muted">Tokens Saved This Month</p>
        </div>
      </div>

      {/* Token stats */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
        <h3 className="font-display text-lg text-charcoal mb-3">Token Usage Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-cream-dark rounded-xl p-4 text-center">
            <p className="font-display text-xl text-charcoal">{data.thisMonth.totalRawTokens.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">Raw Tokens (Input)</p>
          </div>
          <div className="bg-cream-dark rounded-xl p-4 text-center">
            <p className="font-display text-xl text-charcoal">{data.thisMonth.totalOptimizedTokens.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">Optimized Tokens (Output)</p>
          </div>
          <div className="bg-cream-dark rounded-xl p-4 text-center">
            <p className="font-display text-xl text-accent-sage">{data.thisMonth.totalTokensSaved.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">Tokens Saved</p>
          </div>
        </div>
      </div>

      {/* Daily usage chart */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
        <h3 className="font-display text-lg text-charcoal mb-4">Daily API Calls (This Month)</h3>
        <div className="flex items-end gap-px h-40">
          {data.dailyChart.map((d, i) => {
            const height = (d.calls / maxDailyCalls * 100);
            const day = new Date(d.date).getDate();
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-charcoal text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-10">
                  {d.calls} calls (${d.cost.toFixed(3)})
                </div>
                <div
                  className="w-full rounded-t-sm bg-terracotta/60 hover:bg-terracotta transition-colors min-h-[1px]"
                  style={{ height: `${Math.max(height, 0.5)}%` }}
                />
                {(day === 1 || day % 5 === 0) && (
                  <span className="text-[8px] text-muted mt-1">{day}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly cost history */}
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-4">Monthly Cost History</h3>
          <div className="space-y-2">
            {data.monthlyCosts.map((m, i) => {
              const pct = (m.cost / maxMonthlyCost * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-charcoal">{m.month}</span>
                    <span className="text-sm font-medium text-charcoal">${m.cost.toFixed(2)} ({m.calls.toLocaleString()} calls)</span>
                  </div>
                  <div className="h-2 rounded-full bg-sand overflow-hidden">
                    <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tool breakdown */}
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-4">Cost by Tool</h3>
          <div className="space-y-2">
            {Object.entries(data.toolBreakdown)
              .sort(([, a], [, b]) => b.calls - a.calls)
              .map(([tool, info]) => (
                <div key={tool} className="flex items-center justify-between py-2 border-b border-sand/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{tool}</p>
                    <p className="text-xs text-muted">{info.calls.toLocaleString()} calls</p>
                  </div>
                  <span className="text-sm font-semibold text-charcoal">${info.cost.toFixed(3)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Top users by API usage */}
      {data.topUsers.length > 0 && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
          <h3 className="font-display text-lg text-charcoal mb-4">Top Users by API Usage</h3>
          <div className="divide-y divide-sand/30">
            {data.topUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-terracotta/10 flex items-center justify-center text-xs font-bold text-terracotta">
                    {i + 1}
                  </span>
                  <span className="text-sm text-charcoal">{u.email}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-charcoal">{u.calls.toLocaleString()} calls</p>
                  <p className="text-xs text-muted">${u.cost.toFixed(3)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
