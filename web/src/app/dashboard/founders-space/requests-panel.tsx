"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  KeyRound,
  FileText,
  Shield,
  HelpCircle,
  Send,
  ChevronDown,
  User,
  FolderOpen,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  created_at: string;
  resolve_note: string | null;
  resolved_at: string | null;
  users?: { email: string } | null;
  resolver?: { email: string } | null;
  fs_projects?: { name: string } | null;
}

const CATEGORIES = [
  { value: "credential", label: "Credential / API Key", icon: KeyRound },
  { value: "document", label: "Document", icon: FileText },
  { value: "access", label: "Access / Permission", icon: Shield },
  { value: "other", label: "Other", icon: HelpCircle },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Circle }> = {
  pending: { label: "Pending", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Circle },
  in_progress: { label: "In Progress", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Clock },
  done: { label: "Done", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: XCircle },
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RequestsPanel({
  selectedProjectId,
  projects,
  canWrite,
}: {
  selectedProjectId: string | null;
  projects: Project[];
  canWrite: boolean;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("credential");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  // Resolve modal state
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState("done");
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const projectParam = selectedProjectId ? `&project_id=${selectedProjectId}` : "";
      const res = await fetch(`/api/founders-space/requests?x=1${projectParam}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  async function createRequest() {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/founders-space/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          project_id: projectId || selectedProjectId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests((prev) => [data.request, ...prev]);
        setTitle("");
        setDescription("");
        setCategory("credential");
        setProjectId(null);
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to create request:", err);
    } finally {
      setCreating(false);
    }
  }

  async function resolveRequest() {
    if (!resolveId || resolving) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/founders-space/requests/${resolveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolveStatus,
          resolve_note: resolveNote.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequests((prev) =>
          prev.map((r) => (r.id === resolveId ? data.request : r))
        );
        setResolveId(null);
        setResolveNote("");
        setResolveStatus("done");
      }
    } catch (err) {
      console.error("Failed to resolve request:", err);
    } finally {
      setResolving(false);
    }
  }

  const filteredRequests = requests.filter((r) => {
    if (filter === "pending") return r.status === "pending" || r.status === "in_progress";
    if (filter === "done") return r.status === "done" || r.status === "rejected";
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending" || r.status === "in_progress").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-terracotta animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          {(["all", "pending", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? "bg-terracotta text-white"
                  : "bg-ivory border border-sand/60 text-muted hover:text-charcoal"
              }`}
            >
              {f === "all" ? `All (${requests.length})` : f === "pending" ? `Pending (${pendingCount})` : `Resolved (${requests.length - pendingCount})`}
            </button>
          ))}
        </div>

        {/* Only non-admin members create requests */}
        {!canWrite && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            <Plus size={16} />
            New Request
          </button>
        )}
      </div>

      {/* New request form (members only) */}
      {showForm && !canWrite && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-5 space-y-4">
          <h3 className="font-display text-lg text-charcoal">Request from Admin</h3>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need? (e.g., Razorpay test keys for payment integration)"
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details (optional)..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            {/* Category */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Type:</span>
              <div className="flex gap-1">
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        category === cat.value
                          ? "bg-terracotta/10 text-terracotta border border-terracotta/30"
                          : "bg-cream-dark text-muted hover:text-charcoal border border-transparent"
                      }`}
                    >
                      <CatIcon size={12} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Project selector */}
            {projects.length > 0 && !selectedProjectId && (
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="px-2 py-1.5 rounded-lg border border-sand/60 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={createRequest}
              disabled={creating || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Request
            </button>
            <button
              onClick={() => { setShowForm(false); setTitle(""); setDescription(""); }}
              className="px-3 py-2 text-sm text-muted hover:text-charcoal transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolveId && canWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-sand/60 shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-display text-xl text-charcoal">Update Request</h3>

            <div className="flex gap-2">
              {["in_progress", "done", "rejected"].map((s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                return (
                  <button
                    key={s}
                    onClick={() => setResolveStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      resolveStatus === s
                        ? `${meta.bg} ${meta.color}`
                        : "bg-ivory border-sand/60 text-muted hover:text-charcoal"
                    }`}
                  >
                    <Icon size={14} />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Add a note (e.g., 'Keys added to project credentials')..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-ivory text-sm text-charcoal placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={resolveRequest}
                disabled={resolving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
              >
                {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Update
              </button>
              <button
                onClick={() => { setResolveId(null); setResolveNote(""); setResolveStatus("done"); }}
                className="px-3 py-2 text-sm text-muted hover:text-charcoal transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests list */}
      {filteredRequests.length === 0 ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
            <MessageSquarePlus size={24} className="text-terracotta" />
          </div>
          <h3 className="font-display text-lg text-charcoal">
            {filter !== "all" ? `No ${filter} requests` : canWrite ? "No team requests yet" : "No requests yet"}
          </h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            {canWrite
              ? "Team members can request credentials, documents, or access from here."
              : "Need API keys or documents? Send a request to your admin."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const meta = STATUS_META[req.status] ?? STATUS_META.pending;
            const StatusIcon = meta.icon;
            const catInfo = CATEGORIES.find((c) => c.value === req.category) ?? CATEGORIES[3];
            const CatIcon = catInfo.icon;

            return (
              <div
                key={req.id}
                className={`bg-ivory rounded-2xl border p-4 space-y-2 transition-all ${
                  req.status === "pending"
                    ? "border-amber-200"
                    : req.status === "in_progress"
                      ? "border-blue-200"
                      : "border-sand/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <StatusIcon size={14} className={meta.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal">{req.title}</p>
                      {req.description && (
                        <p className="text-xs text-muted mt-0.5 line-clamp-2">{req.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Resolve button for admin/owner */}
                  {canWrite && (req.status === "pending" || req.status === "in_progress") && (
                    <button
                      onClick={() => {
                        setResolveId(req.id);
                        setResolveStatus(req.status === "pending" ? "in_progress" : "done");
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-terracotta/10 text-terracotta text-xs font-medium hover:bg-terracotta/20 transition-all"
                    >
                      {req.status === "pending" ? "Review" : "Resolve"}
                    </button>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 pl-11">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} font-medium`}>
                    {meta.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted bg-cream-dark px-2 py-0.5 rounded-full">
                    <CatIcon size={10} />
                    {catInfo.label}
                  </span>
                  {req.fs_projects?.name && (
                    <span className="flex items-center gap-1 text-xs text-muted bg-cream-dark px-2 py-0.5 rounded-full">
                      <FolderOpen size={10} />
                      {req.fs_projects.name}
                    </span>
                  )}
                  {req.users?.email && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <User size={10} />
                      {req.users.email.split("@")[0]}
                    </span>
                  )}
                  <span className="text-xs text-muted">{formatTimestamp(req.created_at)}</span>
                </div>

                {/* Resolve note */}
                {req.resolve_note && (
                  <div className="ml-11 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                    <span className="font-medium">
                      {req.resolver?.email ? req.resolver.email.split("@")[0] : "Admin"}:
                    </span>{" "}
                    {req.resolve_note}
                    {req.resolved_at && (
                      <span className="text-emerald-500 ml-2">{formatTimestamp(req.resolved_at)}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
