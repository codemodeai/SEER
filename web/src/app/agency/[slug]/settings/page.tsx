"use client";

import { useAgency } from "@/lib/agency-context";
import { useState } from "react";
import { Building2, Save, Loader2, Lock, ToggleLeft, ToggleRight, Megaphone, FolderKanban, CreditCard, X, Webhook } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";

const PAID_ADDONS: Record<string, { label: string; price: string; priceUsd: number; description: string }> = {
  project_management: {
    label: "Project Management",
    price: "$5/mo",
    priceUsd: 5,
    description: "Kanban boards, tasks, project tracking, and team assignment.",
  },
  webhooks: {
    label: "Webhooks",
    price: "$3/mo",
    priceUsd: 3,
    description: "HTTP notifications for agency events — member changes, announcements, tasks, and more.",
  },
};

export default function AgencySettingsPage() {
  const { agency, role } = useAgency();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const addonEnabled = searchParams.get("addon_enabled");
  const [name, setName] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({ announcements: true, project_management: false, webhooks: false });
  const [saving, setSaving] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [featureMessage, setFeatureMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addonModal, setAddonModal] = useState<string | null>(null);

  const canEdit = role === "owner";

  // Initialize form values from agency data
  useState(() => {
    if (agency) {
      setName(agency.name);
      if (agency.enabledFeatures) {
        const f = { ...agency.enabledFeatures };
        // If we just came back from addon payment, reflect the enabled state
        if (addonEnabled && addonEnabled in f) {
          f[addonEnabled] = true;
        }
        setFeatures(f);
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

      {/* Addon enabled success banner */}
      {addonEnabled && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 max-w-xl">
          <p className="text-sm text-green-700 font-medium">
            Payment successful! The <span className="font-semibold">{addonEnabled.replace(/_/g, " ")}</span> feature
            has been enabled for your agency. Reload to see it in the sidebar.
          </p>
        </div>
      )}

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
              onClick={() => {
                if (!canEdit) return;
                if (features.project_management) {
                  // Disabling — free, just toggle off
                  setFeatures(f => ({ ...f, project_management: false }));
                } else {
                  // Enabling — requires payment, show modal
                  setAddonModal("project_management");
                }
              }}
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

          {/* Webhooks toggle */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-cream-dark border border-sand/50">
            <div className="flex items-center gap-3">
              <Webhook size={18} className="text-muted" />
              <div>
                <p className="text-sm font-medium text-charcoal">Webhooks</p>
                <p className="text-[11px] text-muted">HTTP notifications for agency events ($3/mo addon)</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!canEdit) return;
                if (features.webhooks) {
                  setFeatures(f => ({ ...f, webhooks: false }));
                } else {
                  setAddonModal("webhooks");
                }
              }}
              disabled={!canEdit}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {features.webhooks ? (
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

      {/* Addon Payment Modal */}
      {addonModal && PAID_ADDONS[addonModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddonModal(null)}>
          <div
            className="bg-ivory border border-sand/60 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
                  <CreditCard size={20} className="text-terracotta" />
                </div>
                <h3 className="font-display text-lg text-charcoal">Enable Add-on</h3>
              </div>
              <button onClick={() => setAddonModal(null)} className="w-8 h-8 rounded-lg bg-cream-dark flex items-center justify-center text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4 rounded-xl bg-cream-dark border border-sand/50 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-charcoal">{PAID_ADDONS[addonModal].label}</p>
                <span className="text-sm font-display text-terracotta">{PAID_ADDONS[addonModal].price}</span>
              </div>
              <p className="text-xs text-muted">{PAID_ADDONS[addonModal].description}</p>
            </div>

            <p className="text-xs text-muted mb-5">
              You will be redirected to complete the payment. After successful payment,
              the feature will be automatically enabled for your agency.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAddonModal(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-muted border border-sand/60 rounded-xl hover:bg-cream-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem("seer_addon_config", JSON.stringify({
                    feature: addonModal,
                    label: PAID_ADDONS[addonModal].label,
                    priceUsd: PAID_ADDONS[addonModal].priceUsd,
                    agencySlug: slug,
                  }));
                  window.location.href = `/payment/checkout?plan=addon&feature=${addonModal}&slug=${slug}`;
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-semibold hover:bg-terracotta/90 transition-all"
              >
                <CreditCard size={16} />
                Pay {PAID_ADDONS[addonModal].price}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
