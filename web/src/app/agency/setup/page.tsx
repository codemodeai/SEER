"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Building2,
  Users,
  Megaphone,
  FolderKanban,
  Check,
  ArrowRight,
  Loader2,
  DollarSign,
  Shield,
} from "lucide-react";

const MEMBER_TIERS = [
  { id: "1-5", label: "1–5 members", max: 5, price: 59 },
  { id: "6-10", label: "6–10 members", max: 10, price: 99 },
  { id: "11-15", label: "11–15 members", max: 15, price: 149 },
  { id: "16-20", label: "16–20 members", max: 20, price: 199 },
  { id: "21-25", label: "21–25 members", max: 25, price: 249 },
  { id: "26-30", label: "26–30 members", max: 30, price: 299 },
];

interface FeatureOption {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  defaultEnabled: boolean;
  free: boolean;
}

const FEATURES: FeatureOption[] = [
  {
    id: "announcements",
    name: "Team Announcements",
    description: "Post announcements visible to all agency members. Pin important updates to the top.",
    price: 0,
    icon: Megaphone,
    defaultEnabled: true,
    free: true,
  },
  {
    id: "project_management",
    name: "Project-wise Management",
    description: "Organize work by projects. Assign members to projects, track project-level usage and memory separately.",
    price: 5,
    icon: FolderKanban,
    defaultEnabled: false,
    free: false,
  },
];

export default function AgencySetupPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [selectedTier, setSelectedTier] = useState("1-5");
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean>>({
    announcements: true,
    project_management: false,
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?redirect=/agency/setup";
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setPageLoading(false);
    }
    init();
  }, []);

  const tier = MEMBER_TIERS.find((t) => t.id === selectedTier)!;
  const addonPrice = useMemo(() => {
    return FEATURES.reduce((sum, f) => {
      if (!f.free && enabledFeatures[f.id]) return sum + f.price;
      return sum;
    }, 0);
  }, [enabledFeatures]);
  const totalPrice = tier.price + addonPrice;

  function toggleFeature(featureId: string) {
    setEnabledFeatures((prev) => ({ ...prev, [featureId]: !prev[featureId] }));
  }

  function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    const name = agencyName.trim();
    if (!name || name.length < 2) {
      setError("Agency name must be at least 2 characters.");
      return;
    }
    if (name.length > 100) {
      setError("Agency name must be under 100 characters.");
      return;
    }

    setLoading(true);
    setError("");

    // Store agency config in sessionStorage for the checkout page
    const config = {
      agencyName: name,
      memberTier: selectedTier,
      maxUsers: tier.max,
      basePrice: tier.price,
      addonPrice,
      totalPrice,
      enabledFeatures,
    };
    sessionStorage.setItem("seer_agency_config", JSON.stringify(config));

    // Redirect to payment checkout page
    window.location.href = "/payment/checkout?plan=agency";
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-terracotta" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-charcoal">Setup your agency</h1>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">
            Configure your team size, pick features, and get your portal up in minutes.
          </p>
        </div>

        <form onSubmit={handleSetup} className="flex flex-col gap-8">
          {/* Agency Name */}
          <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
            <label className="block text-xs font-semibold tracking-widest uppercase text-muted mb-2">
              Agency Name
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Acme Development"
              required
              maxLength={100}
              className="w-full px-4 py-3 rounded-xl border border-sand/60 bg-white text-base text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/10 transition-all"
            />
          </div>

          {/* Team Size */}
          <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-terracotta" />
              <h2 className="text-xs font-semibold tracking-widest uppercase text-muted">
                Team Size
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MEMBER_TIERS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedTier(t.id)}
                  className={`relative flex flex-col items-center gap-1 px-4 py-4 rounded-xl border-2 transition-all ${
                    selectedTier === t.id
                      ? "border-terracotta bg-terracotta/[0.04]"
                      : "border-sand/60 bg-white hover:border-sand"
                  }`}
                >
                  {selectedTier === t.id && (
                    <div className="absolute top-2 right-2">
                      <Check size={14} className="text-terracotta" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-charcoal">{t.label}</span>
                  <span className="font-display text-xl text-charcoal">${t.price}</span>
                  <span className="text-[10px] text-muted">/month</span>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="bg-ivory border border-sand/60 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-terracotta" />
              <h2 className="text-xs font-semibold tracking-widest uppercase text-muted">
                Features
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {FEATURES.map((feature) => {
                const enabled = enabledFeatures[feature.id];
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.id}
                    className={`flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all ${
                      enabled
                        ? "border-terracotta/30 bg-terracotta/[0.02]"
                        : "border-sand/60 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={18} className="text-terracotta" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-charcoal">{feature.name}</h3>
                        {feature.free ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-green-100 text-green-700">
                            Free
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-terracotta/10 text-terracotta">
                            +${feature.price}/mo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">{feature.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeature(feature.id)}
                      className={`shrink-0 mt-1 w-11 h-6 rounded-full transition-colors relative ${
                        enabled ? "bg-terracotta" : "bg-sand"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          enabled ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-charcoal text-white rounded-2xl p-6">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-4">
              Price Summary
            </h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Base plan ({tier.label})</span>
                <span className="font-medium">${tier.price}/mo</span>
              </div>
              {FEATURES.filter((f) => !f.free && enabledFeatures[f.id]).map((f) => (
                <div key={f.id} className="flex items-center justify-between">
                  <span className="text-white/70">{f.name}</span>
                  <span className="font-medium">+${f.price}/mo</span>
                </div>
              ))}
              <div className="border-t border-white/20 mt-2 pt-3 flex items-center justify-between">
                <span className="text-white font-medium">Total</span>
                <span className="font-display text-2xl text-terracotta-light">${totalPrice}/mo</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !agencyName.trim()}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-terracotta text-white font-semibold text-base hover:bg-terracotta/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-terracotta/20"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <DollarSign size={18} />
                Setup & Pay — ${totalPrice}/mo
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted">
            7-day money-back guarantee. Cancel or change plan anytime.
          </p>
        </form>
      </div>
    </div>
  );
}
