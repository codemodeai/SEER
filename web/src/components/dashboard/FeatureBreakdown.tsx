"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDashboard } from "@/lib/dashboard-context";

const TOOL_COLORS: Record<string, string> = {
  seer_run: "bg-terracotta",
  seer_optimize: "bg-accent-gold",
  seer_workflow: "bg-accent-sage",
  seer_status: "bg-warm-brown-light",
};

interface ToolStat { name: string; calls: number; color: string }

export default function FeatureBreakdown() {
  const { userId } = useDashboard();
  const [tools, setTools] = useState<ToolStat[]>([]);

  useEffect(() => {
    if (!userId) return;

    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/logs");
        if (!res.ok) return;
        const data = await res.json();
        const logs = data.allLogs ?? [];

        if (logs.length === 0) return;

        const counts: Record<string, number> = {};
        logs.forEach((l: { tool_used: string }) => { counts[l.tool_used] = (counts[l.tool_used] ?? 0) + 1; });

        const sorted = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .map(([name, calls]) => ({
            name,
            calls,
            color: TOOL_COLORS[name] ?? "bg-terracotta/50",
          }));

        setTools(sorted);
      } catch (err) {
        console.error("FeatureBreakdown: failed to fetch", err);
      }
    }
    fetchData();
  }, [userId]);

  const total = tools.reduce((s, t) => s + t.calls, 0);

  if (tools.length === 0) {
    return (
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <h3 className="text-sm font-semibold text-charcoal mb-6">Feature Breakdown</h3>
        <div className="flex items-center justify-center h-24 text-sm text-muted">
          No usage data yet.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
      <h3 className="text-sm font-semibold text-charcoal mb-6">Feature Breakdown</h3>
      <div className="space-y-4">
        {tools.map((tool, i) => {
          const pct = Math.round((tool.calls / total) * 100);
          return (
            <div key={tool.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-mono text-charcoal">{tool.name}</span>
                <span className="text-xs text-muted">{tool.calls} calls ({pct}%)</span>
              </div>
              <div className="h-2.5 rounded-full bg-cream-dark overflow-hidden">
                <motion.div className={`h-full rounded-full ${tool.color}`} initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
