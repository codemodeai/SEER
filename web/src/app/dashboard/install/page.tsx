"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Monitor, Code2, Globe, Copy, Check, Loader2, Sparkles } from "lucide-react";
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
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-xs font-medium transition-all">
          {copied ? (<><Check size={13} /> Copied!</>) : (<><Copy size={13} /> Copy</>)}
        </button>
        <pre className="p-5 pr-24 font-mono text-sm text-white/85 leading-relaxed overflow-x-auto whitespace-pre-wrap">{value}</pre>
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

  const configJson = JSON.stringify({
    mcpServers: {
      seer: {
        url: "https://mcp.seermcp.com/mcp",
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2);

  // Claude Code prompt that auto-installs for Claude Desktop
  const desktopAutoPrompt = `Install the SEER MCP server in my Claude Desktop config. Find my claude_desktop_config.json file (on Windows it's at %APPDATA%\\Claude\\claude_desktop_config.json, on Mac it's at ~/Library/Application Support/Claude/claude_desktop_config.json). If the file doesn't exist, create it. If it already has content, merge the new MCP server into the existing mcpServers object without removing other servers. Add this config:\n\n${configJson}\n\nAfter saving, tell me to restart Claude Desktop.`;

  // Claude Code prompt that auto-installs for VS Code
  const vscodeAutoPrompt = `Set up the SEER MCP server for VS Code. Create or update the .mcp.json file in my current project root with this config:\n\n${JSON.stringify({
    mcpServers: {
      seer: {
        url: "https://mcp.seermcp.com/mcp",
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2)}\n\nIf .mcp.json already exists, merge the seer server into the existing mcpServers without removing other servers. After saving, tell me to restart VS Code.`;

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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              active === tab.id ? "bg-terracotta text-white shadow-sm" : "bg-ivory border border-sand/60 text-warm-brown-light hover:bg-cream-dark"
            }`}>
            <tab.icon size={16} />
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
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">After running:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Run <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">claude mcp list</code> to verify SEER is added</li>
                <li>Start a new Claude Code session</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> to test the connection</li>
              </ol>
            </div>
          </div>
        )}

        {active === "desktop" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Paste this prompt into Claude Code — it will set up everything automatically"
              value={desktopAutoPrompt}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">What this does:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Claude finds your <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">claude_desktop_config.json</code> automatically (works on Windows & Mac)</li>
                <li>Creates the file if it doesn&apos;t exist, or merges into your existing config</li>
                <li>Preserves any other MCP servers you already have</li>
                <li>After it&apos;s done, restart Claude Desktop</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> to verify the connection</li>
              </ol>
            </div>

            <details className="group">
              <summary className="text-xs font-semibold text-muted cursor-pointer hover:text-warm-brown transition-colors">
                Manual setup (if you prefer)
              </summary>
              <div className="mt-4 space-y-4">
                <CopyBox
                  label="Windows — Config file path"
                  value="%APPDATA%\Claude\claude_desktop_config.json"
                />
                <CopyBox
                  label="Mac — Config file path"
                  value="~/Library/Application Support/Claude/claude_desktop_config.json"
                />
                <CopyBox
                  label="Paste this config into the file"
                  value={configJson}
                />
              </div>
            </details>
          </div>
        )}

        {active === "vscode" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Paste this prompt into Claude Code — it will set up everything automatically"
              value={vscodeAutoPrompt}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">What this does:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Claude creates or updates <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">.mcp.json</code> in your project root</li>
                <li>Preserves any other MCP servers you already have</li>
                <li>After it&apos;s done, restart VS Code</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Copilot chat to verify</li>
              </ol>
            </div>

            <details className="group">
              <summary className="text-xs font-semibold text-muted cursor-pointer hover:text-warm-brown transition-colors">
                Manual setup (if you prefer)
              </summary>
              <div className="mt-4 space-y-4">
                <CopyBox
                  label="Create .mcp.json in your project root"
                  value={JSON.stringify({
                    mcpServers: {
                      seer: {
                        url: "https://mcp.seermcp.com/mcp",
                        headers: { Authorization: `Bearer ${key}` },
                      },
                    },
                  }, null, 2)}
                />
              </div>
            </details>
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
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
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
