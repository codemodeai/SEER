"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import {
  CreditCard,
  Shield,
  ArrowLeft,
  Loader2,
  Receipt,
  Building2,
  Zap,
  IndianRupee,
  DollarSign,
  Globe,
  Check,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

const PLAN_INFO: Record<string, { name: string; description: string; priceUsd: number }> = {
  starter: { name: "Starter", description: "200 calls/mo — workflows, all surfaces, email support", priceUsd: 19 },
  pro: { name: "Pro", description: "1,000 calls/mo — context memory, priority support", priceUsd: 49 },
};

interface PriceInfo {
  priceUsd: number;
  exchangeRate: number;
  subtotalInr: number;
  gstPercent: number;
  gstAmount: number;
  totalInr: number;
  totalPaise: number;
}

interface AgencyConfig {
  agencyName: string;
  memberTier: string;
  maxUsers: number;
  basePrice: number;
  addonPrice: number;
  totalPrice: number;
  enabledFeatures: Record<string, boolean>;
}

interface AddonConfig {
  feature: string;
  label: string;
  priceUsd: number;
  agencySlug: string;
}

type Provider = "razorpay" | "dodo";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "";

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [agencyConfig, setAgencyConfig] = useState<AgencyConfig | null>(null);
  const [addonConfig, setAddonConfig] = useState<AddonConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [isIndia, setIsIndia] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("dodo");

  const isAgency = plan === "agency";
  const isAddon = plan === "addon";
  const planMeta = isAgency || isAddon ? null : PLAN_INFO[plan];

  useEffect(() => {
    async function init() {
      // Auth check
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/login?redirect=/payment/checkout?plan=${plan}`;
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? "");

      // Geo detection
      try {
        const geoRes = await fetch("/api/geo");
        if (geoRes.ok) {
          const geo = await geoRes.json();
          setIsIndia(geo.isIndia);
          setSelectedProvider(geo.isIndia ? "razorpay" : "dodo");
        }
      } catch {
        // Default to dodo on error
      }

      // Agency config from sessionStorage
      let totalUsd = planMeta?.priceUsd ?? 0;
      if (isAddon) {
        const raw = sessionStorage.getItem("seer_addon_config");
        if (!raw) {
          window.location.href = "/dashboard";
          return;
        }
        const config: AddonConfig = JSON.parse(raw);
        setAddonConfig(config);
        totalUsd = config.priceUsd;
      } else if (isAgency) {
        const raw = sessionStorage.getItem("seer_agency_config");
        if (!raw) {
          window.location.href = "/agency/setup";
          return;
        }
        const config: AgencyConfig = JSON.parse(raw);
        setAgencyConfig(config);
        totalUsd = config.totalPrice;
      }

      // Fetch price info (INR breakdown)
      const url = isAgency || isAddon
        ? `/api/payment/price-info?plan=${plan}&totalUsd=${totalUsd}`
        : `/api/payment/price-info?plan=${plan}`;
      const res = await fetch(url);
      if (res.ok) {
        setPriceInfo(await res.json());
      } else {
        setError("Failed to load pricing. Please refresh.");
      }

      setPageLoading(false);
    }
    init();

    // Load Razorpay script
    if (typeof window !== "undefined" && !window.Razorpay) {
      const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existing) existing.remove();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, [plan, isAgency, isAddon, planMeta?.priceUsd]);

  async function handlePay() {
    if (!priceInfo) return;
    setLoading(true);
    setError("");

    try {
      let apiUrl: string;
      let body: Record<string, unknown>;

      if (isAddon && addonConfig) {
        apiUrl = "/api/agency/addon-checkout";
        body = {
          userId,
          email: userEmail,
          feature: addonConfig.feature,
          label: addonConfig.label,
          priceUsd: addonConfig.priceUsd,
          agencySlug: addonConfig.agencySlug,
          preferredProvider: selectedProvider,
        };
      } else if (isAgency && agencyConfig) {
        apiUrl = "/api/agency/checkout";
        body = {
          userId,
          email: userEmail,
          agencyName: agencyConfig.agencyName,
          memberTier: agencyConfig.memberTier,
          maxUsers: agencyConfig.maxUsers,
          basePrice: agencyConfig.basePrice,
          addonPrice: agencyConfig.addonPrice,
          totalPrice: agencyConfig.totalPrice,
          enabledFeatures: agencyConfig.enabledFeatures,
          preferredProvider: selectedProvider,
        };
      } else {
        apiUrl = "/api/checkout";
        body = { plan, userId, email: userEmail, preferredProvider: selectedProvider };
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      if (data.provider === "demo") {
        setError("Payment gateway not configured. Contact support.");
        setLoading(false);
        return;
      }

      // Dodo → redirect to hosted checkout
      if (data.provider === "dodo" && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Razorpay → open modal
      if (data.provider !== "razorpay" || !data.subscriptionId || !data.razorpayKeyId) {
        setError("Payment setup incomplete. Please try again.");
        setLoading(false);
        return;
      }

      if (!window.Razorpay) {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (window.Razorpay) { clearInterval(check); resolve(); }
          }, 200);
          setTimeout(() => { clearInterval(check); resolve(); }, 8000);
        });
      }

      if (!window.Razorpay) {
        setError("Payment gateway failed to load. Please disable ad blockers and refresh.");
        setLoading(false);
        return;
      }

      const currentPlan = plan;
      const options: Record<string, unknown> = {
        key: data.razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: "SEER",
        description: isAddon && addonConfig
          ? `${addonConfig.label} Add-on — $${addonConfig.priceUsd}/mo`
          : isAgency
            ? `Agency Plan — ${agencyConfig?.memberTier} members — $${agencyConfig?.totalPrice}/mo`
            : `${data.planName} Plan — Monthly`,
        prefill: { email: userEmail },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyBody: Record<string, unknown> = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              plan: currentPlan,
            };
            if (isAddon && addonConfig) {
              verifyBody.addonConfig = {
                feature: addonConfig.feature,
                agencySlug: addonConfig.agencySlug,
              };
            } else if (isAgency && agencyConfig) {
              verifyBody.agencyConfig = {
                agencyName: agencyConfig.agencyName,
                memberTier: agencyConfig.memberTier,
                maxUsers: agencyConfig.maxUsers,
                basePrice: agencyConfig.basePrice,
                addonPrice: agencyConfig.addonPrice,
                enabledFeatures: agencyConfig.enabledFeatures,
              };
            }

            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(verifyBody),
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              sessionStorage.removeItem("seer_agency_config");
              sessionStorage.removeItem("seer_addon_config");
              if (isAddon && addonConfig) {
                // Redirect back to agency settings with success
                window.location.href = `/agency/${addonConfig.agencySlug}/settings?addon_enabled=${addonConfig.feature}`;
              } else {
                const agencyParam = verifyData.agencySlug ? `&agency=${verifyData.agencySlug}` : "";
                window.location.href = `/payment/success?plan=${currentPlan}&price=${priceInfo?.priceUsd ?? 0}${agencyParam}`;
              }
            } else {
              setError("Payment verification failed. Please contact support.");
              setLoading(false);
            }
          } catch {
            setError("Payment verification error. Please contact support.");
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: "#D97757" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: Record<string, unknown>) {
        const err = response.error as Record<string, string> | undefined;
        setError(`Payment failed: ${err?.description ?? "Unknown error"}`);
        setLoading(false);
      });
      rzp.open();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!plan || (!planMeta && !isAgency && !isAddon)) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-2xl text-charcoal mb-2">Invalid plan</h1>
          <Link href="/dashboard/billing" className="text-sm text-terracotta hover:underline">
            Back to billing
          </Link>
        </div>
      </div>
    );
  }

  const displayName = isAddon
    ? `${addonConfig?.label} Add-on`
    : isAgency ? `Agency — ${agencyConfig?.memberTier} members` : planMeta!.name;
  const displayDesc = isAddon
    ? `Add-on for your agency — billed monthly`
    : isAgency
      ? `${agencyConfig?.agencyName} — Unlimited calls, shared memory, activity tracking`
      : planMeta!.description;

  const isDodo = selectedProvider === "dodo";

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
        {/* Back link */}
        <Link
          href={isAddon && addonConfig ? `/agency/${addonConfig.agencySlug}/settings` : isAgency ? "/agency/setup" : "/dashboard/billing"}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          {isAddon ? "Back to settings" : isAgency ? "Back to setup" : "Back to billing"}
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={28} className="text-terracotta" />
          </div>
          <h1 className="font-display text-3xl text-charcoal">Complete your purchase</h1>
          <p className="text-muted text-sm mt-2">Review your plan and choose a payment method.</p>
        </div>

        {/* Plan info card */}
        <div className="bg-ivory border border-sand/60 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
              {isAddon ? (
                <Zap size={20} className="text-terracotta" />
              ) : isAgency ? (
                <Building2 size={20} className="text-terracotta" />
              ) : (
                <Zap size={20} className="text-terracotta" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-charcoal">{displayName} Plan</h2>
              <p className="text-xs text-muted mt-0.5">{displayDesc}</p>
            </div>
          </div>

          {isAgency && agencyConfig && agencyConfig.addonPrice > 0 && (
            <div className="mb-4 pb-4 border-b border-sand/40">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted mb-2">Add-ons</p>
              {agencyConfig.enabledFeatures.project_management && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-brown-light">Project Management</span>
                  <span className="text-charcoal font-medium">+$5/mo</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment method selector */}
        <div className="bg-ivory border border-sand/60 rounded-2xl p-6 mb-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted mb-3">
            Payment Method
          </p>
          <div className="flex flex-col gap-3">
            {/* Dodo — always shown */}
            <button
              type="button"
              onClick={() => setSelectedProvider("dodo")}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                isDodo
                  ? "border-terracotta bg-terracotta/[0.04]"
                  : "border-sand/60 bg-white hover:border-sand"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDodo ? "bg-terracotta/10" : "bg-cream-dark"
              }`}>
                <Globe size={18} className={isDodo ? "text-terracotta" : "text-muted"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-charcoal">Pay in USD</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-blue-50 text-blue-600">
                    International
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  Dodo Payments — Card, PayPal & more — ${priceInfo?.priceUsd ?? 0}/mo
                </p>
              </div>
              {isDodo && <Check size={16} className="text-terracotta shrink-0" />}
            </button>

            {/* Razorpay — shown only for Indian users */}
            {isIndia && (
              <button
                type="button"
                onClick={() => setSelectedProvider("razorpay")}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                  !isDodo
                    ? "border-terracotta bg-terracotta/[0.04]"
                    : "border-sand/60 bg-white hover:border-sand"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  !isDodo ? "bg-terracotta/10" : "bg-cream-dark"
                }`}>
                  <IndianRupee size={18} className={!isDodo ? "text-terracotta" : "text-muted"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal">Pay in INR</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-orange-50 text-orange-600">
                      India
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    Razorpay — UPI, Cards, Net Banking — ₹{priceInfo?.totalInr.toLocaleString("en-IN") ?? 0}/mo
                  </p>
                </div>
                {!isDodo && <Check size={16} className="text-terracotta shrink-0" />}
              </button>
            )}
          </div>
        </div>

        {/* Price breakdown card — show INR breakdown only for Razorpay */}
        {selectedProvider === "razorpay" && priceInfo ? (
          <div className="bg-charcoal text-white rounded-2xl p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={16} className="text-terracotta-light" />
              <h3 className="text-xs font-semibold tracking-widest uppercase text-white/50">
                Price Breakdown (INR)
              </h3>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Subtotal</span>
                <div className="text-right">
                  <span className="font-medium">${priceInfo.priceUsd}</span>
                  <span className="text-white/40 mx-1.5">=</span>
                  <span className="font-medium">₹{priceInfo.subtotalInr.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Exchange rate</span>
                <span className="text-white/40">1 USD = ₹{priceInfo.exchangeRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">GST ({priceInfo.gstPercent}%)</span>
                <span className="font-medium">₹{priceInfo.gstAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-t border-white/20 mt-1 pt-3 flex items-center justify-between">
                <span className="text-white font-semibold">Total</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl text-terracotta-light">
                    ₹{priceInfo.totalInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-white/40 text-xs">/mo</span>
                </div>
              </div>
            </div>
          </div>
        ) : selectedProvider === "dodo" ? (
          <div className="bg-charcoal text-white rounded-2xl p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={16} className="text-terracotta-light" />
              <h3 className="text-xs font-semibold tracking-widest uppercase text-white/50">
                Price Summary (USD)
              </h3>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Plan price</span>
                <span className="font-medium">${priceInfo?.priceUsd ?? 0}/mo</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Taxes & fees</span>
                <span className="text-white/40">Handled by Dodo Payments (MoR)</span>
              </div>
              <div className="border-t border-white/20 mt-1 pt-3 flex items-center justify-between">
                <span className="text-white font-semibold">Total</span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl text-terracotta-light">
                    ${priceInfo?.priceUsd ?? 0}
                  </span>
                  <span className="text-white/40 text-xs">/mo</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-charcoal text-white rounded-2xl p-6 mb-4 flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-white/40" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200 mb-4">
            {error}
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={loading || !priceInfo}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-terracotta text-white font-semibold text-base hover:bg-terracotta/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-terracotta/20"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing...
            </>
          ) : isDodo ? (
            <>
              <DollarSign size={18} />
              Pay ${priceInfo?.priceUsd ?? 0}/mo
            </>
          ) : priceInfo ? (
            <>
              <IndianRupee size={18} />
              Pay ₹{priceInfo.totalInr.toLocaleString("en-IN")}/mo
            </>
          ) : (
            "Loading..."
          )}
        </button>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-5 text-xs text-muted">
          <Shield size={12} />
          <span>
            {isDodo
              ? "Secured by Dodo Payments. 7-day money-back guarantee."
              : "Secured by Razorpay. 7-day money-back guarantee."}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
