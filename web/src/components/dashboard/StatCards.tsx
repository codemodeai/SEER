"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingDown, Percent, Activity } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  terracotta: { bg: "bg-terracotta/10", text: "text-terracotta", icon: "text-terracotta" },
  "accent-sage": { bg: "bg-accent-sage/10", text: "text-accent-sage", icon: "text-accent-sage" },
  "accent-gold": { bg: "bg-accent-gold/10", text: "text-accent-gold", icon: "text-accent-gold" },
};

const PLAN_LIMITS: Record<string, number> = { free: 50, starter: 200, pro: 1000, agency: 99999 };

export default function StatCards() {
  const { userId, plan, usage } = useDashboard();
  const [stats, setStats] = useState([
    { label: "Total Seer Calls", value: "0", change: "No calls yet", icon: Zap, color: "terracotta" },
    { label: "Tokens Saved", value: "0", change: "Start using SEER", icon: TrendingDown, color: "accent-sage" },
    { label: "Avg. Optimization", value: "0%", change: "—", icon: Percent, color: "accent-gold" },
    { label: "Plan Usage", value: "0 / 50", change: "50 remaining", icon: Activity, color: "terracotta" },
  ]);

  useEffect(() => {
    if (!userId) return;

    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/logs");
        if (!res.ok) return;
        const data = await res.json();
        const logs = data.allLogs ?? [];

        const totalCalls = logs.length;
        const totalSaved = logs.reduce((s: number, l: { tokens_saved: number }) => s + l.tokens_saved, 0);
        const avgPct = totalCalls > 0
          ? Math.round(logs.reduce((s: number, l: { pct_saved: number }) => s + l.pct_saved, 0) / totalCalls) : 0;
        const limit = PLAN_LIMITS[plan] ?? 50;

        setStats([
          { label: "Total Seer Calls", value: totalCalls.toLocaleString(), change: totalCalls > 0 ? `${plan} plan` : "No calls yet", icon: Zap, color: "terracotta" },
          { label: "Tokens Saved", value: totalSaved.toLocaleString(), change: totalSaved > 0 ? `~$${(totalSaved * 0.0015).toFixed(2)} saved` : "Start using SEER", icon: TrendingDown, color: "accent-sage" },
          { label: "Avg. Optimization", value: `${avgPct}%`, change: totalCalls > 0 ? `across ${totalCalls} calls` : "—", icon: Percent, color: "accent-gold" },
          { label: "Plan Usage", value: plan === "agency" ? `${usage} / ∞` : `${usage} / ${limit.toLocaleString()}`, change: plan === "agency" ? "Unlimited" : `${(limit - usage).toLocaleString()} remaining`, icon: Activity, color: "terracotta" },
        ]);
      } catch (err) {
        console.error("StatCards: failed to fetch", err);
      }
    }
    fetchStats();
  }, [userId, plan, usage]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, i) => {
        const c = colorMap[stat.color]!;
        return (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}
            className="bg-ivory rounded-xl sm:rounded-2xl border border-sand/60 p-3 sm:p-5 hover:shadow-md hover:shadow-charcoal/3 transition-shadow">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-xs font-medium text-muted tracking-wide truncate">{stat.label}</p>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                <stat.icon size={12} className={`sm:w-4 sm:h-4 ${c.icon}`} />
              </div>
            </div>
            <p className="mt-2 sm:mt-3 font-display text-lg sm:text-2xl md:text-3xl text-charcoal tracking-tight truncate">{stat.value}</p>
            <p className={`mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-medium ${c.text} truncate`}>{stat.change}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
