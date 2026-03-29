"use client";

import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Loader2,
  Radio,
  Clock,
  AlertTriangle,
  Lightbulb,
  X,
  Play,
  Pause,
  Trash2,
  Send,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  userId: string;
  email: string | null;
  projectName: string;
  featureLabel: string;
  status: "active" | "idle";
  lastSeen: string;
  createdAt: string;
}

interface Suggestion {
  type: "conflict" | "available" | "idle";
  message: string;
  featureLabel?: string;
  projectName?: string;
}

export default function AgencyActivityPage() {
  const { agency, role, userId } = useAgency();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeartbeat, setShowHeartbeat] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = role === "owner" || role === "admin";

  const fetchActivity = useCallback(async () => {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
        setSuggestions(data.suggestions ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  useEffect(() => {
    fetchActivity();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  if (!agency) return null;

  const activeCount = activities.filter((a) => a.status === "active").length;
  const idleCount = activities.filter((a) => a.status === "idle").length;

  async function handleDelete(activityId: string) {
    try {
      const res = await fetch(
        `/api/agency/${agency!.slug}/activity?activity_id=${activityId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== activityId));
        setMessage({ type: "success", text: "Activity cleared." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to clear activity." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div>
      {/* Heartbeat Modal */}
      {showHeartbeat && (
        <HeartbeatModal
          slug={agency.slug}
          onClose={() => setShowHeartbeat(false)}
          onSent={() => {
            setShowHeartbeat(false);
            fetchActivity();
            setMessage({ type: "success", text: "Activity heartbeat sent." });
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Team Activity</h1>
          <p className="text-muted text-sm mt-1">
            See who&apos;s working on what across your team in near real-time.
          </p>
        </div>
        <button
          onClick={() => setShowHeartbeat(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
        >
          <Send size={16} />
          Send Heartbeat
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

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border ${
                s.type === "conflict"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              }`}
            >
              {s.type === "conflict" ? (
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              ) : (
                <Lightbulb size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-ivory border border-sand/60 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">Active Now</p>
          <p className="font-display text-2xl text-charcoal mt-1">{activeCount}</p>
        </div>
        <div className="bg-ivory border border-sand/60 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">Idle</p>
          <p className="font-display text-2xl text-charcoal mt-1">{idleCount}</p>
        </div>
        <div className="bg-ivory border border-sand/60 rounded-2xl px-5 py-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">Suggestions</p>
          <p className="font-display text-2xl text-charcoal mt-1">{suggestions.length}</p>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-ivory border border-sand/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <Activity size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">No activity yet.</p>
            <p className="text-xs text-muted mt-1">
              Send a heartbeat to let your team know what you&apos;re working on.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sand/30">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-cream-dark/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Status indicator */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activity.status === "active"
                        ? "bg-green-100"
                        : "bg-sand/30"
                    }`}
                  >
                    {activity.status === "active" ? (
                      <Radio size={18} className="text-green-600" />
                    ) : (
                      <Pause size={18} className="text-muted" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {activity.email?.split("@")[0] ?? "Unknown"}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                          activity.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-sand/30 text-muted"
                        }`}
                      >
                        {activity.status === "active" ? (
                          <Play size={8} />
                        ) : (
                          <Pause size={8} />
                        )}
                        {activity.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted font-medium">
                        {activity.projectName}
                      </span>
                      {activity.featureLabel && (
                        <>
                          <span className="text-[10px] text-muted">/</span>
                          <span className="text-xs text-terracotta font-medium">
                            {activity.featureLabel}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={9} className="text-muted" />
                      <span className="text-[10px] text-muted">
                        {timeAgo(activity.lastSeen)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(canManage || activity.userId === userId) && (
                  <button
                    onClick={() => handleDelete(activity.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Clear activity"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh notice */}
      <p className="text-[10px] text-muted text-center mt-4">
        Auto-refreshes every 30 seconds. Members go idle after 10 minutes of inactivity.
      </p>
    </div>
  );
}

// --- Heartbeat Modal ---
function HeartbeatModal({
  slug,
  onClose,
  onSent,
}: {
  slug: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [featureLabel, setFeatureLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/agency/${slug}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName.trim(),
          feature_label: featureLabel.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send heartbeat.");
        setSending(false);
        return;
      }

      onSent();
    } catch {
      setError("Network error. Please try again.");
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal">Send Activity Heartbeat</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted mb-4">
          Let your team know what you&apos;re working on. Your status will show as active
          and auto-idle after 10 minutes.
        </p>

        <form onSubmit={handleSend} className="flex flex-col gap-4">
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
              Feature / Module
            </label>
            <input
              type="text"
              value={featureLabel}
              onChange={(e) => setFeatureLabel(e.target.value)}
              placeholder="e.g. authentication, payments, dashboard"
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
            />
            <p className="text-[10px] text-muted mt-1">
              Optional — helps detect conflicts when two people work on the same feature.
            </p>
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Sending..." : "Send Heartbeat"}
          </button>
        </form>
      </div>
    </div>
  );
}
