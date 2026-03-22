"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Check, Sparkles, Wrench, Shield, Loader2 } from "lucide-react";

interface Update {
  version: string;
  date: string;
  title: string;
  type: "feature" | "improvement" | "fix" | "security";
  changes: string[];
}

const TYPE_CONFIG = {
  feature: { label: "New Feature", icon: Sparkles, color: "text-terracotta", bg: "bg-terracotta/10", border: "border-terracotta/20" },
  improvement: { label: "Improvement", icon: Zap, color: "text-accent-sage", bg: "bg-accent-sage/10", border: "border-accent-sage/20" },
  fix: { label: "Bug Fix", icon: Wrench, color: "text-warm-brown-light", bg: "bg-warm-brown-light/10", border: "border-warm-brown-light/20" },
  security: { label: "Security", icon: Shield, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [currentVersion, setCurrentVersion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpdates() {
      try {
        const res = await fetch("/api/updates");
        if (res.ok) {
          const data = await res.json();
          setUpdates(data.updates ?? []);
          setCurrentVersion(data.currentVersion ?? "");
        }
      } catch {
        // Silent fail
      }
      setLoading(false);
    }
    fetchUpdates();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Updates
        </h1>
        <p className="mt-1 text-sm text-muted">
          What&apos;s new in SEER. All updates are applied automatically — no reinstall needed.
        </p>
      </div>

      {/* Current version badge */}
      {currentVersion && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-4 bg-ivory rounded-2xl border border-sand/60"
        >
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <Zap size={18} className="text-terracotta" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">
              Current Version
            </p>
            <p className="font-display text-xl text-charcoal">{currentVersion}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-sage/10 border border-accent-sage/20">
            <Check size={12} className="text-accent-sage" />
            <span className="text-xs font-semibold text-accent-sage">Up to date</span>
          </div>
        </motion.div>
      )}

      {/* Auto-update notice */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-terracotta/5 border border-terracotta/15 rounded-2xl px-5 py-4"
      >
        <p className="text-sm text-charcoal font-medium">
          SEER updates automatically
        </p>
        <p className="text-xs text-muted mt-1">
          Since SEER runs as a cloud MCP server, every update we push is instantly available
          to all users. No need to reinstall, update packages, or change your configuration.
        </p>
      </motion.div>

      {/* Timeline */}
      <div className="space-y-4">
        {updates.map((update, i) => {
          const config = TYPE_CONFIG[update.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={update.version}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-sand/40">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center`}>
                    <Icon size={16} className={config.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-charcoal">{update.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.color} border ${config.border}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      v{update.version} — {new Date(update.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
              <ul className="px-5 py-4 space-y-2">
                {update.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <Check size={13} className="mt-0.5 text-terracotta flex-shrink-0" />
                    <span className="text-sm text-warm-brown-light">{change}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
