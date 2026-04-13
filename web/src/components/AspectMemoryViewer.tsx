"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Book,
  Box,
  ListTodo,
  Gavel,
  Bug,
  History,
  Clock,
  FileText,
  Loader2,
  Cloud,
  CheckCircle,
  AlertTriangle,
  Trash2,
  X,
  Edit3,
  Save,
} from "lucide-react";

const ASPECTS = [
  { key: "project_overview", label: "Overview", icon: Book },
  { key: "architecture", label: "Architecture", icon: Box },
  { key: "features", label: "Features", icon: ListTodo },
  { key: "decisions", label: "Decisions", icon: Gavel },
  { key: "errors_fixes", label: "Errors & Fixes", icon: Bug },
  { key: "session_log", label: "Session Log", icon: History },
] as const;

type AspectKey = typeof ASPECTS[number]["key"];

interface ProjectSummary {
  name: string;
  aspectCount: number;
  totalBytes: number;
  updatedAt: string;
}

interface AspectRow {
  aspect_type: AspectKey;
  content: string;
  version: number;
  size_bytes: number;
  updated_at: string | null;
  integrityOk?: boolean;
}

interface ProjectDetail {
  project: string;
  scope: "personal" | "agency";
  canWrite: boolean;
  canDelete: boolean;
  aspects: AspectRow[];
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function AspectMemoryViewer({ scope, title, subtitle }: { scope: string; title: string; subtitle: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AspectKey>("project_overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory/aspects?scope=${encodeURIComponent(scope)}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const fetchDetail = useCallback(async (name: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/memory/aspects?scope=${encodeURIComponent(scope)}&project=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = (await res.json()) as ProjectDetail;
        setDetail(data);
      }
    } catch (err) {
      console.error("Failed to fetch project detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, [scope]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    if (selected) {
      fetchDetail(selected);
      setActiveTab("project_overview");
      setEditing(false);
    } else {
      setDetail(null);
    }
  }, [selected, fetchDetail]);

  const currentAspect = detail?.aspects.find(a => a.aspect_type === activeTab);

  async function handleSave() {
    if (!detail || !currentAspect) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/memory/aspects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          project_name: detail.project,
          aspect: activeTab,
          content: draft,
        }),
      });
      if (res.ok) {
        setEditing(false);
        setMessage({ type: "success", text: "Saved." });
        await fetchDetail(detail.project);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/memory/aspects?scope=${encodeURIComponent(scope)}&project=${encodeURIComponent(deleteTarget)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Project memory deleted." });
        if (selected === deleteTarget) setSelected(null);
        setDeleteTarget(null);
        await fetchProjects();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">{title}</h1>
          <p className="text-muted text-sm mt-1">{subtitle}</p>
        </div>
        {!loading && projects.length > 0 && !selected && (
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <FileText size={12} />
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
            <span>{formatBytes(projects.reduce((sum, p) => sum + p.totalBytes, 0))} total</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(projects.reduce((latest, p) => p.updatedAt > latest ? p.updatedAt : latest, projects[0].updatedAt)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm mb-6 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {!selected ? (
        <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Cloud size={32} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">No project memory yet.</p>
              <p className="text-xs text-muted mt-1">
                Run <code className="font-mono bg-sand/30 px-1.5 py-0.5 rounded">seer memory run</code> in any project to initialize.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-sand/30">
              {projects.map(p => (
                <div key={p.name} className="flex items-center justify-between px-5 py-4 hover:bg-cream-dark/50 transition-colors">
                  <button onClick={() => setSelected(p.name)} className="flex items-center gap-4 min-w-0 flex-1 text-left">
                    <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-terracotta" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{p.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted flex items-center gap-1">
                          <Clock size={9} />
                          {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[10px] text-muted">{p.aspectCount}/6 aspects</span>
                        <span className="text-[10px] text-muted">{formatBytes(p.totalBytes)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p.name)}
                    className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Delete project memory"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-sand/30">
            <button onClick={() => setSelected(null)} className="text-xs text-muted hover:text-charcoal transition-colors">
              ← Back to projects
            </button>
            <span className="font-display text-lg text-charcoal">{selected}</span>
            <span className="text-[10px] text-muted uppercase tracking-wider">{detail?.scope}</span>
          </div>

          <div className="flex border-b border-sand/30 overflow-x-auto">
            {ASPECTS.map(a => {
              const Icon = a.icon;
              const row = detail?.aspects.find(r => r.aspect_type === a.key);
              const hasContent = (row?.size_bytes ?? 0) > 0;
              return (
                <button
                  key={a.key}
                  onClick={() => { setActiveTab(a.key); setEditing(false); }}
                  className={`flex items-center gap-2 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === a.key
                      ? "border-terracotta text-terracotta bg-terracotta/5"
                      : "border-transparent text-muted hover:text-charcoal"
                  }`}
                >
                  <Icon size={14} />
                  <span className="font-medium">{a.label}</span>
                  {hasContent && <span className="text-[9px] text-muted">{formatBytes(row!.size_bytes)}</span>}
                </button>
              );
            })}
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : currentAspect ? (
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-[10px] text-muted">
                  {currentAspect.updated_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(currentAspect.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {currentAspect.version > 0 && <span>v{currentAspect.version}</span>}
                  {currentAspect.size_bytes > 0 && (
                    <span className={`inline-flex items-center gap-1 font-semibold ${currentAspect.integrityOk ? "text-green-600" : "text-red-600"}`}>
                      {currentAspect.integrityOk ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                      {currentAspect.integrityOk ? "Integrity OK" : "Hash mismatch"}
                    </span>
                  )}
                </div>
                {detail?.canWrite && !editing && (
                  <button
                    onClick={() => { setDraft(currentAspect.content); setEditing(true); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors"
                  >
                    <Edit3 size={12} />
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={20}
                    className="w-full px-4 py-3 rounded-xl border border-sand/60 bg-white text-xs text-charcoal font-mono leading-relaxed focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all resize-y"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-muted ml-auto">{draft.length.toLocaleString()} chars</span>
                  </div>
                </div>
              ) : (
                <pre className="text-xs text-charcoal bg-cream-dark rounded-xl p-4 border border-sand/40 whitespace-pre-wrap font-mono leading-relaxed max-h-[55vh] overflow-auto">
                  {currentAspect.content || <span className="text-muted italic">(empty — no content yet for this aspect)</span>}
                </pre>
              )}
            </div>
          ) : null}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div
            className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-display text-xl text-charcoal">Delete Project Memory</h2>
                <p className="text-xs text-muted">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-muted mb-5">
              Delete all 6 aspect files for <strong className="text-charcoal">{deleteTarget}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
