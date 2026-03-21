"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingDown, Percent, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  terracotta: { bg: "bg-terracotta/10", text: "text-terracotta", icon: "text-terracotta" },
  "accent-sage": { bg: "bg-accent-sage/10", text: "text-accent-sage", icon: "text-accent-sage" },
  "accent-gold": { bg: "bg-accent-gold/10", text: "text-accent-gold", icon: "text-accent-gold" },
};

const PLAN_LIMITS: Record<string, number> = { free: 50, starter: 200, pro: 1000, agency: 99999 };

export default function StatCards() {
  const [stats, setStats] = useState([
    { label: "Total Seer Calls", value: "0", change: "No calls yet", icon: Zap, color: "terracotta" },
    { label: "Tokens Saved", value: "0", change: "Start using SEER", icon: TrendingDown, color: "accent-sage" },
    { label: "Avg. Optimization", value: "0%", change: "—", icon: Percent, color: "accent-gold" },
    { label: "Plan Usage", value: "0 / 50", change: "50 remaining", icon: Activity, color: "terracotta" },
  ]);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users").select("plan").eq("id", user.id).single();

      const { data: logs } = await supabase
        .from("seer_logs").select("tokens_saved, pct_saved").eq("user_id", user.id);

      const totalCalls = logs?.length ?? 0;
      const totalSaved = logs?.reduce((s, l) => s + l.tokens_saved, 0) ?? 0;
      const avgPct = totalCalls > 0
        ? Math.round((logs?.reduce((s, l) => s + l.pct_saved, 0) ?? 0) / totalCalls) : 0;
      const plan = userData?.plan ?? "free";
      const limit = PLAN_LIMITS[plan] ?? 50;

      // Get real usage from seer_logs (current month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("seer_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("timestamp", monthStart);
      const usage = count ?? 0;

      setStats([
        { label: "Total Seer Calls", value: totalCalls.toLocaleString(), change: totalCalls > 0 ? `${plan} plan` : "No calls yet", icon: Zap, color: "terracotta" },
        { label: "Tokens Saved", value: totalSaved.toLocaleString(), change: totalSaved > 0 ? `~$${(totalSaved * 0.0015).toFixed(2)} saved` : "Start using SEER", icon: TrendingDown, color: "accent-sage" },
        { label: "Avg. Optimization", value: `${avgPct}%`, change: totalCalls > 0 ? `across ${totalCalls} calls` : "—", icon: Percent, color: "accent-gold" },
        { label: "Plan Usage", value: plan === "agency" ? `${usage} / ∞` : `${usage} / ${limit.toLocaleString()}`, change: plan === "agency" ? "Unlimited" : `${(limit - usage).toLocaleString()} remaining`, icon: Activity, color: "terracotta" },
      ]);
    }
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const c = colorMap[stat.color]!;
        return (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}
            className="bg-ivory rounded-2xl border border-sand/60 p-5 hover:shadow-md hover:shadow-charcoal/3 transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted tracking-wide">{stat.label}</p>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <stat.icon size={16} className={c.icon} />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl md:text-3xl text-charcoal tracking-tight">{stat.value}</p>
            <p className={`mt-1 text-xs font-medium ${c.text}`}>{stat.change}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
