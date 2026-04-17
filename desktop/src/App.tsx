/**
 * SEER Desktop App — Root Component
 * Manages auth state, agent lifecycle, and tab navigation.
 */

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, getApiKey } from "@/lib/supabase";
import { startAgent, stopAgent, onAgentMessage } from "@/lib/agent";
import { Login } from "@/screens/Login";
import { Dashboard } from "@/tabs/Dashboard";
import { SeerChat } from "@/tabs/SeerChat";
import { FoundersSpace } from "@/tabs/FoundersSpace";
import { Settings } from "@/tabs/Settings";

type Tab = "chat" | "dashboard" | "space" | "settings";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [agentOnline, setAgentOnline] = useState(false);
  const [agentPlan, setAgentPlan] = useState("—");

  // Restore session on launch
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const key = await getApiKey(data.session.user.id);
        if (key) {
          setSession(data.session);
          setApiKey(key);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, s) => {
      if (s) {
        const key = await getApiKey(s.user.id);
        if (key) { setSession(s); setApiKey(key); }
      } else {
        setSession(null);
        setApiKey(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Start agent when authenticated
  useEffect(() => {
    if (!apiKey) return;

    startAgent(apiKey);

    const unsub = onAgentMessage((msg) => {
      if (msg.type === "network-status") {
        setAgentOnline((msg.payload as { online: boolean }).online);
      }
      if (msg.type === "status") {
        const p = msg.payload as { plan?: string; online?: boolean };
        if (p.plan) setAgentPlan(p.plan);
        if (typeof p.online === "boolean") setAgentOnline(p.online);
      }
    });

    return () => {
      unsub();
      stopAgent();
    };
  }, [apiKey]);

  function handleLogin(newSession: Session, newApiKey: string) {
    setSession(newSession);
    setApiKey(newApiKey);
  }

  function handleLogout() {
    setSession(null);
    setApiKey(null);
    stopAgent();
  }

  if (!session || !apiKey) {
    return <Login onLogin={handleLogin} />;
  }

  const userId = session.user.id;

  return (
    <div style={s.shell}>
      {/* Sidebar nav */}
      <aside style={s.sidebar}>
        <div style={s.logo}>SEER</div>
        {(["chat", "dashboard", "space", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...s.navBtn, ...(tab === t ? s.navActive : {}) }}
          >
            {tabLabel(t)}
          </button>
        ))}
        <div style={s.sidebarBottom}>
          <div style={{ ...s.statusDot, background: agentOnline ? "#22c55e" : "#ef4444" }} />
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        {tab === "chat" && <SeerChat userId={userId} apiKey={apiKey} />}
        {tab === "dashboard" && <Dashboard userId={userId} agentOnline={agentOnline} agentPlan={agentPlan} />}
        {tab === "space" && <FoundersSpace userId={userId} apiKey={apiKey} />}
        {tab === "settings" && <Settings userId={userId} apiKey={apiKey} onLogout={handleLogout} />}
      </main>
    </div>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case "chat": return "Chat";
    case "dashboard": return "Dashboard";
    case "space": return "Founder's Space";
    case "settings": return "Settings";
  }
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", height: "100vh", background: "#0a0a0a", fontFamily: "system-ui, sans-serif" },
  sidebar: { width: 180, background: "#0d0d0d", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", padding: "20px 12px", gap: 4 },
  logo: { color: "#fff", fontSize: 20, fontWeight: 700, padding: "0 8px", marginBottom: 24, letterSpacing: -0.5 },
  navBtn: { padding: "10px 12px", textAlign: "left", background: "none", color: "#666", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 },
  navActive: { background: "#1a1a2e", color: "#a5b4fc" },
  sidebarBottom: { marginTop: "auto", padding: "8px 12px" },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  main: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
};
