/**
 * Dashboard Tab
 * - Project overview (from Supabase projects table)
 * - Last 10 agent actions (from seer_logs)
 * - Agent status (online/offline, connected tools, sync status)
 * - Common Insights (cached)
 * NO usage gauge — usage lives in Settings only
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  goal: string;
  status: string;
}

interface SeerLog {
  id: string;
  tool_used: string;
  raw_tokens: number;
  optimized_tokens: number;
  created_at: string;
}

interface DashboardProps {
  userId: string;
  agentOnline: boolean;
  agentPlan: string;
}

export function Dashboard({ userId, agentOnline, agentPlan }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<SeerLog[]>([]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, goal, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setProjects((data as Project[]) ?? []));

    supabase
      .from("seer_logs")
      .select("id, tool_used, raw_tokens, optimized_tokens, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setLogs((data as SeerLog[]) ?? []));
  }, [userId]);

  return (
    <div style={s.page}>
      {/* Agent Status Bar */}
      <div style={s.statusBar}>
        <span style={{ ...s.dot, background: agentOnline ? "#22c55e" : "#ef4444" }} />
        <span style={s.statusText}>
          Agent {agentOnline ? "online" : "offline"} · Plan: {agentPlan}
        </span>
      </div>

      <h2 style={s.heading}>Projects</h2>
      {projects.length === 0 ? (
        <p style={s.empty}>No projects yet. Type a task in SEER Chat to get started.</p>
      ) : (
        <div style={s.projectGrid}>
          {projects.map((p) => (
            <div key={p.id} style={s.projectCard}>
              <div style={s.projectName}>{p.name}</div>
              <div style={s.projectGoal}>{p.goal}</div>
              <span style={{ ...s.badge, background: p.status === "active" ? "#16a34a22" : "#33333366", color: p.status === "active" ? "#22c55e" : "#888" }}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 style={s.heading}>Recent Activity</h2>
      <div style={s.logList}>
        {logs.length === 0 ? (
          <p style={s.empty}>No activity yet.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={s.logRow}>
              <span style={s.logTool}>{log.tool_used}</span>
              <span style={s.logMeta}>
                {log.raw_tokens}→{log.optimized_tokens} tokens ·{" "}
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, overflowY: "auto", height: "100%" },
  statusBar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 32, padding: "10px 16px", background: "#111", borderRadius: 8, border: "1px solid #222" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  statusText: { color: "#aaa", fontSize: 13 },
  heading: { color: "#fff", fontSize: 18, fontWeight: 600, margin: "0 0 16px" },
  empty: { color: "#555", fontSize: 14 },
  projectGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 40 },
  projectCard: { background: "#111", border: "1px solid #222", borderRadius: 10, padding: 18 },
  projectName: { color: "#fff", fontWeight: 600, fontSize: 15, marginBottom: 6 },
  projectGoal: { color: "#888", fontSize: 13, marginBottom: 10 },
  badge: { fontSize: 11, padding: "2px 8px", borderRadius: 4 },
  logList: { display: "flex", flexDirection: "column", gap: 8 },
  logRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a" },
  logTool: { color: "#c4b5fd", fontSize: 13 },
  logMeta: { color: "#555", fontSize: 12 },
};
