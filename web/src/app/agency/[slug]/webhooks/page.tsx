"use client";

import { useAgency } from "@/lib/agency-context";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import FeatureGate from "@/components/agency/FeatureGate";
import {
  Webhook,
  Plus,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  X,
  Clock,
} from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description: string;
  created_at: string;
  recentDeliveries: {
    id: string;
    event: string;
    success: boolean;
    status_code: number | null;
    attempted_at: string;
  }[];
}

const EVENT_LABELS: Record<string, string> = {
  "member.joined": "Member Joined",
  "member.removed": "Member Removed",
  "announcement.created": "Announcement Created",
  "project.created": "Project Created",
  "task.updated": "Task Updated",
  "memory.synced": "Memory Synced",
};

export default function WebhooksPage() {
  const { agency, role } = useAgency();
  const params = useParams();
  const slug = params?.slug as string;

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [secretVisible, setSecretVisible] = useState<Record<string, boolean>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canEdit = role === "owner" || role === "admin";

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/${slug}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${slug}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, events: newEvents, description: newDesc }),
      });

      if (res.ok) {
        const data = await res.json();
        // Store the secret — it's only shown once
        setSecrets((prev) => ({ ...prev, [data.webhook.id]: data.webhook.secret }));
        setSecretVisible((prev) => ({ ...prev, [data.webhook.id]: true }));
        setShowCreate(false);
        setNewUrl("");
        setNewDesc("");
        setNewEvents([]);
        setMessage({ type: "success", text: "Webhook created. Copy the signing secret — it won't be shown again." });
        fetchWebhooks();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create webhook");
      }
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await fetch(`/api/agency/${slug}/webhooks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_id: id, active: !currentActive }),
      });
      fetchWebhooks();
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    try {
      await fetch(`/api/agency/${slug}/webhooks?webhook_id=${id}`, { method: "DELETE" });
      fetchWebhooks();
    } catch {
      // ignore
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/agency/${slug}/webhooks/test`, { method: "POST" });
      if (res.ok) {
        setMessage({ type: "success", text: "Test webhook sent! Check your endpoint." });
        setTimeout(() => fetchWebhooks(), 2000); // Refresh to show delivery
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Test failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  if (!agency) return null;

  return (
    <FeatureGate feature="webhooks" featureLabel="Webhooks" addonPrice="$3/mo">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-charcoal">Webhooks</h1>
            <p className="text-muted text-sm mt-1">
              Receive HTTP notifications when events happen in your agency.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {webhooks.length > 0 && canEdit && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted border border-sand/60 rounded-xl hover:bg-cream-dark transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Test
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
              >
                <Plus size={16} />
                Add Webhook
              </button>
            )}
          </div>
        </div>

        {/* Message banner */}
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-3 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : webhooks.length === 0 ? (
          /* Empty state */
          <div className="bg-ivory border border-sand/60 rounded-2xl p-10 text-center">
            <Webhook size={40} className="text-muted/40 mx-auto mb-4" />
            <h2 className="font-display text-xl text-charcoal mb-2">No webhooks configured</h2>
            <p className="text-muted text-sm mb-6 max-w-md mx-auto">
              Add a webhook endpoint to receive real-time notifications when members join,
              announcements are posted, tasks change, and more.
            </p>
            {canEdit && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
              >
                <Plus size={16} />
                Add Your First Webhook
              </button>
            )}
          </div>
        ) : (
          /* Webhook list */
          <div className="flex flex-col gap-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className={`bg-ivory border rounded-2xl p-5 ${
                  wh.active ? "border-sand/60" : "border-sand/40 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          wh.active ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <p className="text-sm font-mono text-charcoal truncate">{wh.url}</p>
                    </div>
                    {wh.description && (
                      <p className="text-xs text-muted ml-4 mb-2">{wh.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 ml-4">
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-terracotta/10 text-terracotta rounded-md"
                        >
                          {EVENT_LABELS[ev] ?? ev}
                        </span>
                      ))}
                    </div>

                    {/* Signing secret (only shown if just created) */}
                    {secrets[wh.id] && (
                      <div className="mt-3 ml-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-600 mb-1">
                          Signing Secret (copy now — shown once)
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-amber-800 font-mono flex-1 break-all">
                            {secretVisible[wh.id] ? secrets[wh.id] : "••••••••••••••••"}
                          </code>
                          <button
                            onClick={() => setSecretVisible((p) => ({ ...p, [wh.id]: !p[wh.id] }))}
                            className="text-amber-600 hover:text-amber-800"
                          >
                            {secretVisible[wh.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(secrets[wh.id]);
                              setMessage({ type: "success", text: "Secret copied to clipboard" });
                            }}
                            className="text-amber-600 hover:text-amber-800"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recent deliveries */}
                    {wh.recentDeliveries.length > 0 && (
                      <div className="mt-3 ml-4">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted mb-1.5">
                          Recent Deliveries
                        </p>
                        <div className="flex flex-col gap-1">
                          {wh.recentDeliveries.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center gap-2 text-xs text-muted"
                            >
                              {d.success ? (
                                <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle size={12} className="text-red-400 flex-shrink-0" />
                              )}
                              <span className="font-mono">{d.event}</span>
                              <span className="text-muted/60">
                                {d.status_code ? `${d.status_code}` : "err"}
                              </span>
                              <span className="ml-auto flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(d.attempted_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(wh.id, wh.active)}
                        title={wh.active ? "Disable" : "Enable"}
                      >
                        {wh.active ? (
                          <ToggleRight size={28} className="text-terracotta" />
                        ) : (
                          <ToggleLeft size={28} className="text-muted" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
                        title="Delete webhook"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Webhook Modal */}
        {showCreate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowCreate(false)}
          >
            <div
              className="bg-ivory border border-sand/60 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                    <Webhook size={20} className="text-terracotta" />
                  </div>
                  <h3 className="font-display text-lg text-charcoal">Add Webhook</h3>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-lg bg-cream-dark flex items-center justify-center text-muted hover:text-charcoal"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                {/* URL */}
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/webhooks/seer"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all font-mono"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="e.g. Slack notifications, CI/CD trigger"
                    maxLength={200}
                    className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
                  />
                </div>

                {/* Events */}
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-2">
                    Events
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(EVENT_LABELS).map(([event, label]) => (
                      <button
                        key={event}
                        type="button"
                        onClick={() => toggleEvent(event)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                          newEvents.includes(event)
                            ? "bg-terracotta/10 border-terracotta/30 text-terracotta"
                            : "bg-cream-dark border-sand/50 text-muted hover:border-terracotta/20"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {newEvents.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1.5">Select at least one event</p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-muted border border-sand/60 rounded-xl hover:bg-cream-dark transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || newEvents.length === 0 || !newUrl}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-semibold hover:bg-terracotta/90 transition-all disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {creating ? "Creating..." : "Create Webhook"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
