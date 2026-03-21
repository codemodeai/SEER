"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Monitor, Code2, Globe, Copy, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

function getTabs(key: string) {
  return [
    {
      id: "terminal",
      label: "Terminal CLI",
      icon: Terminal,
      config: `claude mcp add seer \\
  --transport http \\
  --url https://mcp.seer.ai/mcp \\
  --header "Authorization: Bearer ${key}"

# Verify:
claude mcp list

# Test:
# Type 'seer status' in any Claude Code session`,
    },
    {
      id: "desktop",
      label: "Claude Desktop",
      icon: Monitor,
      config: `// ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
// %APPDATA%\\Claude\\claude_desktop_config.json (Windows)

{
  "mcpServers": {
    "seer": {
      "url": "https://mcp.seer.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${key}"
      }
    }
  }
}

// Restart Claude Desktop after saving`,
    },
    {
      id: "vscode",
      label: "VS Code",
      icon: Code2,
      config: `// Option A: .mcp.json in project root (recommended)
{
  "mcpServers": {
    "seer": {
      "url": "https://mcp.seer.ai/mcp",
      "headers": {
        "Authorization": "Bearer \${env:SEER_API_KEY}"
      }
    }
  }
}

// Then set env var:
// export SEER_API_KEY=${key}`,
    },
    {
      id: "web",
      label: "Claude.ai Web",
      icon: Globe,
      config: `// Settings → Integrations → Add MCP Server

Name:          SEER
URL:           https://mcp.seer.ai/mcp
Auth type:     Header-based
Header name:   Authorization
Header value:  Bearer ${key}

// Save → Claude.ai connects immediately`,
    },
  ];
}

export default function InstallGuidePage() {
  const [active, setActive] = useState("terminal");
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
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

  const tabs = getTabs(apiKey || "sk-seer-YOUR-KEY");
  const activeTab = tabs.find((t) => t.id === active)!;

  function handleCopy() {
    navigator.clipboard.writeText(activeTab.config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyCopy() {
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

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
        <p className="mt-1 text-sm text-muted">One server URL — configure it once for any Claude surface.</p>
      </div>

      <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-3">Your SEER API Key</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-cream-dark px-4 py-3 rounded-xl font-mono text-sm text-charcoal border border-sand/50 select-all overflow-x-auto">
            {apiKey || "Loading..."}
          </code>
          <button onClick={handleKeyCopy}
            className="px-4 py-3 rounded-xl bg-cream-dark border border-sand/50 text-muted hover:text-charcoal transition-colors">
            {keyCopied ? <Check size={16} className="text-accent-sage" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => { setActive(tab.id); setCopied(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              active === tab.id ? "bg-terracotta text-white shadow-sm" : "bg-ivory border border-sand/60 text-warm-brown-light hover:bg-cream-dark"
            }`}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }} className="relative bg-charcoal rounded-2xl overflow-hidden">
          <button onClick={handleCopy}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-xs font-medium transition-all">
            {copied ? (<><Check size={13} /> Copied</>) : (<><Copy size={13} /> Copy</>)}
          </button>
          <pre className="p-6 pr-24 font-mono text-sm text-white/75 leading-relaxed overflow-x-auto">
            {activeTab.config}
          </pre>
        </motion.div>
      </AnimatePresence>

      <div className="bg-terracotta/5 border border-terracotta/15 rounded-2xl p-5">
        <p className="text-sm text-warm-brown">
          <span className="font-semibold text-terracotta">Tip:</span> After configuring, type{" "}
          <code className="bg-terracotta/10 px-1.5 py-0.5 rounded text-terracotta font-mono text-xs">seer status</code>{" "}
          in any Claude session to verify the connection. You should see your plan info and remaining calls.
        </p>
      </div>
    </div>
  );
}
