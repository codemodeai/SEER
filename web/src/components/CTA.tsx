"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-28 md:py-36 relative overflow-hidden">
      {/* BG shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-terracotta/5 blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 max-w-3xl mx-auto px-6 text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]">
          Stop wasting tokens.
          <br />
          <span className="text-terracotta">Start shipping faster.</span>
        </h2>
        <p className="mt-6 text-lg text-warm-brown-light max-w-xl mx-auto leading-relaxed">
          50 free calls. No credit card required. Install in under a minute and
          see the difference on your very first prompt.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/signup"
            className="group flex items-center gap-2 px-8 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20 hover:shadow-xl hover:shadow-terracotta/30 text-lg"
          >
            Get started free
            <ArrowRight
              size={18}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </a>
        </div>
        <p className="mt-5 text-sm text-muted">
          Works with Claude Code CLI, Desktop, VS Code, and Claude.ai
        </p>
      </motion.div>
    </section>
  );
}
