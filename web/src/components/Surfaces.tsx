"use client";

import { motion } from "framer-motion";
import { Terminal, Monitor, Code2, Globe } from "lucide-react";

const surfaces = [
  {
    icon: Terminal,
    name: "Terminal CLI",
    description: "Claude Code in your terminal",
    config: 'claude mcp add seer --transport http --url https://mcp.seer.ai/mcp',
  },
  {
    icon: Monitor,
    name: "Claude Desktop",
    description: "Native desktop app",
    config: "claude_desktop_config.json",
  },
  {
    icon: Code2,
    name: "VS Code",
    description: "Claude Code extension",
    config: ".mcp.json in project root",
  },
  {
    icon: Globe,
    name: "Claude.ai Web",
    description: "Browser interface",
    config: "Settings → Integrations → Add MCP",
  },
];

export default function Surfaces() {
  return (
    <section className="py-28 md:py-36">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            One Server, Four Surfaces
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl tracking-tight text-charcoal leading-[1.05]">
            Works everywhere Claude does
          </h2>
          <p className="mt-5 text-warm-brown-light text-lg">
            Same URL, same key, same intelligence — across every Claude surface.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {surfaces.map((s, i) => (
            <motion.div
              key={s.name}
              className="bg-ivory rounded-2xl border border-sand/70 p-7 hover:border-sand hover:shadow-lg hover:shadow-charcoal/3 transition-all group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="w-11 h-11 rounded-xl bg-terracotta/10 border border-terracotta/15 text-terracotta flex items-center justify-center group-hover:bg-terracotta group-hover:text-white transition-colors">
                <s.icon size={20} />
              </div>
              <h3 className="mt-5 font-display text-lg text-charcoal">
                {s.name}
              </h3>
              <p className="mt-1 text-sm text-warm-brown-light">
                {s.description}
              </p>
              <div className="mt-4 px-3 py-2 rounded-lg bg-cream-dark font-mono text-[11px] text-muted truncate">
                {s.config}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
