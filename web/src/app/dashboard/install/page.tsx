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

  // Claude Desktop auto-install prompt — handles all edge cases
  const desktopAutoPrompt = `Install the SEER MCP server in my Claude Desktop app. IMPORTANT: Follow these steps exactly.

Step 1: Run these commands and note the output:
- Run "npm install -g mcp-remote" to install the bridge
- Run "npm root -g" to get the global node_modules path (e.g. C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules)
- On Windows run "where node", on Mac run "which node" to get the full path to node (e.g. C:\\Program Files\\nodejs\\node.exe)

Step 2: Find my claude_desktop_config.json. Check ALL these locations and edit whichever exists:
- Windows Store app: Look in %LOCALAPPDATA%\\Packages\\ for a folder starting with "Claude_" then go to LocalCache\\Roaming\\Claude\\claude_desktop_config.json
- Windows regular install: %APPDATA%\\Claude\\claude_desktop_config.json
- Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
If multiple exist, edit ALL of them.

Step 3: Add the seer entry to mcpServers. Preserve all existing settings. CRITICAL RULES:
- Do NOT use "npx" as the command — it does not work with the Windows Store version
- The "command" MUST be the FULL ABSOLUTE path to node.exe (e.g. "C:\\\\Program Files\\\\nodejs\\\\node.exe")
- The first arg MUST be the FULL ABSOLUTE path to proxy.js (e.g. "C:\\\\Users\\\\me\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\mcp-remote\\\\dist\\\\proxy.js")

Example config to add to mcpServers:
{
  "seer": {
    "command": "FULL_PATH_TO_NODE_EXE",
    "args": [
      "FULL_PATH_TO_NPM_GLOBAL/mcp-remote/dist/proxy.js",
      "https://mcp.seermcp.com/mcp",
      "--header",
      "Authorization: Bearer ${key}"
    ]
  }
}

Replace FULL_PATH_TO_NODE_EXE and FULL_PATH_TO_NPM_GLOBAL with the actual paths from Step 1.

After saving, tell me to fully quit Claude Desktop from the system tray (not just close the window) and reopen it.`;

  // Claude Desktop manual config
  const desktopManualConfig = JSON.stringify({
    mcpServers: {
      seer: {
        command: "node",
        args: [
          "REPLACE_WITH_GLOBAL_NODE_MODULES_PATH/mcp-remote/dist/proxy.js",
          "https://mcp.seermcp.com/mcp",
          "--header",
          `Authorization: Bearer ${key}`,
        ],
      },
    },
  }, null, 2);

  // VS Code config (url-based works directly)
  const vscodeConfig = JSON.stringify({
    mcpServers: {
      seer: {
        url: "https://mcp.seermcp.com/mcp",
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2);

  // VS Code auto-install prompt
  const vscodeAutoPrompt = `Set up the SEER MCP server for VS Code. Create or update the .mcp.json file in my current project root with this config:

${vscodeConfig}

If .mcp.json already exists, merge the seer server into the existing mcpServers without removing other servers. After saving, tell me to restart VS Code.`;

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
            <PrerequisiteBadge text="Requires Node.js installed on your system" />
            <CopyBox
              label="Paste this prompt into Claude Code — it will install everything automatically"
              value={desktopAutoPrompt}
              highlight
            />
            <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-3">
              <p className="text-sm text-charcoal font-medium">What this does:</p>
              <ol className="text-sm text-warm-brown-light space-y-2 list-decimal list-inside">
                <li>Installs <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">mcp-remote</code> bridge (connects Claude Desktop to remote MCP servers)</li>
                <li>Finds your config file automatically (works with Windows Store, regular install, and Mac)</li>
                <li>Creates the file if it doesn&apos;t exist, or merges into your existing config</li>
                <li>Preserves any other MCP servers you already have</li>
                <li>After it&apos;s done, quit Claude Desktop from the <strong>system tray</strong> and reopen it</li>
                <li>Type <code className="bg-cream-dark px-1.5 py-0.5 rounded font-mono text-xs text-charcoal">seer status</code> in Chat mode to verify</li>
              </ol>
            </div>

            <details className="group">
              <summary className="text-xs font-semibold text-muted cursor-pointer hover:text-warm-brown transition-colors">
                Manual setup (if you prefer)
              </summary>
              <div className="mt-4 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">Before you start:</p>
                  <p className="text-xs text-amber-600">Run <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">npm install -g mcp-remote</code> in your terminal, then run <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">npm root -g</code> to get your global modules path.</p>
                </div>
                <CopyBox
                  label="Windows Store app — Config file path"
                  value="%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
                />
                <CopyBox
                  label="Windows regular install — Config file path"
                  value="%APPDATA%\Claude\claude_desktop_config.json"
                />
                <CopyBox
                  label="Mac — Config file path"
                  value="~/Library/Application Support/Claude/claude_desktop_config.json"
                />
                <CopyBox
                  label="Add to mcpServers in the config file (replace path with your npm root -g result)"
                  value={desktopManualConfig}
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
                  value={vscodeConfig}
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
