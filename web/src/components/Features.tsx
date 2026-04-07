"use client";

import { motion } from "framer-motion";
import { Zap, GitBranch, Brain, Briefcase } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Prompt Optimizer",
    description:
      "Takes messy, vague, token-heavy input and rewrites it into a structured, precise prompt. Reduces token count by 30–50% on average.",
    detail: "Token savings + quality score on every call",
    color: "terracotta",
    stats: { label: "Avg. token reduction", value: "40%" },
  },
  {
    icon: GitBranch,
    title: "Workflow Generator",
    description:
      "Breaks a high-level goal into 3–7 sequential executable steps, each with its own focused prompt and context.",
    detail: "Claude Code runs each step automatically",
    color: "accent-gold",
    stats: { label: "Steps per workflow", value: "3–7" },
  },
  {
    icon: Brain,
    title: "Context Memory",
    description:
      "Indexes your project using vector embeddings. On every call, injects the most relevant past context automatically.",
    detail: "Powered by pgvector semantic search",
    color: "accent-sage",
    stats: { label: "Context recall", value: "95%" },
  },
  {
    icon: Briefcase,
    title: "Founder's Space",
    description:
      "Your operational workspace — tasks, credentials, documents, and notes. Manage everything from dashboard or terminal via seer space.",
    detail: "AES-256 encrypted credentials vault",
    color: "accent-blue",
    stats: { label: "Data modules", value: "4" },
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function Features() {
  return (
    <section id="features" className="py-28 md:py-36 relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            Core Features
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]">
            Intelligence between you
            <br />
            <span className="text-warm-brown-light">and the model</span>
          </h2>
          <p className="mt-5 text-warm-brown-light text-lg leading-relaxed">
            SEER sits as an invisible layer between your intent and Claude
            Code's execution — optimizing, structuring, and enriching every
            interaction.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {features.map((feature) => {
            const colorMap: Record<string, string> = {
              terracotta: "bg-terracotta/10 text-terracotta border-terracotta/15",
              "accent-gold": "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
              "accent-sage": "bg-accent-sage/10 text-accent-sage border-accent-sage/20",
              "accent-blue": "bg-blue-500/10 text-blue-600 border-blue-500/20",
            };
            const statBgMap: Record<string, string> = {
              terracotta: "bg-terracotta text-white",
              "accent-gold": "bg-accent-gold text-white",
              "accent-sage": "bg-accent-sage text-white",
              "accent-blue": "bg-blue-600 text-white",
            };

            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                className="group relative bg-ivory rounded-2xl border border-sand/70 p-8 md:p-10 hover:border-sand transition-all hover:shadow-lg hover:shadow-charcoal/3"
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl ${colorMap[feature.color]} border flex items-center justify-center`}
                >
                  <feature.icon size={22} />
                </div>

                {/* Content */}
                <h3 className="mt-6 font-display text-2xl text-charcoal tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 text-warm-brown-light leading-relaxed text-[15px]">
                  {feature.description}
                </p>

                {/* Detail tag */}
                <p className="mt-4 text-xs font-medium text-muted tracking-wide">
                  {feature.detail}
                </p>

                {/* Stat badge */}
                <div className="mt-8 flex items-center gap-3">
                  <div
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${statBgMap[feature.color]}`}
                  >
                    {feature.stats.value}
                  </div>
                  <span className="text-xs text-muted">
                    {feature.stats.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
