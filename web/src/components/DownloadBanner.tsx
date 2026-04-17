"use client";

import { useEffect, useState } from "react";
import { Download, Apple, Smartphone } from "lucide-react";

type Platform = "mac" | "windows" | "linux" | "unknown";

const GH_BASE = "https://github.com/codemodeai/seer/releases/latest/download";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("mac") ? "mac"
    : ua.includes("win") ? "windows"
    : ua.includes("linux") ? "linux"
    : "unknown";
}

const urls: Record<Platform, string> = {
  mac: `${GH_BASE}/SEER_aarch64.dmg`,
  windows: `${GH_BASE}/SEER_x64-setup.exe`,
  linux: `${GH_BASE}/SEER_x64.AppImage`,
  unknown: `/download`,
};

const labels: Record<Platform, string> = {
  mac: "Download for Mac",
  windows: "Download for Windows",
  linux: "Download for Linux",
  unknown: "Download SEER",
};

export default function DownloadBanner() {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <section className="py-16 bg-charcoal relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-terracotta/8 blur-3xl" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-2">
            Available on all platforms
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-white tracking-tight">
            One app. Every device.
          </h2>
          <p className="mt-3 text-white/60 text-base max-w-sm leading-relaxed">
            Desktop agent on Mac, Windows, or Linux.
            Companion app on iOS and Android.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          {/* Primary platform download */}
          <a
            href={urls[platform]}
            className="group flex items-center gap-2.5 px-6 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20"
          >
            <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" />
            {labels[platform]}
          </a>

          {/* All platforms */}
          <a
            href="/download"
            className="flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-full transition-all border border-white/15"
          >
            All platforms →
          </a>
        </div>
      </div>

      {/* Mobile badges row */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mt-6 flex flex-wrap gap-3">
        <a
          href="https://apps.apple.com/app/seer-ai/id0000000000"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-sm transition-colors border border-white/10"
        >
          <Apple size={14} />
          iOS App Store
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=ai.seer.app"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-sm transition-colors border border-white/10"
        >
          <Smartphone size={14} />
          Google Play
        </a>
        <span className="flex items-center px-4 py-2 text-white/30 text-sm">
          or{" "}
          <code className="ml-2 text-xs bg-white/8 px-2 py-1 rounded font-mono">
            curl -fsSL https://seer.ai/install.sh | bash
          </code>
        </span>
      </div>
    </section>
  );
}
