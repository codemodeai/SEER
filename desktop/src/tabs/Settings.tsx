/**
 * Settings Tab — Connections, Usage, Account, Updates
 */

import { useEffect, useState } from "react";
import { sendToAgent } from "@/lib/agent";
import { supabase } from "@/lib/supabase";

type AITool =
  | "claude-cli"
  | "claude-desktop"
  | "vscode"
  | "codex"
  | "cursor"
  | "windsurf"
  | "antigravity"
  | "lovable";

type SettingsView = "connections" | "usage" | "account";

interface User {
  seer_api_key: string;
  plan: string;
  usage_calls: number;
  usage_limit: number | null;
  email: string;
}

interface SettingsProps {
  userId: string;
  apiKey: string;
  onLogout: () => void;
}

const TOOLS: Array<{ id: AITool; label: string; desc: string }> = [
  { id: "claude-cli", label: "Claude Code CLI", desc: "Writes ~/.claude/mcp.json" },
  { id: "claude-desktop", label: "Claude Desktop", desc: "Writes system Claude Desktop config" },
  { id: "vscode", label: "VS Code", desc: "Writes ~/.mcp.json" },
  { id: "codex", label: "OpenAI Codex", desc: "Writes ~/.codex/config.toml" },
  { id: "cursor", label: "Cursor", desc: "Writes ~/.cursor/mcp.json" },
  { id: "windsurf", label: "Windsurf", desc: "Writes Cascade MCP config" },
  { id: "antigravity", label: "Antigravity", desc: "Writes ~/mcp_config.json" },
  { id: "lovable", label: "Lovable", desc: "Writes ~/.lovable/mcp.json" },
];

