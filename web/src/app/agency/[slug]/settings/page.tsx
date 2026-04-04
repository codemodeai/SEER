"use client";

import { useAgency } from "@/lib/agency-context";
import { useState } from "react";
import { Building2, Save, Loader2, Lock, ToggleLeft, ToggleRight, Megaphone, FolderKanban } from "lucide-react";

export default function AgencySettingsPage() {
  const { agency, role } = useAgency();
  const [name, setName] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({ announcements: true, project_management: false });
  const [saving, setSaving] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [featureMessage, setFeatureMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canEdit = role === "owner";

  // Initialize form values from agency data
  useState(() => {
    if (agency) {
      setName(agency.name);
      if (agency.enabledFeatures) {
        setFeatures(agency.enabledFeatures);
      }
    }
  });

  if (!agency) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/agency/${agency!.slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully." });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to save settings." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-charcoal">Settings</h1>
        <p className="text-muted text-sm mt-1">
          {canEdit
            ? "Manage your agency configuration."
            : "View agency settings. Only the owner can edit."}
        </p>
      </div>

      {/* Settings form */}
      <div className="bg-ivory border border-sand/60 rounded-2xl p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <Building2 size={20} className="text-terracotta" />
          </div>
          <div>
            <h2 className="font-display text-lg text-charcoal">Agency Details</h2>
            <p className="text-xs text-muted">Basic agency information</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Agency Name */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Agency Name
            </label>
            <input
              type="text"
              value={name || agency.name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-white text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Slug
            </label>
            <input
              type="text"
              value={agency.slug}
              disabled
              className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-cream-dark text-sm text-muted cursor-not-allowed"
            />
            <p className="text-[10px] text-muted mt-1">
              Portal URL: seermcp.com/agency/{agency.slug}
            </p>
          </div>

          {/* Max Users (locked — set during agency setup/payment) */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Max Users
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={agency.maxUsers}
                disabled
                className="w-full px-4 py-2.5 rounded-xl border border-sand/60 bg-cream-dark text-sm text-muted cursor-not-allowed"
              />
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0" title="Set during plan purchase">
                <Lock size={14} className="text-amber-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-1">
              Seat limit is set during plan purchase and cannot be changed. To upgrade, contact support.
            </p>
          </div>

          {/* Status (read-only) */}
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-1.5">
              Status
            </label>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                agency.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {agency.status === "active" ? "Active" : "Suspended"}
            </span>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`px-4 py-2.5 rounded-xl text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save button */}
          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50 w-fit"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </form>
      </div>

      {/* Feature Toggles */}
      <div className="bg-ivory border border-sand/60 rounded-2xl p-6 max-w-xl mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <ToggleLeft size={20} className="text-terracotta" />
          </div>
          <div>
            <h2 className="font-display text-lg text-charcoal">Feature Toggles</h2>
            <p className="text-xs text-muted">Enable or disable portal features for your agency</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Announcements toggle */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-cream-dark border border-sand/50">
            <div className="flex items-center gap-3">
              <Megaphone size={18} className="text-muted" />
              <div>
                <p className="text-sm font-medium text-charcoal">Announcements</p>
                <p className="text-[11px] text-muted">Post updates visible to all agency members</p>
              </div>
            </div>
            <button
              onClick={() => canEdit && setFeatures(f => ({ ...f, announcements: !f.announcements }))}
              disabled={!canEdit}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {features.announcements ? (
                <ToggleRight size={32} className="text-terracotta" />
              ) : (
                <ToggleLeft size={32} className="text-muted" />
              )}
            </button>
          </div>

          {/* Project Management toggle */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-cream-dark border border-sand/50">
            <div className="flex items-center gap-3">
              <FolderKanban size={18} className="text-muted" />
              <div>
                <p className="text-sm font-medium text-charcoal">Project Management</p>
                <p className="text-[11px] text-muted">Kanban boards, tasks, and project tracking ($5/mo addon)</p>
              </div>
            </div>
            <button
              onClick={() => canEdit && setFeatures(f => ({ ...f, project_management: !f.project_management }))}
              disabled={!canEdit}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {features.project_management ? (
                <ToggleRight size={32} className="text-terracotta" />
              ) : (
                <ToggleLeft size={32} className="text-muted" />
              )}
            </button>
          </div>
        </div>

        {/* Feature message */}
        {featureMessage && (
          <div
            className={`mt-4 px-4 py-2.5 rounded-xl text-sm ${
              featureMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {featureMessage.text}
          </div>
        )}

        {/* Save features button */}
        {canEdit && (
          <button
            onClick={async () => {
              setSavingFeatures(true);
              setFeatureMessage(null);
              try {
                const res = await fetch(`/api/agency/${agency!.slug}/settings`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled_features: features }),
                });
                if (res.ok) {
                  setFeatureMessage({ type: "success", text: "Features updated. Reload the page to see changes in the sidebar." });
                } else {
                  const err = await res.json();
                  setFeatureMessage({ type: "error", text: err.error || "Failed to update features." });
                }
              } catch {
                setFeatureMessage({ type: "error", text: "Network error. Please try again." });
              } finally {
                setSavingFeatures(false);
              }
            }}
            disabled={savingFeatures}
            className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50 w-fit"
          >
            {savingFeatures ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {savingFeatures ? "Saving..." : "Save Features"}
          </button>
        )}
      </div>
    </div>
  );
}
