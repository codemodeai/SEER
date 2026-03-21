"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Monitor, Code2, Globe, Copy, Check, Loader2, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

function getTabs(key: string) {
  const configJson = JSON.stringify({
    mcpServers: {
      seer: {
        url: "https://mcp.seermcp.com/mcp",
        headers: {
          Authorization: `Bearer ${key}`,
        },
      },
    },
  }, null, 2);

  return [
    {
      id: "terminal",
      label: "Terminal CLI",
      icon: Terminal,
      quickCmd: `claude mcp add seer --transport http --url https://mcp.seermcp.com/mcp --header "Authorization: Bearer ${key}"`,
      config: `claude mcp add seer \\
  --transport http \\
  --url https://mcp.seermcp.com/mcp \\
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
      quickCmdWin: `echo ${JSON.stringify(configJson).replace(/"/g, '\\"')} > "%APPDATA%\\Claude\\claude_desktop_config.json"`,
      quickCmdMac: `cat > ~/Library/Application\\ Support/Claude/claude_desktop_config.json << 'EOF'\n${configJson}\nEOF`,
      quickCmd: `# Windows (run in PowerShell):
$config = @'
${configJson}
'@
$config | Set-Content "$env:APPDATA\\Claude\\claude_desktop_config.json"

# Mac/Linux (run in Terminal):
cat > ~/Library/Application\\ Support/Claude/claude_desktop_config.json << 'EOF'
${configJson}
EOF`,
      config: `// Config file locations:
// Mac:     ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%\\Claude\\claude_desktop_config.json

${configJson}

// Restart Claude Desktop after saving`,
    },
    {
      id: "vscode",
      label: "VS Code",
      icon: Code2,
      quickCmd: `echo '${JSON.stringify({ mcpServers: { seer: { url: "https://mcp.seermcp.com/mcp", headers: { Authorization: "${env:SEER_API_KEY}" } } } }, null, 2)}' > .mcp.json && echo "Created .mcp.json — set SEER_API_KEY=${key}"`,
      config: `// Option A: .mcp.json in project root (recommended)
{
  "mcpServers": {
    "seer": {
      "url": "https://mcp.seermcp.com/mcp",
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
      quickCmd: "",
      config: `// Settings → Integrations → Add MCP Server

Name:          SEER
URL:           https://mcp.seermcp.com/mcp
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
  const [quickCopied, setQuickCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

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

  function handleQuickCopy() {
    navigator.clipboard.writeText(activeTab.quickCmd ?? "");
    setQuickCopied(true);
    setTimeout(() => setQuickCopied(false), 2000);
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
        <p className="mt-1 text-sm text-muted">One command — paste in your terminal and you&apos;re done.</p>
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

      {/* Platform tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => { setActive(tab.id); setCopied(false); setQuickCopied(false); setShowManual(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              active === tab.id ? "bg-terracotta text-white shadow-sm" : "bg-ivory border border-sand/60 text-warm-brown-light hover:bg-cream-dark"
            }`}>
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick install command */}
      {activeTab.quickCmd && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-ivory rounded-2xl border-2 border-terracotta/20 p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-terracotta" />
            <p className="text-xs font-semibold tracking-widest uppercase text-terracotta">
              Quick Install — Just paste in terminal
            </p>
          </div>
          <div className="relative bg-charcoal rounded-xl overflow-hidden">
            <button onClick={handleQuickCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terracotta/20 hover:bg-terracotta/30 text-terracotta-light text-xs font-medium transition-all">
              {quickCopied ? (<><Check size={13} /> Copied!</>) : (<><Copy size={13} /> Copy</>)}
            </button>
            <pre className="p-5 pr-24 font-mono text-sm text-white/85 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {active === "desktop" ? activeTab.quickCmd : activeTab.quickCmd}
            </pre>
          </div>
          {active === "desktop" && (
            <p className="mt-3 text-xs text-muted">
              After running, restart Claude Desktop to connect.
            </p>
          )}
        </motion.div>
      )}

      {/* Manual config toggle */}
      <button
        onClick={() => setShowManual(!showManual)}
        className="text-xs font-medium text-muted hover:text-terracotta transition-colors"
      >
        {showManual ? "Hide manual config" : "Show manual config"} →
      </button>

      {/* Manual config (collapsed by default) */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative bg-charcoal rounded-2xl overflow-hidden">
              <button onClick={handleCopy}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-xs font-medium transition-all">
                {copied ? (<><Check size={13} /> Copied</>) : (<><Copy size={13} /> Copy</>)}
              </button>
              <pre className="p-6 pr-24 font-mono text-sm text-white/75 leading-relaxed overflow-x-auto">
                {activeTab.config}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
