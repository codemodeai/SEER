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

  // Restore session on launch — only if we ourselves previously marked the
  // user as logged in. We deliberately do NOT attach supabase.auth.onAuthStateChange
  // here because its background emissions can re-install a session even after
  // the user has signed out (race with an in-flight setSession promise).
  useEffect(() => {
    if (localStorage.getItem("seer.loggedIn") !== "1") {
      console.log("[SEER] App: no seer.loggedIn flag — staying on Login");
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        console.log("[SEER] App: getSession returned null");
        return;
      }
      const key = await getApiKey(data.session.user.id, data.session.access_token);
      if (key) {
        console.log("[SEER] App: restored session for", data.session.user.id);
        setSession(data.session);
        setApiKey(key);
      } else {
        console.log("[SEER] App: session present but no API key, forcing re-login");
        localStorage.removeItem("seer.loggedIn");
      }
    });
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
    localStorage.setItem("seer.loggedIn", "1");
    setSession(newSession);
    setApiKey(newApiKey);
  }

  function handleLogout() {
    console.log("[SEER] logging out");
    try { stopAgent(); } catch { /* ignore */ }
    // Fire-and-forget the server-side sign-out — don't await it, the Supabase
    // lock can hang in WebView2 and we must not block logout on that.
    void supabase.auth.signOut({ scope: "local" }).catch(() => { /* ignore */ });
    // Wipe every auth-related localStorage key so the next load stays on Login.
    localStorage.removeItem("seer.loggedIn");
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k === "seer.authorize.state")
      .forEach((k) => localStorage.removeItem(k));
    // Hard reload guarantees a clean Login screen regardless of any stale
    // React state, hanging promises, or HMR-cached module instances.
    window.location.reload();
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
