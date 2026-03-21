"use client";

import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "You type naturally",
    description:
      'Just prefix your message with "seer" — no special syntax, no extra steps.',
    code: "seer build the login page with OAuth",
  },
  {
    num: "02",
    title: "SEER intercepts & optimizes",
    description:
      "Your prompt is rewritten for precision, structured into steps, and enriched with project memory.",
    code: '{ "optimized": "...", "steps": [...], "context_used": true }',
  },
  {
    num: "03",
    title: "Claude Code executes",
    description:
      "The optimized workflow is handed back to Claude Code. It runs each step automatically — no retries needed.",
    code: "✓ Step 1/5 complete → Step 2/5 executing...",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-28 md:py-36 bg-cream-dark relative grain">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            How It Works
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl tracking-tight text-charcoal leading-[1.05]">
            Three seconds to better output
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[27px] top-8 bottom-8 w-px bg-sand hidden md:block" />

          <div className="flex flex-col gap-12 md:gap-16">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="flex flex-col md:flex-row gap-6 md:gap-10"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                {/* Step number */}
                <div className="flex-shrink-0 flex items-start">
                  <div className="relative z-10 w-14 h-14 rounded-2xl bg-ivory border border-sand flex items-center justify-center shadow-sm">
                    <span className="font-mono text-sm font-semibold text-terracotta">
                      {step.num}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-display text-2xl text-charcoal tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-warm-brown-light leading-relaxed">
                    {step.description}
                  </p>
                  <div className="mt-4 bg-charcoal rounded-xl px-5 py-3.5 font-mono text-sm text-white/70 overflow-x-auto">
                    <span className="text-accent-sage/70">→</span> {step.code}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
