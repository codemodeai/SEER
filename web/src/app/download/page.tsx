"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Smartphone, Terminal, Check, ArrowRight, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Platform = "mac" | "windows" | "linux" | "unknown";
type Arch = "arm" | "x64";

const GH_BASE = "https://github.com/codemodeai/seer/releases/latest/download";

const DOWNLOADS = {
  mac: {
    arm: { label: "Download for Mac (Apple Silicon)", file: "SEER_aarch64.dmg", ext: ".dmg" },
    x64: { label: "Download for Mac (Intel)", file: "SEER_x64.dmg", ext: ".dmg" },
  },
  windows: {
    arm: { label: "Download for Windows", file: "SEER_x64-setup.exe", ext: ".exe" },
    x64: { label: "Download for Windows", file: "SEER_x64-setup.exe", ext: ".exe" },
  },
  linux: {
    arm: { label: "Download for Linux (.AppImage)", file: "SEER_aarch64.AppImage", ext: ".AppImage" },
    x64: { label: "Download for Linux (.AppImage)", file: "SEER_x64.AppImage", ext: ".AppImage" },
  },
};

function detectPlatform(): { platform: Platform; arch: Arch } {
  if (typeof navigator === "undefined") return { platform: "unknown", arch: "x64" };
  const ua = navigator.userAgent.toLowerCase();
  const platform: Platform = ua.includes("mac") ? "mac"
    : ua.includes("win") ? "windows"
    : ua.includes("linux") ? "linux"
    : "unknown";
  const arch: Arch = ua.includes("arm") || ua.includes("aarch") ? "arm" : "x64";
  return { platform, arch };
}

const STEPS = [
  "Download and install the SEER desktop app",
  "Sign in with your SEER account (or create one free)",
  "Open SEER Chat — type any task naturally",
  "Click Connect in Settings to wire up Claude Code, Cursor, or any AI tool",
];

