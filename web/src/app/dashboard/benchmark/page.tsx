"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, TrendingDown, Zap, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface BenchResult {
  id: string;
  category: string;
  original: string;
  optimized: string;
  before: number;
  after: number;
  savings: number;
  error?: boolean;
}

interface BenchData {
  totalOriginal: number;
  totalOptimized: number;
  overallSavings: number;
  categories: Array<{ name: string; savings: number; count: number }>;
  results: BenchResult[];
}

function SavingsBadge({ savings }: { savings: number }) {
  const color =
    savings > 30 ? "bg-green-100 text-green-700 border-green-200" :
    savings > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
    savings === 0 ? "bg-gray-100 text-gray-500 border-gray-200" :
    "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {savings > 0 ? `-${savings}%` : savings === 0 ? "0%" : `+${Math.abs(savings)}%`}
    </span>
  );
}

function TokenBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted font-medium">{label}</span>
        <span className="text-charcoal font-semibold">{value} tokens</span>
      </div>
      <div className="h-3 bg-sand/30 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function ResultRow({ result }: { result: BenchResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-sand/30 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 py-3 px-4 hover:bg-ivory/50 transition-colors text-left">
        <span className="text-xs font-medium text-muted w-20 shrink-0">{result.category}</span>
        <span className="text-sm text-charcoal truncate flex-1">{result.original.substring(0, 80)}{result.original.length > 80 ? "..." : ""}</span>
        <span className="text-xs text-muted w-16 text-right shrink-0">{result.before}→{result.after}</span>
        <SavingsBadge savings={result.savings} />
        {open ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
      </button>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-4 pb-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Original ({result.before} tokens)</p>
            <p className="text-sm text-warm-brown bg-red-50/50 rounded-lg p-3 border border-red-100">{result.original}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Optimized ({result.after} tokens)</p>
            <p className="text-sm text-warm-brown bg-green-50/50 rounded-lg p-3 border border-green-100">{result.optimized || "—"}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function BenchmarkPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingKey, setFetchingKey] = useState(true);
  const [data, setData] = useState<BenchData | null>(null);

  useEffect(() => {
    async function fetchKey() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFetchingKey(false); return; }
      const { data: userData } = await supabase
        .from("users").select("seer_api_key").eq("id", user.id).single();
      if (userData) setApiKey(userData.seer_api_key);
      setFetchingKey(false);
    }
    fetchKey();
  }, []);

  async function runBenchmark() {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const result = await res.json();
      setData(result);
    } catch {
      // handle error silently
    }
    setLoading(false);
  }

  if (fetchingKey) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">Benchmark</h1>
          <p className="mt-1 text-sm text-muted">Test SEER optimization across 14 real-world prompts.</p>
        </div>
        <button
          onClick={runBenchmark}
          disabled={loading || !apiKey}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Running...</>
          ) : (
            <><Play size={16} /> Run Benchmark</>
          )}
        </button>
      </div>

      {loading && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-terracotta mx-auto" />
          <p className="text-sm text-muted">Running 14 prompts through SEER optimization...</p>
          <p className="text-xs text-muted">This takes about 30-60 seconds</p>
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Hero stat */}
          <div className="bg-charcoal rounded-2xl p-8 text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-2">Overall Token Savings</p>
            <p className={`font-display text-6xl tracking-tight ${data.overallSavings > 0 ? "text-green-400" : "text-red-400"}`}>
              {data.overallSavings > 0 ? `-${data.overallSavings}%` : `+${Math.abs(data.overallSavings)}%`}
            </p>
            <p className="text-sm text-white/50 mt-2">
              {data.totalOriginal} tokens → {data.totalOptimized} tokens across {data.results.length} prompts
            </p>
          </div>

          {/* Token bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-terracotta" />
                <p className="text-sm font-semibold text-charcoal">Token Comparison</p>
              </div>
              <TokenBar label="Original" value={data.totalOriginal} max={Math.max(data.totalOriginal, data.totalOptimized)} color="bg-red-400" />
              <TokenBar label="Optimized" value={data.totalOptimized} max={Math.max(data.totalOriginal, data.totalOptimized)} color="bg-green-400" />
            </div>

            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-terracotta" />
                <p className="text-sm font-semibold text-charcoal">Tokens Saved</p>
              </div>
              <p className="font-display text-4xl text-charcoal tracking-tight">
                {Math.max(0, data.totalOriginal - data.totalOptimized)}
              </p>
              <p className="text-xs text-muted">tokens removed across all prompts</p>
            </div>

            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-terracotta" />
                <p className="text-sm font-semibold text-charcoal">By Category</p>
              </div>
              <div className="space-y-1.5">
                {data.categories.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-xs text-muted">{cat.name}</span>
                    <SavingsBadge savings={cat.savings} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed results */}
          <div className="bg-white rounded-2xl border border-sand/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-sand/30 bg-ivory/50">
              <p className="text-sm font-semibold text-charcoal">Detailed Results</p>
            </div>
            {data.results.map((r) => (
              <ResultRow key={r.id} result={r} />
            ))}
          </div>
        </motion.div>
      )}

      {!loading && !data && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
          <BarChart3 size={32} className="text-muted mx-auto" />
          <p className="text-sm text-muted">Click &quot;Run Benchmark&quot; to test SEER optimization quality.</p>
          <p className="text-xs text-muted">Sends 14 prompts to SEER and measures token savings for each.</p>
        </div>
      )}
    </div>
  );
}
