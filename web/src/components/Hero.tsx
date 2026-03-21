"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden grain">
      {/* Decorative background shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-[10%] w-[500px] h-[500px] rounded-full bg-terracotta/5 blur-3xl" />
        <div className="absolute bottom-20 right-[10%] w-[400px] h-[400px] rounded-full bg-accent-gold/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-sand/30 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-semibold tracking-wide uppercase border border-terracotta/15">
            <Sparkles size={13} />
            MCP-Powered Intelligence
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          className="mt-8 font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-charcoal text-balance"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          Every prompt,{" "}
          <span className="relative inline-block">
            <span className="text-terracotta">perfected</span>
            <svg
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 200 8"
              fill="none"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M1 5.5C40 2 80 2 100 4C120 6 160 3 199 5"
                stroke="#D97757"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              />
            </svg>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-7 text-lg md:text-xl text-warm-brown-light max-w-2xl mx-auto leading-relaxed text-balance"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          SEER intercepts your prompts, optimizes them, structures them into
          executable workflows, and injects project memory — all before Claude
          Code even starts thinking.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <a
            href="/signup"
            className="group flex items-center gap-2 px-7 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20 hover:shadow-xl hover:shadow-terracotta/30"
          >
            Start free — 50 calls/mo
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </a>
          <a
            href="#features"
            className="px-7 py-3.5 bg-ivory hover:bg-cream-dark text-charcoal font-semibold rounded-full border border-sand transition-all"
          >
            See how it works
          </a>
        </motion.div>

        {/* Terminal preview */}
        <motion.div
          className="mt-16 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
        >
          <div className="relative rounded-2xl overflow-hidden bg-charcoal shadow-2xl shadow-charcoal/15 border border-charcoal-light/30">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-[11px] text-white/30 font-mono">
                claude-code
              </span>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed">
              <div className="text-white/40">
                <span className="text-accent-sage">$</span> seer build the
                login page with OAuth
              </div>
              <div className="mt-4 text-white/60">
                <span className="text-terracotta-light">SEER</span>{" "}
                <span className="text-white/30">|</span> Optimizing prompt...
              </div>
              <div className="mt-1 text-white/60">
                <span className="text-terracotta-light">SEER</span>{" "}
                <span className="text-white/30">|</span> Tokens:{" "}
                <span className="text-white/80">47 → 28</span>{" "}
                <span className="text-accent-sage">(-40%)</span>
              </div>
              <div className="mt-1 text-white/60">
                <span className="text-terracotta-light">SEER</span>{" "}
                <span className="text-white/30">|</span> Workflow: 5 steps
                generated
              </div>
              <div className="mt-1 text-white/60">
                <span className="text-terracotta-light">SEER</span>{" "}
                <span className="text-white/30">|</span> Context: 3 memories
                injected
              </div>
              <div className="mt-3 text-white/30">
                ───────────────────────────────
              </div>
              <div className="mt-2 text-accent-sage/80">
                ✓ Claude Code executing optimized workflow...
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
