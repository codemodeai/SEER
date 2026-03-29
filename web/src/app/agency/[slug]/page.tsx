"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Calendar,
  Shield,
  Zap,
  TrendingUp,
  Loader2,
  Key,
} from "lucide-react";

interface MemberUsage {
  user_id: string;
  email: string;
  role: string;
  assigned_plan: string;
  calls_this_month: number;
  tokens_saved: number;
  has_api_key: boolean;
}

interface AgencyStats {
  totalCalls: number;
  totalTokensSaved: number;
  memberCount: number;
  perMember: MemberUsage[];
  toolBreakdown: Record<string, number>;
}

export default function AgencyOverview() {
  const { agency, role } = useAgency();
  const [stats, setStats] = useState<AgencyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!agency) return;
    async function fetchStats() {
      try {
        const res = await fetch(`/api/agency/${agency!.slug}/stats`);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, [agency]);

  if (!agency) return null;

  const infoCards = [
    {
      label: "Members",
      value: agency.memberCount,
      sub: `of ${agency.maxUsers} max`,
      icon: Users,
    },
    {
      label: "Team Calls",
      value: statsLoading ? "..." : (stats?.totalCalls ?? 0).toLocaleString(),
      sub: "This month",
      icon: Zap,
    },
    {
      label: "Tokens Saved",
      value: statsLoading
        ? "..."
        : (stats?.totalTokensSaved ?? 0).toLocaleString(),
      sub: "This month",
      icon: TrendingUp,
    },
    {
      label: "Status",
      value: agency.status === "active" ? "Active" : "Suspended",
      sub: agency.status === "active" ? "Operational" : "Contact support",
      icon: Shield,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-charcoal">{agency.name}</h1>
        <p className="text-muted text-sm mt-1">
          Agency portal overview — manage your team and monitor activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {infoCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-ivory border border-sand/60 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-terracotta/10 flex items-center justify-center">
                <stat.icon size={18} className="text-terracotta" />
              </div>
              <span className="text-xs font-semibold tracking-widest uppercase text-muted">
                {stat.label}
              </span>
            </div>
            <p className="font-display text-2xl text-charcoal">{stat.value}</p>
            <p className="text-xs text-muted mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Member's own stats — for regular members */}
      {role === "member" && !statsLoading && stats?.perMember && (
        (() => {
          const me = stats.perMember.find((m) => m.has_api_key !== undefined);
          return me ? (
            <div className="bg-ivory border border-sand/60 rounded-2xl p-6 mb-8">
              <h2 className="font-display text-xl text-charcoal mb-4">Your Activity</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-cream-dark rounded-xl p-4 border border-sand/40">
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted">Calls This Month</p>
                  <p className="font-display text-2xl text-charcoal mt-1">{me.calls_this_month}</p>
                </div>
                <div className="bg-cream-dark rounded-xl p-4 border border-sand/40">
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted">Tokens Saved</p>
                  <p className="font-display text-2xl text-charcoal mt-1">{me.tokens_saved.toLocaleString()}</p>
                </div>
                <div className="bg-cream-dark rounded-xl p-4 border border-sand/40">
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted">Your Plan</p>
                  <p className="font-display text-2xl text-charcoal mt-1 capitalize">{me.assigned_plan}</p>
                </div>
              </div>
            </div>
          ) : null;
        })()
      )}

      {/* Member usage breakdown — admin/owner only */}
      {(role === "owner" || role === "admin") && (
        <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-sand/40">
            <h2 className="font-display text-xl text-charcoal">Member Usage</h2>
            <p className="text-xs text-muted mt-0.5">This month&apos;s activity per team member</p>
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : !stats?.perMember?.length ? (
            <div className="text-center py-12">
              <Users size={28} className="text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">No members yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand/60">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Member
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Role
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Plan
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Calls
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      Tokens Saved
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted">
                      API Key
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perMember.map((m) => (
                    <tr
                      key={m.user_id}
                      className="border-b border-sand/30 last:border-b-0 hover:bg-cream-dark/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-terracotta/15 flex items-center justify-center">
                            <span className="text-terracotta font-semibold text-[10px]">
                              {m.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-charcoal font-medium truncate max-w-[180px]">
                            {m.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="capitalize text-muted text-xs">{m.role}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="capitalize text-charcoal text-xs">{m.assigned_plan}</span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-charcoal">
                        {m.calls_this_month}
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {m.tokens_saved.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {m.has_api_key ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-accent-sage font-semibold">
                            <Key size={10} /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted/50 italic">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tool usage breakdown */}
      {(role === "owner" || role === "admin") && stats?.toolBreakdown && Object.keys(stats.toolBreakdown).length > 0 && (
        <div className="bg-ivory border border-sand/60 rounded-2xl p-6 mb-8">
          <h2 className="font-display text-xl text-charcoal mb-4">Tool Usage</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.toolBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([tool, count]) => (
                <div
                  key={tool}
                  className="px-4 py-2.5 bg-cream-dark rounded-xl border border-sand/40"
                >
                  <p className="text-xs font-semibold text-charcoal">{tool}</p>
                  <p className="text-lg font-display text-terracotta">{count}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {(role === "owner" || role === "admin") && (
        <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
          <h2 className="font-display text-xl text-charcoal mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/agency/${agency.slug}/users`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Users size={16} />
              Manage Users
            </a>
            <a
              href={`/agency/${agency.slug}/keys`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
            >
              <Key size={16} />
              API Keys
            </a>
            <a
              href={`/agency/${agency.slug}/settings`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
            >
              <Building2 size={16} />
              Agency Settings
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