export function Settings({ userId, apiKey, onLogout }: SettingsProps) {
  const [view, setView] = useState<SettingsView>("connections");
  const [user, setUser] = useState<User | null>(null);
  const [connecting, setConnecting] = useState<AITool | null>(null);
  const [connectedTools, setConnectedTools] = useState<Set<AITool>>(new Set());
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null);
  const [agentVersion, setAgentVersion] = useState<string>("—");

  useEffect(() => {
    supabase
      .from("users")
      .select("seer_api_key,plan,usage_calls,usage_limit,email")
      .eq("id", userId)
      .single()
      .then(({ data }) => setUser(data as User));

    // Request agent status to get version
    sendToAgent("status", {}, (res) => {
      if (res.type === "status") {
        const payload = res.payload as { version?: string };
        if (payload.version) setAgentVersion(payload.version);
      } else if (res.type === "update-available") {
        const payload = res.payload as { version: string; url: string };
        setUpdateInfo(payload);
      }
    });
  }, [userId]);

  function connectTool(tool: AITool) {
    setConnecting(tool);
    sendToAgent("connect-tool", { tool, mcpUrl: "https://www.seermcp.com", apiKey }, (res) => {
      setConnecting(null);
      if (res.type === "status") {
        setConnectedTools((prev) => new Set([...prev, tool]));
      }
    });
  }

  const usagePct = user
    ? user.usage_limit
      ? Math.round((user.usage_calls / user.usage_limit) * 100)
      : 0
    : 0;

  const gaugeColor =
    usagePct >= 90 ? "#ef4444" : usagePct >= 75 ? "#f59e0b" : "#22c55e";

  function handleLogout() {
    console.log("[SEER] Settings: Sign out clicked");
    // Fire and forget the server-side sign-out.
    void supabase.auth.signOut({ scope: "local" }).catch(() => { /* ignore */ });
    // Wipe every Supabase auth key locally plus our own logged-in marker.
    localStorage.removeItem("seer.loggedIn");
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k === "seer.authorize.state")
      .forEach((k) => localStorage.removeItem(k));
    // Notify parent for cleanup (stops the agent, etc.).
    try { onLogout(); } catch (e) { console.warn("[SEER] onLogout threw:", e); }
    // Hard reload — guarantees a clean Login screen regardless of the auth
    // listener race conditions or any stale in-flight setSession promise.
    window.location.reload();
  }

  return (
    <div style={s.container}>
      <nav style={s.nav}>
        {(["connections", "usage", "account"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ ...s.navBtn, ...(view === v ? s.navActive : {}) }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <div style={s.content}>
        {view === "connections" && (
          <div>
            <h3 style={s.title}>AI Tool Connections</h3>
            <p style={s.hint}>One click writes the SEER MCP config for each tool. All surfaces of that tool connect simultaneously.</p>
            <div style={s.toolGrid}>
              {TOOLS.map((tool) => {
                const connected = connectedTools.has(tool.id);
                const busy = connecting === tool.id;
                return (
                  <div key={tool.id} style={s.toolCard}>
                    <div>
                      <p style={s.toolLabel}>{tool.label}</p>
                      <p style={s.toolDesc}>{tool.desc}</p>
                    </div>
                    <button
                      style={{ ...s.connectBtn, ...(connected ? s.connected : {}), ...(busy ? s.connecting : {}) }}
                      onClick={() => connectTool(tool.id)}
                      disabled={busy || connected}
                    >
                      {busy ? "Connecting…" : connected ? "Connected ✓" : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>

            {updateInfo && (
              <div style={s.updateBanner}>
                <p style={s.updateText}>Agent update available: v{updateInfo.version}</p>
                <a href={updateInfo.url} target="_blank" rel="noreferrer" style={s.updateLink}>Download</a>
              </div>
            )}
          </div>
        )}

        {view === "usage" && (
          <div>
            <h3 style={s.title}>Usage</h3>
            {user && (
              <>
                <div style={s.gauge}>
                  <div style={{ ...s.gaugeFill, width: `${Math.min(usagePct, 100)}%`, background: gaugeColor }} />
                </div>
                <p style={s.gaugePct}>{usagePct}% used this month</p>
                <p style={s.gaugeSub}>{user.usage_calls} / {user.usage_limit ?? "∞"} calls · Plan: {user.plan}</p>

                {usagePct >= 75 && (
                  <div style={s.topupBox}>
                    <p style={s.topupText}>Running low on usage. Top up to keep building.</p>
                    <div style={s.topupBtns}>
                      <button style={s.topupBtn}>+25% — $2</button>
                      <button style={s.topupBtn}>+50% — $4</button>
                      <button style={s.topupBtn}>+100% — $7</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === "account" && (
          <div>
            <h3 style={s.title}>Account</h3>
            <div style={s.accountCard}>
              {user ? (
                <>
                  <p style={s.accountEmail}>{user.email}</p>
                  <p style={s.accountPlan}>Plan: <strong>{user.plan}</strong></p>
                  <div style={s.apiKeyRow}>
                    <span style={s.apiKeyLabel}>API Key</span>
                    <span style={s.apiKeyValue}>{user.seer_api_key.slice(0, 12)}••••••••</span>
                  </div>
                </>
              ) : (
                <p style={s.accountPlan}>Loading account…</p>
              )}
              <p style={s.agentVer}>Agent version: {agentVersion}</p>
              <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%" },
  nav: { display: "flex", gap: 4, padding: "16px 24px", borderBottom: "1px solid #1a1a1a" },
  navBtn: { padding: "8px 16px", background: "none", color: "#666", border: "1px solid #222", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  navActive: { background: "#1a1a2e", color: "#a5b4fc", borderColor: "#4f46e5" },
  content: { flex: 1, overflowY: "auto", padding: 32 },
  title: { color: "#fff", fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
  hint: { color: "#555", fontSize: 13, marginBottom: 24 },
  toolGrid: { display: "flex", flexDirection: "column", gap: 12 },
  toolCard: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#111", borderRadius: 10, border: "1px solid #1e1e1e" },
  toolLabel: { color: "#e5e5e5", fontSize: 14, fontWeight: 600, margin: 0 },
  toolDesc: { color: "#555", fontSize: 12, margin: "4px 0 0" },
  connectBtn: { padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  connected: { background: "#14532d", color: "#22c55e", cursor: "default" },
  connecting: { background: "#1e1b4b", opacity: 0.7 },
  updateBanner: { marginTop: 24, padding: "14px 18px", background: "#1c1917", borderRadius: 10, border: "1px solid #292524", display: "flex", alignItems: "center", justifyContent: "space-between" },
  updateText: { color: "#fbbf24", fontSize: 13, margin: 0 },
  updateLink: { color: "#fbbf24", fontSize: 13 },
  gauge: { height: 10, background: "#1a1a1a", borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  gaugeFill: { height: "100%", borderRadius: 5, transition: "width 0.3s" },
  gaugePct: { color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 4px" },
  gaugeSub: { color: "#666", fontSize: 13, marginBottom: 24 },
  topupBox: { padding: 20, background: "#111", borderRadius: 10, border: "1px solid #1e1e1e" },
  topupText: { color: "#e5e5e5", fontSize: 14, marginBottom: 14 },
  topupBtns: { display: "flex", gap: 10 },
  topupBtn: { padding: "8px 20px", background: "#1a1a1a", color: "#a5b4fc", border: "1px solid #2d2d2d", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  accountCard: { padding: 24, background: "#111", borderRadius: 12, border: "1px solid #1e1e1e", maxWidth: 400 },
  accountEmail: { color: "#e5e5e5", fontSize: 15, fontWeight: 600, margin: "0 0 4px" },
  accountPlan: { color: "#888", fontSize: 13, marginBottom: 20 },
  apiKeyRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d0d0d", borderRadius: 8, marginBottom: 16 },
  apiKeyLabel: { color: "#666", fontSize: 12 },
  apiKeyValue: { color: "#a5b4fc", fontFamily: "monospace", fontSize: 13 },
  agentVer: { color: "#555", fontSize: 12, marginBottom: 20 },
  logoutBtn: { padding: "10px 24px", background: "#1a0a0a", color: "#f87171", border: "1px solid #3f1515", borderRadius: 6, cursor: "pointer", fontSize: 13 },
};
