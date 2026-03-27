"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase-browser";
import { useDashboard } from "@/lib/dashboard-context";

interface LogEntry {
  id: string;
  timestamp: string;
  raw_input: string | null;
  surface: string;
  raw_tokens: number;
  optimized_tokens: number;
  pct_saved: number;
}

const surfaceBadge: Record<string, string> = {
  terminal: "bg-charcoal/10 text-charcoal",
  vscode: "bg-blue-500/10 text-blue-600",
  desktop: "bg-purple-500/10 text-purple-600",
  web: "bg-terracotta/10 text-terracotta",
  unknown: "bg-sand text-muted",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function RecentCalls() {
  const { userId } = useDashboard();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!userId) return;

    async function fetchLogs() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("seer_logs")
        .select("id, timestamp, raw_input, surface, raw_tokens, optimized_tokens, pct_saved")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(10);

      if (error) {
        console.error("RecentCalls: failed to fetch logs", error);
        return;
      }
      if (data) setLogs(data);
    }
    fetchLogs();
  }, [userId]);

  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-6 overflow-hidden">
      <h3 className="text-sm font-semibold text-charcoal mb-4">Recent Calls</h3>

      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted">
          No calls yet. Your recent SEER calls will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-sand/60">
                <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted pb-3 pr-4">Time</th>
                <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted pb-3 pr-4">Input</th>
                <th className="text-left text-[10px] font-semibold tracking-widest uppercase text-muted pb-3 pr-4">Surface</th>
                <th className="text-right text-[10px] font-semibold tracking-widest uppercase text-muted pb-3 pr-4">Before</th>
                <th className="text-right text-[10px] font-semibold tracking-widest uppercase text-muted pb-3 pr-4">After</th>
                <th className="text-right text-[10px] font-semibold tracking-widest uppercase text-muted pb-3">Saved</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="border-b border-sand/30 last:border-0 hover:bg-cream-dark/50 transition-colors">
                  <td className="py-3 pr-4 text-xs text-muted whitespace-nowrap">{timeAgo(log.timestamp)}</td>
                  <td className="py-3 pr-4 text-sm text-charcoal max-w-[260px] truncate">{log.raw_input ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${surfaceBadge[log.surface] ?? surfaceBadge.unknown}`}>
                      {log.surface}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted text-right font-mono">{log.raw_tokens}</td>
                  <td className="py-3 pr-4 text-xs text-charcoal text-right font-mono">{log.optimized_tokens}</td>
                  <td className="py-3 text-xs font-semibold text-accent-sage text-right font-mono">-{Math.round(log.pct_saved)}%</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
