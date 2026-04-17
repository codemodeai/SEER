"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowRight, Sparkles } from "lucide-react";

type Platform = "mac" | "windows" | "linux" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("mac") ? "mac"
    : ua.includes("win") ? "windows"
    : ua.includes("linux") ? "linux"
    : "unknown";
}

const platformLabel: Record<Platform, string> = {
  mac: "Download for Mac",
  windows: "Download for Windows",
  linux: "Download for Linux",
  unknown: "Download SEER",
};

const GH_BASE = "https://github.com/codemodeai/seer/releases/latest/download";
const platformUrl: Record<Platform, string> = {
  mac: `${GH_BASE}/SEER_aarch64.dmg`,
  windows: `${GH_BASE}/SEER_1.0.0_x64-setup.exe`,
  linux: `${GH_BASE}/SEER_1.0.0_x64.AppImage`,
  unknown: `/download`,
};

export default function Hero() {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

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
            Desktop App — V1.0.0
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          className="mt-8 font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-charcoal text-balance"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          Your AI,{" "}
          <span className="relative inline-block">
            <span className="text-terracotta">fully controlled</span>
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
          SEER is a desktop app with a built-in local agent that orchestrates Claude,
          manages your projects, and connects every AI tool — all from one place.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <a
            href={platformUrl[platform]}
            className="group flex items-center gap-2.5 px-7 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20 hover:shadow-xl hover:shadow-terracotta/30"
          >
            <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" />
            {platformLabel[platform]}
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="/download"
            className="px-7 py-3.5 bg-ivory hover:bg-cream-dark text-charcoal font-semibold rounded-full border border-sand transition-all"
          >
            All platforms →
          </a>
        </motion.div>

        {/* Platform pills */}
        <motion.div
          className="mt-7 flex items-center justify-center gap-2 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {["macOS", "Windows", "Linux", "iOS", "Android"].map((p) => (
            <span key={p} className="text-xs px-3 py-1 rounded-full bg-sand/60 text-warm-brown-light border border-sand">
              {p}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
