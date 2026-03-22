"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Monitor, Code2, Globe, Copy, Check, Loader2, Sparkles, Play } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

function CopyBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-2">{label}</p>
      <div className={`relative rounded-xl overflow-hidden ${highlight ? "bg-charcoal ring-2 ring-terracotta/30" : "bg-charcoal"}`}>
        <button onClick={handleCopy}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-[11px] sm:text-xs font-medium transition-all z-10">
          {copied ? (<><Check size={12} /> Copied!</>) : (<><Copy size={12} /> Copy</>)}
        </button>
        <pre className="p-3 pr-20 sm:p-5 sm:pr-24 font-mono text-xs sm:text-sm text-white/85 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">{value}</pre>
      </div>
    </div>
  );
}

function QuickInstallBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/10 border border-terracotta/20 w-fit">
      <Sparkles size={13} className="text-terracotta" />
      <span className="text-xs font-semibold text-terracotta">One-click install — just paste & enter</span>
    </div>
  );
}

// YouTube video IDs per surface — replace with your actual video IDs
const VIDEO_IDS: Record<string, string> = {
  terminal: "",
  desktop: "fVIV-L49eBs",
  vscode: "",
  web: "",
};

function VideoSection({ surface }: { surface: string }) {
  const videoId = VIDEO_IDS[surface];
  if (!videoId) {
    return (
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center">
          <Play size={20} className="text-terracotta ml-0.5" />
        </div>
        <p className="text-sm font-medium text-charcoal">Video tutorial coming soon</p>
        <p className="text-xs text-muted">Step-by-step walkthrough will be available here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-widest uppercase text-muted">Video Tutorial</p>
      <div className="rounded-2xl overflow-hidden border border-sand/60 bg-black aspect-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title="Installation tutorial"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

export default function InstallGuidePage() {
  const [active, setActive] = useState("terminal");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKey() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      await fetch("/api/auth/setup-user", { method: "POST" });
      const { data } = await supabase
        .from("users").select("seer_api_key").eq("id", user.id).single();
      if (data) setApiKey(data.seer_api_key);
      setLoading(false);
    }
    fetchKey();
  }, []);

  const key = apiKey || "sk-seer-YOUR-KEY";

  // Short Claude Desktop prompt — minimal tokens, Claude figures out the rest
  const desktopPrompt = `Run: npm install -g mcp-remote
Then find my claude_desktop_config.json and add seer to mcpServers. Use FULL absolute paths (run "where node" and "npm root -g" to get them). Never use npx as command.
Config: {"seer":{"command":"FULL_PATH_TO_NODE","args":["FULL_PATH_FROM_NPM_ROOT_G/mcp-remote/dist/proxy.js","https://mcp.seermcp.com/mcp","--header","Authorization: Bearer ${key}"]}}`;

  // VS Code prompt — use claude mcp add at user scope for global persistence
  const vscodePrompt = `Run this command to add SEER globally (works across all projects and persists after restart):
claude mcp add seer https://mcp.seermcp.com/mcp -t http -s user -H "Authorization: Bearer ${key}"`;

  const tabs = [
    { id: "terminal", label: "Terminal CLI", icon: Terminal },
    { id: "desktop", label: "Claude Desktop", icon: Monitor },
    { id: "vscode", label: "VS Code", icon: Code2 },
    { id: "web", label: "Claude.ai Web", icon: Globe },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">Install Guide</h1>
        <p className="mt-1 text-sm text-muted">Choose your Claude surface and follow the steps.</p>
      </div>

      {/* API Key */}
      <CopyBox label="Your SEER API Key" value={key} />

      {/* Platform tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              active === tab.id ? "bg-terracotta text-white shadow-sm" : "bg-ivory border border-sand/60 text-warm-brown-light hover:bg-cream-dark"
            }`}>
            <tab.icon size={14} className="sm:w-4 sm:h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content per tab */}
      <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {active === "terminal" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Paste this in your terminal"
              value={`claude mcp add seer --transport http --url https://mcp.seermcp.com/mcp --header "Authorization: Bearer ${key}"`}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">After running:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Run <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">claude mcp list</code> to verify SEER is added</li>
                <li>Start a new Claude Code session</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> to test the connection</li>
              </ol>
            </div>
            <VideoSection surface="terminal" />
          </div>
        )}

        {active === "desktop" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Paste this into Claude Code or Claude Desktop — it does everything for you"
              value={desktopPrompt}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">What happens:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Claude installs the MCP bridge automatically</li>
                <li>Finds and updates your config file (Windows, Mac, or Store app)</li>
                <li>Preserves your existing MCP servers</li>
                <li>After it&apos;s done, quit Claude Desktop from the <strong>system tray</strong> and reopen</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Chat mode to verify</li>
              </ol>
            </div>
            <VideoSection surface="desktop" />
          </div>
        )}

        {active === "vscode" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Paste this into Claude Code — it sets up everything"
              value={vscodePrompt}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">What happens:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>SEER is added <strong className="text-charcoal">globally</strong> — works in every project</li>
                <li>Persists across VS Code restarts — install once, works forever</li>
                <li>No extra files or dependencies needed</li>
                <li>Reload VS Code after it&apos;s done (<code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">Ctrl+Shift+P</code> → Reload Window)</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Claude Code to verify</li>
              </ol>
            </div>
            <VideoSection surface="vscode" />
          </div>
        )}

        {active === "web" && (
          <div className="space-y-5">
            <CopyBox
              label="MCP Server URL"
              value="https://mcp.seermcp.com/mcp"
            />
            <CopyBox
              label="Authorization Header Value"
              value={`Bearer ${key}`}
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">Steps:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Go to <strong>Claude.ai → Settings → Integrations</strong></li>
                <li>Click <strong>Add MCP Server</strong></li>
                <li>Set Name to <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">SEER</code></li>
                <li>Paste the URL above</li>
                <li>Set Auth type to <strong>Header-based</strong></li>
                <li>Header name: <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">Authorization</code></li>
                <li>Paste the header value above</li>
                <li>Click Save — Claude.ai connects immediately</li>
              </ol>
            </div>
            <VideoSection surface="web" />
          </div>
        )}
      </motion.div>

      <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-5">
        <p className="text-sm text-warm-brown">
          <span className="font-semibold text-terracotta">Tip:</span> After installing, type{" "}
          <code className="bg-terracotta/10 px-1.5 py-0.5 rounded text-terracotta font-mono text-xs">seer status</code>{" "}
          in any Claude session to verify the connection.
        </p>
      </div>
    </div>
  );
}
