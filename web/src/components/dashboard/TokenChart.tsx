"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase-browser";
import { useDashboard } from "@/lib/dashboard-context";

interface CallData {
  id: string;
  raw_tokens: number;
  optimized_tokens: number;
  raw_input: string | null;
}

export default function TokenChart() {
  const { userId } = useDashboard();
  const [calls, setCalls] = useState<CallData[]>([]);

  useEffect(() => {
    if (!userId) return;

    async function fetchCalls() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("seer_logs")
        .select("id, raw_tokens, optimized_tokens, raw_input")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(10);

      if (error) {
        console.error("TokenChart: failed to fetch calls", error);
        return;
      }
      if (data) setCalls(data);
    }
    fetchCalls();
  }, [userId]);

  if (calls.length === 0) {
    return (
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <h3 className="text-sm font-semibold text-charcoal mb-6">Messy vs Optimized</h3>
        <div className="flex items-center justify-center h-36 text-sm text-muted">
          No calls yet. Start using SEER to see optimization comparisons.
        </div>
      </div>
    );
  }

  const maxTokens = Math.max(...calls.map((c) => c.raw_tokens));

  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-charcoal">Messy vs Optimized — Last {calls.length} Calls</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/70" />Raw</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent-sage" />Optimized</span>
        </div>
      </div>
      <div className="space-y-3">
        {calls.map((call, i) => {
          const pctSaved = call.raw_tokens > 0 ? Math.round(((call.raw_tokens - call.optimized_tokens) / call.raw_tokens) * 100) : 0;
          return (
            <motion.div key={call.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }} className="group">
              <div className="flex items-center gap-3">
                <span className="w-28 text-xs text-muted truncate flex-shrink-0">
                  {call.raw_input?.slice(0, 30) ?? "—"}
                </span>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-3 rounded-full bg-cream-dark overflow-hidden">
                    <motion.div className="h-full rounded-full bg-red-400/60" initial={{ width: 0 }}
                      animate={{ width: `${maxTokens > 0 ? (call.raw_tokens / maxTokens) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.04 }} />
                  </div>
                  <div className="h-3 rounded-full bg-cream-dark overflow-hidden">
                    <motion.div className="h-full rounded-full bg-accent-sage" initial={{ width: 0 }}
                      animate={{ width: `${maxTokens > 0 ? (call.optimized_tokens / maxTokens) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: 0.3 + i * 0.04 }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-accent-sage w-10 text-right flex-shrink-0">-{pctSaved}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
