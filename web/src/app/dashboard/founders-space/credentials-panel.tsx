"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Key,
  Loader2,
  X,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Credential {
  id: string;
  label: string;
  environment: string;
  project_id: string | null;
  created_at: string;
  last_used_at: string | null;
  fs_projects: { name: string } | null;
}

const ENV_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  development: { bg: "bg-blue-100", text: "text-blue-700", label: "Dev" },
  staging: { bg: "bg-amber-100", text: "text-amber-700", label: "Staging" },
  production: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Prod" },
};

export default function CredentialsPanel({ teamMode = false, selectedProjectId = null, projects = [] }: { teamMode?: boolean; selectedProjectId?: string | null; projects?: { id: string; name: string }[] }) {
  const { userId } = useDashboard();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [canWrite, setCanWrite] = useState(true);

  // Reveal state
  const [revealId, setRevealId] = useState<string | null>(null);
  const [revealValue, setRevealValue] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formProject, setFormProject] = useState("");
  const [formEnv, setFormEnv] = useState("production");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const fetchCredentials = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (teamMode) params.set("team", "true");
      if (selectedProjectId) params.set("project_id", selectedProjectId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/founders-space/credentials${qs}`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
        if (data.canWrite !== undefined) setCanWrite(data.canWrite);
      }
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
    } finally {
      setLoading(false);
    }
  }, [teamMode, selectedProjectId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Clean up reveal timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  const handleReveal = async (id: string) => {
    if (revealId === id) {
      // Hide
      setRevealId(null);
      setRevealValue(null);
      setRevealCountdown(0);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      return;
    }

    setRevealLoading(true);
    setRevealId(id);
    try {
      const res = await fetch(`/api/founders-space/credentials/${id}`);
      if (!res.ok) throw new Error("Failed to reveal");
      const data = await res.json();
      setRevealValue(data.value);
      setRevealCountdown(10);

      // Update last_used_at locally
      setCredentials((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, last_used_at: new Date().toISOString() } : c
        )
      );

      // Auto-hide countdown
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        setRevealCountdown((prev) => {
          if (prev <= 1) {
            if (revealTimerRef.current) clearInterval(revealTimerRef.current);
            setRevealId(null);
            setRevealValue(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setRevealId(null);
      setRevealValue(null);
    } finally {
      setRevealLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/founders-space/credentials/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        if (revealId === id) {
          setRevealId(null);
          setRevealValue(null);
          if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        }
      }
    } catch (err) {
      console.error("Failed to delete credential:", err);
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formLabel.trim() || !formValue.trim()) {
      setFormError("Label and value are required.");
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/founders-space/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: formLabel.trim(),
          value: formValue,
          project_id: formProject || null,
          environment: formEnv,
          team: teamMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to create credential");
        return;
      }

      setFormLabel("");
      setFormValue("");
      setFormProject("");
      setFormEnv("production");
      setShowModal(false);
      fetchCredentials();
    } catch {
      setFormError("Failed to create credential");
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "--";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="text-terracotta animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-terracotta" />
          <h3 className="font-display text-lg text-charcoal">
            Credentials Vault
          </h3>
          <span className="text-xs text-muted bg-cream-dark px-2 py-0.5 rounded-full">
            AES-256 Encrypted
          </span>
        </div>
        {(!teamMode || canWrite) && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            <Plus size={16} />
            Add Credential{teamMode ? " (Team)" : ""}
          </button>
        )}
      </div>

      {/* Empty state */}
      {credentials.length === 0 ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
            <Key size={24} className="text-terracotta" />
          </div>
          <h3 className="font-display text-lg text-charcoal">
            No credentials yet
          </h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Store API keys, passwords, and secrets securely with AES-256
            encryption. Only you can decrypt them.
          </p>
        </div>
      ) : (
        /* Credentials table */
        <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand/60 bg-cream/50">
                  <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Label
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Environment
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Project
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => {
                  const env = ENV_BADGES[cred.environment] || ENV_BADGES.production;
                  const isRevealed = revealId === cred.id;
                  return (
                    <tr
                      key={cred.id}
                      className="border-b border-sand/30 last:border-b-0 hover:bg-cream/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-charcoal">
                        {cred.label}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {isRevealed && revealValue ? (
                          <div className="flex items-center gap-2">
                            <span className="text-charcoal bg-cream-dark px-2 py-1 rounded break-all max-w-[200px]">
                              {revealValue}
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 text-[10px] whitespace-nowrap">
                              <Clock size={10} />
                              {revealCountdown}s
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted tracking-widest">
                            {"••••••••"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${env.bg} ${env.text}`}
                        >
                          {env.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {cred.fs_projects?.name || "--"}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {formatDate(cred.last_used_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleReveal(cred.id)}
                            disabled={revealLoading && revealId === cred.id}
                            className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors text-muted hover:text-charcoal disabled:opacity-50"
                            title={isRevealed ? "Hide" : "Reveal"}
                          >
                            {revealLoading && revealId === cred.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isRevealed ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                          {deleteId === cred.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(cred.id)}
                                disabled={deleteLoading}
                                className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                              >
                                {deleteLoading ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="p-1 rounded-lg hover:bg-cream-dark transition-colors text-muted"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteId(cred.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-ivory rounded-2xl border border-sand/60 shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sand/60">
              <h3 className="font-display text-lg text-charcoal">
                Add Credential
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormError("");
                }}
                className="p-1 rounded-lg hover:bg-cream-dark transition-colors text-muted"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                  <AlertTriangle size={14} />
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Stripe API Key"
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Value
                </label>
                <input
                  type="password"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="Enter secret value"
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm font-mono placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Environment
                </label>
                <select
                  value={formEnv}
                  onChange={(e) => setFormEnv(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Project{" "}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <select
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                >
                  <option value="">Common (no project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-muted hover:bg-cream-dark transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
