"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Monitor, Code2, Globe, Copy, Check, Loader2, Sparkles, AlertCircle } from "lucide-react";
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

function PrerequisiteBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 w-fit">
      <AlertCircle size={13} className="text-amber-600" />
      <span className="text-xs font-medium text-amber-700">{text}</span>
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

  // VS Code config (url-based works directly)
  const vscodeConfig = JSON.stringify({
    mcpServers: {
      seer: {
        url: "https://mcp.seermcp.com/mcp",
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2);

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
            <PrerequisiteBadge text="Requires Node.js installed on your system" />

            <CopyBox
              label="Step 1 — Run this in your terminal to install the bridge"
              value="npm install -g mcp-remote"
            />

            <CopyBox
              label="Step 2 — Run this to generate your config (copy the output)"
              value={`node -e "const p=require('path'),r=process.platform==='win32';const nm=p.join(process.env[r?'APPDATA':'HOME'],r?'npm/node_modules':'.npm/node_modules');console.log(JSON.stringify({seer:{command:process.execPath,args:[p.join(nm,'mcp-remote/dist/proxy.js'),'https://mcp.seermcp.com/mcp','--header','Authorization: Bearer ${key}']}},null,2))"`}
            />

            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">Step 3 — Add to your config file:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Open your Claude Desktop config file:
                  <ul className="mt-1 ml-4 space-y-1 list-disc">
                    <li><strong>Windows Store:</strong> <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json</code></li>
                    <li><strong>Windows:</strong> <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">%APPDATA%\Claude\claude_desktop_config.json</code></li>
                    <li><strong>Mac:</strong> <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
                  </ul>
                </li>
                <li>Paste the output from Step 2 inside the <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">mcpServers</code> object</li>
                <li>Fully quit Claude Desktop from the <strong>system tray</strong> (not just close)</li>
                <li>Reopen Claude Desktop</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Chat mode to verify</li>
              </ol>
            </div>
          </div>
        )}

        {active === "vscode" && (
          <div className="space-y-5">
            <QuickInstallBadge />
            <CopyBox
              label="Create .mcp.json in your project root with this config"
              value={vscodeConfig}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">Steps:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Create a <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">.mcp.json</code> file in your project root</li>
                <li>Paste the config above</li>
                <li>Restart VS Code</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Copilot chat to verify</li>
              </ol>
            </div>
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
