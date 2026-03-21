"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase-browser";

interface DayData { day: string; saved: number }

const ranges = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

export default function SavingsTrend() {
  const [activeRange, setActiveRange] = useState<number>(30);
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result } = await supabase.rpc("daily_savings", {
        uid: user.id,
        days: activeRange,
      });

      if (result) {
        setData(result.map((r: { day: string; total_saved: number }) => ({
          day: new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          saved: Number(r.total_saved),
        })));
      } else {
        setData([]);
      }
    }
    fetchData();
  }, [activeRange]);

  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.saved)) : 0;
  const totalSaved = data.reduce((s, d) => s + d.saved, 0);
  const estDollarsSaved = (totalSaved * 0.0015).toFixed(2);

  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-charcoal">Token Savings Trend</h3>
        <div className="flex items-center bg-cream-dark rounded-lg p-0.5">
          {ranges.map((r) => (
            <button key={r.days} onClick={() => setActiveRange(r.days)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeRange === r.days ? "bg-white text-charcoal shadow-sm" : "text-muted hover:text-charcoal"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-6">
        <span className="font-display text-2xl text-charcoal">{totalSaved.toLocaleString()}</span>
        <span className="text-xs text-muted">tokens saved</span>
        {totalSaved > 0 && <span className="text-xs font-medium text-accent-sage">~${estDollarsSaved} in API costs</span>}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-sm text-muted">
          No savings data yet. Use SEER to start tracking.
        </div>
      ) : (
        <>
          <div className="flex items-end gap-[2px] h-36">
            {data.map((d, i) => {
              const h = maxVal > 0 ? (d.saved / maxVal) * 100 : 0;
              return (
                <div key={i} className="flex-1 group relative flex flex-col items-center justify-end">
                  <motion.div className="w-full rounded-t-sm bg-terracotta/70 hover:bg-terracotta transition-colors cursor-pointer min-h-[2px]"
                    initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.5, delay: i * 0.015 }} />
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-charcoal text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.day}: {d.saved} tokens
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-muted">{data[0]?.day}</span>
            <span className="text-[10px] text-muted">{data[Math.floor(data.length / 2)]?.day}</span>
            <span className="text-[10px] text-muted">{data[data.length - 1]?.day}</span>
          </div>
        </>
      )}
    </div>
  );
}
