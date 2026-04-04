"use client";

import FeatureGate from "@/components/agency/FeatureGate";
import { useAgency } from "@/lib/agency-context";
import { useEffect, useState, useCallback } from "react";
import {
  Megaphone,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  User,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_id: string;
  authorEmail: string;
  created_at: string;
  updated_at: string;
}

export default function AgencyAnnouncementsPage() {
  const { agency, role } = useAgency();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = role === "owner" || role === "admin";

  const fetchAnnouncements = useCallback(async () => {
    if (!agency) return;
    try {
      const res = await fetch(`/api/agency/${agency.slug}/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  if (!agency) return null;

  if (!agency.enabledFeatures?.announcements) {
    return (
      <FeatureGate feature="announcements" featureLabel="Announcements" addonPrice="Free">
        <></>
      </FeatureGate>
    );
  }

  async function handleTogglePin(ann: Announcement) {
    try {
      const res = await fetch(`/api/agency/${agency!.slug}/announcements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement_id: ann.id, pinned: !ann.pinned }),
      });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev
            .map((a) => (a.id === ann.id ? { ...a, pinned: !a.pinned } : a))
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
        );
        setMessage({ type: "success", text: ann.pinned ? "Unpinned." : "Pinned." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update pin." });
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(
        `/api/agency/${agency!.slug}/announcements?announcement_id=${deleting.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== deleting.id));
        setMessage({ type: "success", text: "Announcement deleted." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div>
      {/* Create Modal */}
      {showCreate && (
        <AnnouncementFormModal
          slug={agency.slug}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            fetchAnnouncements();
            setMessage({ type: "success", text: "Announcement posted." });
          }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <AnnouncementFormModal
          slug={agency.slug}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchAnnouncements();
            setMessage({ type: "success", text: "Announcement updated." });
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleting(null)}>
          <div className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-charcoal mb-2">Delete Announcement</h2>
            <p className="text-sm text-muted mb-4">
              Are you sure you want to delete &quot;{deleting.title}&quot;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Announcements</h1>
          <p className="text-muted text-sm mt-1">
            Team-wide updates and announcements from agency admins.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            <Plus size={16} />
            New Announcement
          </button>
        )}
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

      {/* Announcements list */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-ivory border border-sand/60 rounded-2xl text-center py-16">
            <Megaphone size={32} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">No announcements yet.</p>
            {canManage && (
              <p className="text-xs text-muted mt-1">
                Post an announcement to keep your team informed.
              </p>
            )}
          </div>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.id}
              className={`bg-ivory border rounded-2xl px-6 py-5 ${
                ann.pinned ? "border-terracotta/30 bg-terracotta/[0.02]" : "border-sand/60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {ann.pinned && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-terracotta/10 text-terracotta">
                        <Pin size={8} />
                        Pinned
                      </span>
                    )}
                    <h3 className="font-display text-lg text-charcoal">{ann.title}</h3>
                  </div>
                  {ann.body && (
                    <p className="text-sm text-charcoal/80 mt-2 whitespace-pre-wrap leading-relaxed">
                      {ann.body}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <User size={10} />
                      {ann.authorEmail.split("@")[0]}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(ann.created_at)}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePin(ann)}
                      className="p-2 text-muted hover:text-terracotta rounded-lg hover:bg-cream-dark transition-colors"
                      title={ann.pinned ? "Unpin" : "Pin"}
                    >
                      {ann.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      onClick={() => setEditing(ann)}
                      className="p-2 text-muted hover:text-charcoal rounded-lg hover:bg-cream-dark transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(ann)}
                      className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Create / Edit Modal ---
function AnnouncementFormModal({
  slug,
  existing,
  onClose,
  onSaved,
}: {
  slug: string;
  existing?: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const isEdit = !!existing;
      const res = await fetch(`/api/agency/${slug}/announcements`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { announcement_id: existing.id, title: title.trim(), body: body.trim(), pinned }
            : { title: title.trim(), body: body.trim(), pinned }
        ),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save.");
        setSaving(false);
        return;
      }

      onSaved();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-ivory border border-sand/60 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-charcoal">
            {existing ? "Edit Announcement" : "New Announcement"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              required
              maxLength={200}
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement here..."
              rows={5}
              maxLength={5000}
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all resize-none"
            />
            <p className="text-[10px] text-muted mt-1 text-right">{body.length}/5000</p>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-sand/60 text-terracotta focus:ring-terracotta/20"
            />
            <span className="text-sm text-charcoal">Pin to top</span>
          </label>

          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            {saving ? "Saving..." : existing ? "Update" : "Post Announcement"}
          </button>
        </form>
      </div>
    </div>
  );
}
