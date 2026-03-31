"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Loader2,
  TrendingUp,
  Users,
  Zap,
  Activity,
  Megaphone,
  Cloud,
  Lock,
} from "lucide-react";

interface AnalyticsData {
  totalCalls: number;
  totalTokensSaved: number;
  memberCount: number;
  activeNow: number;
  idleNow: number;
  announcementCount: number;
  projectCount: number;
  dailyChart: { date: string; calls: number }[];
  toolBreakdown: Record<string, number>;
  topUsers: { userId: string; email: string; calls: number; tokensSaved: number }[];
  range: string;
}

export default function AgencyAnalyticsPage() {
  const { agency, role } = useAgency();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");

  const canView = role === "owner" || role === "admin";

  const fetchAnalytics = useCallback(async () => {
    if (!agency) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agency.slug}/analytics?range=${range}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [agency, range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (!agency) return null;

  if (!canView) {
    return (
      <div className="text-center py-16">
        <Lock size={32} className="text-muted mx-auto mb-3" />
        <p className="text-sm text-muted">Analytics is available to agency admins only.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Analytics</h1>
          <p className="text-muted text-sm mt-1">
            Team usage metrics, trends, and performance insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-terracotta text-white"
                  : "bg-cream-dark text-muted hover:text-charcoal border border-sand/60"
              }`}
            >
              {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard icon={Zap} label="Total Calls" value={data.totalCalls.toLocaleString()} />
            <KpiCard icon={TrendingUp} label="Tokens Saved" value={data.totalTokensSaved.toLocaleString()} />
            <KpiCard icon={Users} label="Team Size" value={data.memberCount.toString()} />
            <KpiCard icon={Activity} label="Active Now" value={`${data.activeNow} active / ${data.idleNow} idle`} small />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <KpiCard icon={Cloud} label="Cloud Projects" value={data.projectCount.toString()} />
            <KpiCard icon={Megaphone} label="Announcements" value={data.announcementCount.toString()} />
            <KpiCard
              icon={BarChart3}
              label="Avg Calls / Day"
              value={
                data.dailyChart.length > 0
                  ? Math.round(data.totalCalls / data.dailyChart.length).toString()
                  : "0"
              }
            />
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-ivory border border-sand/60 rounded-2xl p-6 mb-8">
            <h2 className="font-display text-lg text-charcoal mb-4">Daily Usage</h2>
            {data.dailyChart.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No usage data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-[2px] min-w-[400px]" style={{ height: 160 }}>
                  {(() => {
                    const maxCalls = Math.max(...data.dailyChart.map((d) => d.calls), 1);
                    return data.dailyChart.map((d, i) => (
                      <div
                        key={d.date}
                        className="flex-1 group relative"
                        style={{ height: "100%" }}
                      >
                        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                          <div
                            className="w-full bg-terracotta/70 hover:bg-terracotta rounded-t transition-colors min-h-[2px]"
                            style={{
                              height: `${Math.max((d.calls / maxCalls) * 140, 2)}px`,
                            }}
                          />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                          <div className="bg-charcoal text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                            {d.date}: {d.calls} calls
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex justify-between mt-2 text-[9px] text-muted">
                  <span>{data.dailyChart[0]?.date}</span>
                  <span>{data.dailyChart[data.dailyChart.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>

          {/* Two-column: Tool Breakdown + Top Users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tool Breakdown */}
            <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
              <h2 className="font-display text-lg text-charcoal mb-4">Tool Usage</h2>
              {Object.keys(data.toolBreakdown).length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No tool usage data.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(data.toolBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tool, count]) => {
                      const maxCount = Math.max(...Object.values(data.toolBreakdown));
                      return (
                        <div key={tool}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-charcoal font-medium">{tool}</span>
                            <span className="text-xs text-muted">{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-sand overflow-hidden">
                            <div
                              className="h-full rounded-full bg-terracotta/70"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Top Users */}
            <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
              <h2 className="font-display text-lg text-charcoal mb-4">Top Users</h2>
              {data.topUsers.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No user data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-semibold tracking-widest uppercase text-muted">
                        <th className="text-left pb-3">User</th>
                        <th className="text-right pb-3">Calls</th>
                        <th className="text-right pb-3">Tokens Saved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand/30">
                      {data.topUsers.map((u, i) => (
                        <tr key={u.userId} className="hover:bg-cream-dark/50 transition-colors">
                          <td className="py-2.5 text-charcoal font-medium">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-terracotta/10 text-terracotta text-[10px] font-bold flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              {u.email.split("@")[0]}
                            </div>
                          </td>
                          <td className="py-2.5 text-right text-muted">{u.calls}</td>
                          <td className="py-2.5 text-right text-muted">{u.tokensSaved.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- KPI Card ---
function KpiCard({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: any;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-ivory border border-sand/60 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-terracotta" />
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">{label}</p>
      </div>
      <p className={`font-display text-charcoal ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
