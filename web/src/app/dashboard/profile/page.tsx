"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { User, Mail, Calendar, Shield, Zap, AlertTriangle, X, Loader2 } from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  plan: string;
  usage: number;
  apiKey: string;
  createdAt: string;
  provider: string;
}

const CANCEL_REASONS = [
  "Too expensive",
  "Not enough value",
  "Switching to another tool",
  "No longer needed",
  "Missing features",
  "Other",
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("users")
        .select("plan, seer_api_key, created_at")
        .eq("id", user.id)
        .single();

      // Get real usage from seer_logs (current month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("seer_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("timestamp", monthStart);

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      const provider = user.app_metadata?.provider || "email";

      setProfile({
        name,
        email: user.email || "",
        avatar: user.user_metadata?.avatar_url || "",
        plan: data?.plan || "free",
        usage: count ?? 0,
        apiKey: data?.seer_api_key || "",
        createdAt: data?.created_at || user.created_at || "",
        provider,
      });
      setLoading(false);
    }
    fetchProfile();
  }, []);

  async function handleCancelPlan() {
    if (!cancelReason || !cancelFeedback.trim()) {
      setCancelError("Please select a reason and provide your feedback.");
      return;
    }

    setCancelling(true);
    setCancelError("");

    try {
      const res = await fetch("/api/cancel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, feedback: cancelFeedback }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCancelError(data.error || "Something went wrong.");
        setCancelling(false);
        return;
      }

      setProfile((prev) => prev ? { ...prev, plan: "free" } : prev);
      setShowCancelModal(false);
      setCancelReason("");
      setCancelFeedback("");
    } catch {
      setCancelError("Network error. Please try again.");
    }
    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted">
        <p>Unable to load profile. Please log in again.</p>
      </div>
    );
  }

  const joinDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted">Your account details.</p>
      </div>

      {/* Profile card */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6 md:p-8">
        <div className="flex items-center gap-3 sm:gap-5">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-sand/60 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-terracotta/15 flex items-center justify-center shrink-0">
              <span className="text-terracotta font-display font-bold text-xl sm:text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl text-charcoal truncate">{profile.name}</h2>
            <p className="text-xs sm:text-sm text-muted truncate">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <DetailCard
          icon={<Mail size={18} />}
          label="Email"
          value={profile.email}
        />
        <DetailCard
          icon={<Shield size={18} />}
          label="Auth Provider"
          value={profile.provider.charAt(0).toUpperCase() + profile.provider.slice(1)}
        />
        <DetailCard
          icon={<Zap size={18} />}
          label="Current Plan"
          value={profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
        />
        <DetailCard
          icon={<Calendar size={18} />}
          label="Joined"
          value={joinDate}
        />
      </div>

      {/* Usage summary */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <User size={16} className="sm:w-[18px] sm:h-[18px] text-terracotta" />
          <h3 className="font-display text-base sm:text-lg text-charcoal">Usage This Month</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl sm:text-4xl text-charcoal tracking-tight">
            {profile.usage}
          </span>
          <span className="text-xs sm:text-sm text-muted">API calls</span>
        </div>
      </div>

      {/* Cancel plan */}
      {profile.plan !== "free" && (
        <div className="bg-ivory rounded-2xl border border-red-200/60 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-charcoal">Cancel Subscription</h3>
              <p className="text-xs text-muted mt-0.5">
                Downgrade to the Free plan. You&apos;ll lose access to paid features.
              </p>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-xl border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 transition-all shrink-0 w-full sm:w-auto text-center"
            >
              Cancel Plan
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-sand/60 w-full sm:max-w-md sm:mx-4 p-5 sm:p-6 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="font-display text-xl text-charcoal">Cancel Your Plan</h3>
              </div>
              <button
                onClick={() => { setShowCancelModal(false); setCancelError(""); }}
                className="text-muted hover:text-charcoal transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted">
              We&apos;re sorry to see you go. Your feedback helps us improve SEER for everyone.
            </p>

            {/* Reason select */}
            <div>
              <label className="text-xs font-semibold text-charcoal block mb-1.5">
                Why are you cancelling? <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setCancelReason(r)}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium border transition-all ${
                      cancelReason === r
                        ? "bg-terracotta text-white border-terracotta"
                        : "bg-cream border-sand/60 text-warm-brown-light hover:border-terracotta/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback text */}
            <div>
              <label className="text-xs font-semibold text-charcoal block mb-1.5">
                Tell us more <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                placeholder="What could we have done better?"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-sand/60 text-sm text-charcoal bg-cream placeholder:text-muted/50 focus:outline-none focus:border-terracotta/40 resize-none"
              />
            </div>

            {cancelError && (
              <p className="text-xs text-red-500">{cancelError}</p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
              <button
                onClick={() => { setShowCancelModal(false); setCancelError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-charcoal hover:bg-cream transition-all"
              >
                Keep My Plan
              </button>
              <button
                onClick={handleCancelPlan}
                disabled={cancelling || !cancelReason || !cancelFeedback.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <><Loader2 size={14} className="animate-spin" /> Cancelling...</>
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-ivory rounded-xl sm:rounded-2xl border border-sand/60 p-3 sm:p-5">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
        <span className="text-terracotta shrink-0">{icon}</span>
        <p className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-muted truncate">
          {label}
        </p>
      </div>
      <p className="text-sm sm:text-base font-medium text-charcoal truncate">{value}</p>
    </div>
  );
}
