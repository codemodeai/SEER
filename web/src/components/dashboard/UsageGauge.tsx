"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase-browser";

const PLAN_LIMITS: Record<string, number> = { free: 50, starter: 200, pro: 1000, agency: 99999 };

export default function UsageGauge() {
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(50);
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    async function fetchUsage() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users").select("plan").eq("id", user.id).single();
      if (data) {
        setPlan(data.plan);
        setLimit(PLAN_LIMITS[data.plan] ?? 50);
      }
      // Get real usage from seer_logs
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("seer_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("timestamp", monthStart);
      setUsed(count ?? 0);
    }
    fetchUsage();
  }, []);

  const pct = plan === "agency" ? 0 : Math.round((used / limit) * 100);
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (pct / 100) * circumference;

  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetStr = resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const gaugeColor = pct >= 90 ? "stroke-red-500" : pct >= 75 ? "stroke-amber-500" : "stroke-terracotta";
  const badgeColor = pct >= 90 ? "bg-red-500/10 text-red-600" : pct >= 75 ? "bg-amber-500/10 text-amber-600" : "bg-terracotta/10 text-terracotta";

  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
      <h3 className="text-sm font-semibold text-charcoal">Usage This Month</h3>
      <div className="mt-6 flex items-center justify-center">
        <div className="relative w-44 h-44">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" className="text-sand" strokeWidth="10" />
            <motion.circle cx="80" cy="80" r="70" fill="none" className={gaugeColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: "easeOut" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl text-charcoal">{plan === "agency" ? "∞" : `${pct}%`}</span>
            <span className="text-xs text-muted mt-0.5">{plan === "agency" ? "unlimited" : "used"}</span>
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Calls used</span>
          <span className="font-medium text-charcoal">{used.toLocaleString()} / {plan === "agency" ? "∞" : limit.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Remaining</span>
          <span className="font-medium text-charcoal">{plan === "agency" ? "Unlimited" : (limit - used).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Resets</span>
          <span className="font-medium text-charcoal">{resetStr}</span>
        </div>
      </div>
      {pct >= 80 && (
        <div className={`mt-5 px-4 py-3 rounded-xl ${badgeColor} text-center`}>
          <p className="text-xs font-semibold">
            {pct >= 90 ? "Almost at limit!" : "Running low"} — <a href="/dashboard/billing" className="underline">Upgrade plan</a>
          </p>
        </div>
      )}
    </div>
  );
}
