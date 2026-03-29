"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  Cloud,
  Upload,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  Clock,
  Hash,
  Eye,
} from "lucide-react";

interface CloudProject {
  id: string;
  name: string;
  hash: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  content: string;
  hash: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  integrityOk: boolean;
}

export default function AgencyMemoryPage() {
  const { agency, role } = useAgency();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ProjectDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showPush, setShowPush] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CloudProject | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = role === "owner" || role === "admin";

  const fetchProjects = useCallback(async () => {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/memory`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (!agency) return null;

  async function handleView(projectName: string) {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/agency/${agency!.slug}/memory?project=${encodeURIComponent(projectName)}`);
      if (res.ok) {
        const data = await res.json();
        setViewing(data.project);
      }
    } catch (err) {
      console.error("Failed to fetch project:", err);
    } finally {
      setViewLoading(false);
    }
  }

  async function handleDelete(projectId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/agency/${agency!.slug}/memory?project_id=${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setMessage({ type: "success", text: "Project memory deleted." });
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      {/* Push modal */}
      {showPush && (
        <PushModal
          slug={agency.slug}
          onClose={() => setShowPush(false)}
          onPushed={() => {
            setShowPush(false);
            fetchProjects();
            setMessage({ type: "success", text: "Memory pushed to cloud." });
          }}
        />
      )}

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewing(null)}>
          <div
            className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl text-charcoal">{viewing.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted">v{viewing.version}</span>
                  {viewing.updatedBy && (
                    <span className="text-[10px] text-muted">by {viewing.updatedBy}</span>
                  )}
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${viewing.integrityOk ? "text-green-600" : "text-red-600"}`}>
                    {viewing.integrityOk ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                    {viewing.integrityOk ? "Integrity OK" : "Hash mismatch"}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewing(null)} className="text-muted hover:text-charcoal transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <pre className="text-xs text-charcoal bg-cream-dark rounded-xl p-4 border border-sand/40 whitespace-pre-wrap font-mono leading-relaxed">
                {viewing.content || "(empty)"}
              </pre>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted">
              <Hash size={10} />
              <code className="font-mono">{viewing.hash.slice(0, 16)}...</code>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
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
              Delete cloud memory for <strong className="text-charcoal">{deleteTarget.name}</strong>?
              All synced content will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 bg-cream-dark border border-sand/60 text-charcoal rounded-xl text-sm font-medium hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={actionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Cloud Memory</h1>
          <p className="text-muted text-sm mt-1">
            Shared .seer_memory.md files synced across the team.
          </p>
        </div>
        <button
          onClick={() => setShowPush(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
        >
          <Upload size={16} />
          Push Memory
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm mb-6 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Projects list */}
      <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <Cloud size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">No projects synced yet.</p>
            <p className="text-xs text-muted mt-1">
              Push a .seer_memory.md file to start sharing with your team.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sand/30">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-cream-dark/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-terracotta" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{project.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(project.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {project.updatedBy && (
                        <span className="text-[10px] text-muted">by {project.updatedBy}</span>
                      )}
                      <span className="text-[10px] text-muted">v{project.version}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleView(project.name)}
                    disabled={viewLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors"
                  >
                    <Eye size={12} />
                    View
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setDeleteTarget(project)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Push Modal ---
function PushModal({
  slug,
  onClose,
  onPushed,
}: {
  slug: string;
  onClose: () => void;
  onPushed: () => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [content, setContent] = useState("");
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");

  async function handlePush(e: React.FormEvent) {
    e.preventDefault();
    setPushing(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${slug}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName.trim(),
          content,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.conflict) {
          setError(`Version conflict: server is at v${data.serverVersion}, your push expected v${data.clientVersion}. Pull the latest first.`);
        } else {
          setError(data.error || "Failed to push.");
        }
        setPushing(false);
        return;
      }

      onPushed();
    } catch {
      setError("Network error. Please try again.");
      setPushing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal">Push Memory to Cloud</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handlePush} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. my-app"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Memory Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your .seer_memory.md content here..."
              rows={12}
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all font-mono text-xs leading-relaxed resize-y"
            />
            <p className="text-[10px] text-muted mt-1">
              {content.length.toLocaleString()} chars — max 500KB
            </p>
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pushing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
          >
            {pushing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {pushing ? "Pushing..." : "Push to Cloud"}
          </button>
        </form>
      </div>
    </div>
  );
}