export default function DownloadPage() {
  const [detected, setDetected] = useState<{ platform: Platform; arch: Arch }>({ platform: "unknown", arch: "x64" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  function downloadUrl(platform: Platform, arch: Arch): string {
    if (platform === "unknown") return `${GH_BASE}/SEER_x64-setup.exe`;
    const entry = DOWNLOADS[platform][arch];
    return `${GH_BASE}/${entry.file}`;
  }

  function primaryLabel(): string {
    if (detected.platform === "unknown") return "Download SEER";
    return DOWNLOADS[detected.platform][detected.arch].label;
  }

  function copyInstallScript() {
    navigator.clipboard.writeText("curl -fsSL https://seer.ai/install.sh | bash");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const otherPlatforms: Array<{ platform: Platform; arch: Arch; label: string }> = [
    { platform: "mac", arch: "arm", label: "Mac — Apple Silicon (.dmg)" },
    { platform: "mac", arch: "x64", label: "Mac — Intel (.dmg)" },
    { platform: "windows", arch: "x64", label: "Windows (.exe)" },
    { platform: "linux", arch: "x64", label: "Linux — x64 (.AppImage)" },
    { platform: "linux", arch: "arm", label: "Linux — ARM64 (.AppImage)" },
  ];

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-0 min-h-screen bg-cream grain">

        {/* Hero */}
        <section className="py-24 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-terracotta/4 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-semibold tracking-wide uppercase border border-terracotta/15">
                <Download size={12} />
                V1.0.0 — Now Available
              </span>
            </motion.div>

            <motion.h1
              className="mt-7 font-display text-5xl md:text-7xl tracking-tight text-charcoal leading-[0.95]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Install SEER
            </motion.h1>

            <motion.p
              className="mt-6 text-lg md:text-xl text-warm-brown-light max-w-xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              The desktop app installs the local agent automatically.
              One download. Everything connected.
            </motion.p>

            {/* Primary download button */}
            <motion.div
              className="mt-10 flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <a
                href={downloadUrl(detected.platform, detected.arch)}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20 hover:shadow-xl hover:shadow-terracotta/30 text-lg"
              >
                <Download size={20} />
                {primaryLabel()}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <p className="text-xs text-muted">
                {detected.platform !== "unknown"
                  ? `Detected: ${detected.platform === "mac" ? "macOS" : detected.platform === "windows" ? "Windows" : "Linux"} · ${detected.arch === "arm" ? "Apple Silicon / ARM" : "Intel / x64"}`
                  : "macOS · Windows · Linux"}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Desktop install section */}
        <section className="py-20 bg-white border-y border-sand/60">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Left — platform buttons */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                    <Monitor size={20} className="text-terracotta" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl text-charcoal">Desktop App</h2>
                    <p className="text-sm text-muted">Mac · Windows · Linux</p>
                  </div>
                </div>

                <p className="text-warm-brown-light mb-8 leading-relaxed">
                  The SEER desktop app includes the local agent. After install, sign in
                  and your agent starts immediately — no terminal required.
                </p>

                <div className="flex flex-col gap-3">
                  {otherPlatforms.map((p) => (
                    <a
                      key={p.label}
                      href={downloadUrl(p.platform, p.arch)}
                      className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all group ${
                        detected.platform === p.platform && detected.arch === p.arch
                          ? "bg-terracotta/8 border-terracotta/30 text-terracotta"
                          : "bg-ivory border-sand/60 text-warm-brown-light hover:border-terracotta/30 hover:text-charcoal"
                      }`}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Download size={12} />
                        Download
                      </span>
                    </a>
                  ))}
                </div>

                {/* CLI install script */}
                <div className="mt-8 p-4 rounded-xl bg-charcoal border border-white/10">
                  <p className="text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">Or install via terminal</p>
                  <div className="flex items-center gap-3">
                    <code className="text-sm text-accent-sage font-mono flex-1 truncate">
                      curl -fsSL https://seer.ai/install.sh | bash
                    </code>
                    <button
                      onClick={copyInstallScript}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-xs font-medium transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right — steps */}
              <div>
                <h3 className="font-display text-2xl text-charcoal mb-8">Get started in 4 steps</h3>
                <div className="flex flex-col gap-5">
                  {STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      className="flex items-start gap-4"
                      initial={{ opacity: 0, x: 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                    >
                      <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-terracotta text-sm font-bold">{i + 1}</span>
                      </div>
                      <p className="text-warm-brown-light leading-relaxed pt-1">{step}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-10 p-5 rounded-2xl bg-ivory border border-sand/60">
                  <div className="flex items-center gap-2 text-accent-sage text-sm font-semibold mb-3">
                    <Check size={15} />
                    What the app installs for you
                  </div>
                  <ul className="flex flex-col gap-2">
                    {[
                      "SEER Local Agent (Node.js — runs on your machine)",
                      "Auto-configured MCP connection for Claude Code",
                      "settings.json model switcher (zero-config)",
                      "Offline instruction cache (7-day TTL)",
                    ].map((item) => (
                      <li key={item} className="text-sm text-warm-brown-light flex items-start gap-2">
                        <Check size={13} className="text-accent-sage mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile section */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Left — description */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                    <Smartphone size={20} className="text-terracotta" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl text-charcoal">Mobile App</h2>
                    <p className="text-sm text-muted">iOS · Android</p>
                  </div>
                </div>

                <p className="text-warm-brown-light mb-6 leading-relaxed">
                  Control your primary desktop from anywhere. SEER Chat on mobile
                  sends tasks to your desktop agent and streams results back in real time.
                  No Claude Code needed on your phone.
                </p>

                <ul className="flex flex-col gap-3 mb-10">
                  {[
                    "Full SEER Chat — same experience as desktop",
                    "Founder's Space — tasks, documents, notes on the go",
                    "Real-time result streaming from your desktop agent",
                    "Works offline — tasks queue until desktop is available",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-warm-brown-light">
                      <Check size={14} className="text-terracotta mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* App Store */}
                  <a
                    href="https://apps.apple.com/app/seer-ai/id0000000000"
                    className="inline-flex items-center gap-3 px-6 py-3.5 bg-charcoal hover:bg-charcoal/90 text-white rounded-xl transition-all"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <div>
                      <div className="text-xs text-white/60">Download on the</div>
                      <div className="text-sm font-semibold">App Store</div>
                    </div>
                  </a>

                  {/* Google Play */}
                  <a
                    href="https://play.google.com/store/apps/details?id=ai.seer.app"
                    className="inline-flex items-center gap-3 px-6 py-3.5 bg-charcoal hover:bg-charcoal/90 text-white rounded-xl transition-all"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.18 23.76c.34.19.73.24 1.1.14l12.37-12.37L13.09 8l-9.9 15.76zM20.72 9.58l-2.7-1.54-3.42 3.42 3.42 3.43 2.74-1.56c.78-.44.78-1.31-.04-1.75zM2.18.25C1.96.47 1.82.8 1.82 1.22v21.5c0 .42.14.75.37.97l.08.08L13.09 13v-.25L2.26.17l-.08.08zM16.65 3.45L4.28.23c-.37-.1-.76-.05-1.1.14l10.87 10.88 2.6-2.6z" />
                    </svg>
                    <div>
                      <div className="text-xs text-white/60">Get it on</div>
                      <div className="text-sm font-semibold">Google Play</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Right — phone mockup / feature card */}
              <div className="hidden md:block">
                <div className="relative mx-auto w-72">
                  <div className="w-full rounded-[2.5rem] bg-charcoal border-4 border-charcoal shadow-2xl overflow-hidden">
                    {/* Phone notch */}
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="w-24 h-5 rounded-full bg-black/40" />
                    </div>
                    {/* Screen content */}
                    <div className="px-4 pb-8 pt-2 bg-[#0a0a0a] min-h-[480px]">
                      <div className="text-white/30 text-[10px] font-mono mb-4">SEER Chat</div>
                      {[
                        { role: "user", text: "Deploy the auth update to staging" },
                        { role: "agent", text: "Running on your MacBook Pro…\n\n✓ Tests passed\n✓ Build complete\n✓ Deployed to staging.seer.ai" },
                        { role: "agent-steps", text: "What's next?\n1. Run smoke tests on staging\n2. Open PR for review" },
                      ].map((m, i) => (
                        <div
                          key={i}
                          className={`mb-3 p-3 rounded-xl text-[11px] leading-relaxed ${
                            m.role === "user"
                              ? "bg-[#3730a3] text-white ml-6"
                              : m.role === "agent-steps"
                              ? "bg-[#111] text-white/50 border border-white/10"
                              : "bg-[#111] text-white/80 border border-white/10"
                          }`}
                        >
                          <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MCP install section */}
        <section className="py-20 bg-ivory border-y border-sand/60">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                <Terminal size={20} className="text-terracotta" />
              </div>
              <h2 className="font-display text-2xl text-charcoal">Connect your AI tools</h2>
            </div>
            <p className="text-warm-brown-light mb-10 max-w-xl mx-auto leading-relaxed">
              After installing the desktop app, connect any AI tool in one click from Settings.
              SEER writes the MCP config automatically — no JSON editing required.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { name: "Claude Code CLI", desc: "~/.claude/mcp.json" },
                { name: "Claude Desktop", desc: "System config" },
                { name: "VS Code", desc: "~/.mcp.json" },
                { name: "Cursor", desc: ".cursor/mcp.json" },
                { name: "Windsurf", desc: "Cascade MCP" },
                { name: "OpenAI Codex", desc: "~/.codex/config.toml" },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="p-4 rounded-xl bg-white border border-sand/60 text-left"
                >
                  <div className="text-sm font-semibold text-charcoal mb-1">{tool.name}</div>
                  <div className="text-xs text-muted font-mono">{tool.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <a
                href="/signup"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20 text-lg"
              >
                Create free account
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <p className="mt-4 text-sm text-muted">Free plan — no credit card required</p>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
