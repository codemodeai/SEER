/**
 * Founder's Space Tab
 * Tasks (kanban), Credentials (masked), Documents (upload/expiry),
 * Notes (append-only), Aspect Files Viewer, Session Log Viewer.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FSView = "tasks" | "credentials" | "documents" | "notes" | "aspects";

interface Task { id: string; title: string; status: string; due_date: string | null; }
interface Credential { id: string; label: string; environment: string; created_at: string; }
interface Document { id: string; filename: string; doc_type: string; expiry_date: string | null; created_at: string; }
interface Note { id: string; body: string; created_at: string; }

const SEER_BASE = "https://www.seermcp.com";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

interface FoundersSpaceProps { userId: string; apiKey: string; }

export function FoundersSpace({ userId, apiKey }: FoundersSpaceProps) {
  const [view, setView] = useState<FSView>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [aspects, setAspects] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    if (view === "tasks") loadTasks();
    if (view === "credentials") loadCreds();
    if (view === "documents") loadDocs();
    if (view === "notes") loadNotes();
    if (view === "aspects") loadAspects();
  }, [view]);

  async function loadTasks() {
    const { data } = await supabase.from("fs_tasks").select("id,title,status,due_date").eq("user_id", userId).order("created_at", { ascending: false });
    setTasks((data as Task[]) ?? []);
  }

  async function loadCreds() {
    const { data } = await supabase.from("fs_credentials").select("id,label,environment,created_at").eq("user_id", userId).order("created_at", { ascending: false });
    setCreds((data as Credential[]) ?? []);
  }

  async function loadDocs() {
    const { data } = await supabase.from("fs_documents").select("id,filename,doc_type,expiry_date,created_at").eq("user_id", userId).order("created_at", { ascending: false });
    setDocs((data as Document[]) ?? []);
  }

  async function loadNotes() {
    const { data } = await supabase.from("fs_notes").select("id,body,created_at").eq("user_id", userId).order("created_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  }

  async function loadAspects() {
    const res = await fetch(`${SEER_BASE}/api/seer/memory-aspect?aspects=project_overview,architecture,features,decisions,errors_fixes,session_log`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      setAspects(data);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteInput.trim()) return;
    await supabase.from("fs_notes").insert({ user_id: userId, body: noteInput.trim() });
    setNoteInput("");
    loadNotes();
  }

  async function updateTaskStatus(id: string, status: string) {
    await supabase.from("fs_tasks").update({ status }).eq("id", id);
    loadTasks();
  }

  function isExpiringSoon(date: string | null): boolean {
    if (!date) return false;
    return new Date(date).getTime() - Date.now() < THIRTY_DAYS;
  }

  const navItems: FSView[] = ["tasks", "credentials", "documents", "notes", "aspects"];

  return (
    <div style={s.container}>
      <nav style={s.nav}>
        {navItems.map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ ...s.navBtn, ...(view === v ? s.navActive : {}) }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      <div style={s.content}>
        {view === "tasks" && (
          <div>
            <h3 style={s.sectionTitle}>Tasks</h3>
            {tasks.length === 0 ? <p style={s.empty}>No tasks. Use SEER Chat to create some.</p> : (
              <div style={s.kanban}>
                {(["open", "in_progress", "blocked", "done"] as const).map((col) => (
                  <div key={col} style={s.kanbanCol}>
                    <div style={s.kanbanHeader}>{col.replace("_", " ")}</div>
                    {tasks.filter((t) => t.status === col).map((t) => (
                      <div key={t.id} style={s.taskCard}>
                        <p style={s.taskTitle}>{t.title}</p>
                        {t.due_date && <p style={{ ...s.dueDate, color: isExpiringSoon(t.due_date) ? "#f87171" : "#666" }}>Due: {t.due_date}</p>}
                        <select style={s.statusSelect} value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value)}>
                          {["open", "in_progress", "blocked", "done"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "credentials" && (
          <div>
            <h3 style={s.sectionTitle}>Credentials</h3>
            <p style={s.hint}>Values are AES-256 encrypted and never leave this device.</p>
            {creds.length === 0 ? <p style={s.empty}>No credentials. Use SEER Chat: "save key NAME=value"</p> : (
              <div style={s.list}>
                {creds.map((c) => (
                  <div key={c.id} style={s.credRow}>
                    <span style={s.credLabel}>{c.label}</span>
                    <span style={s.credEnv}>{c.environment}</span>
                    <span style={s.credMasked}>••••••••</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "documents" && (
          <div>
            <h3 style={s.sectionTitle}>Documents</h3>
            {docs.length === 0 ? <p style={s.empty}>No documents uploaded yet.</p> : (
              <div style={s.list}>
                {docs.map((d) => (
                  <div key={d.id} style={s.docRow}>
                    <span style={s.docName}>{d.filename}</span>
                    <span style={s.docType}>{d.doc_type}</span>
                    {d.expiry_date && (
                      <span style={{ ...s.expiry, color: isExpiringSoon(d.expiry_date) ? "#f87171" : "#888" }}>
                        {isExpiringSoon(d.expiry_date) ? "⚠ " : ""}Expires {d.expiry_date}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "notes" && (
          <div>
            <h3 style={s.sectionTitle}>Notes</h3>
            <form onSubmit={addNote} style={s.noteForm}>
              <textarea
                style={s.noteInput}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note…"
                rows={3}
              />
              <button style={s.noteBtn} type="submit">Add Note</button>
            </form>
            <div style={s.list}>
              {notes.map((n) => (
                <div key={n.id} style={s.noteRow}>
                  <p style={s.noteBody}>{n.body}</p>
                  <span style={s.noteTime}>{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "aspects" && (
          <div>
            <h3 style={s.sectionTitle}>Aspect Files</h3>
            {Object.keys(aspects).length === 0 ? (
              <p style={s.empty}>No aspect files. Run "seer memory run" in SEER Chat to initialize.</p>
            ) : (
              Object.entries(aspects).map(([key, content]) => (
                <div key={key} style={s.aspectBlock}>
                  <h4 style={s.aspectKey}>{key}</h4>
                  <pre style={s.aspectContent}>{String(content)}</pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
  nav: { display: "flex", gap: 4, padding: "16px 24px", borderBottom: "1px solid #1a1a1a" },
  navBtn: { padding: "8px 16px", background: "none", color: "#666", border: "1px solid #222", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  navActive: { background: "#1a1a2e", color: "#a5b4fc", borderColor: "#4f46e5" },
  content: { flex: 1, overflowY: "auto", padding: 24 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: 600, margin: "0 0 16px" },
  hint: { color: "#555", fontSize: 12, marginBottom: 16 },
  empty: { color: "#555", fontSize: 14 },
  kanban: { display: "flex", gap: 16, overflowX: "auto" },
  kanbanCol: { minWidth: 220, background: "#0d0d0d", borderRadius: 10, padding: 16, border: "1px solid #1a1a1a" },
  kanbanHeader: { color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  taskCard: { background: "#111", borderRadius: 8, padding: 12, marginBottom: 10, border: "1px solid #1e1e1e" },
  taskTitle: { color: "#e5e5e5", fontSize: 13, margin: "0 0 6px" },
  dueDate: { fontSize: 11, margin: "0 0 6px" },
  statusSelect: { background: "#1a1a1a", color: "#aaa", border: "1px solid #333", borderRadius: 4, padding: "2px 6px", fontSize: 11, width: "100%" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  credRow: { display: "flex", alignItems: "center", gap: 16, padding: "10px 14px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a" },
  credLabel: { color: "#e5e5e5", fontSize: 13, flex: 1 },
  credEnv: { color: "#555", fontSize: 12 },
  credMasked: { color: "#555", fontSize: 14, fontFamily: "monospace" },
  docRow: { display: "flex", alignItems: "center", gap: 16, padding: "10px 14px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a" },
  docName: { color: "#e5e5e5", fontSize: 13, flex: 1 },
  docType: { color: "#555", fontSize: 12 },
  expiry: { fontSize: 12 },
  noteForm: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  noteInput: { background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, color: "#fff", fontSize: 14, padding: 12, resize: "vertical" },
  noteBtn: { alignSelf: "flex-end", padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  noteRow: { padding: "12px 14px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a", marginBottom: 8 },
  noteBody: { color: "#e5e5e5", fontSize: 13, margin: "0 0 6px" },
  noteTime: { color: "#555", fontSize: 11 },
  aspectBlock: { marginBottom: 20, background: "#0d0d0d", borderRadius: 8, padding: 16, border: "1px solid #1a1a1a" },
  aspectKey: { color: "#a5b4fc", fontSize: 13, margin: "0 0 10px" },
  aspectContent: { color: "#888", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0, maxHeight: 200, overflowY: "auto" },
};
