"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight, CreditCard, Receipt, Loader2, Download, Calendar, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import CheckoutModal from "@/components/CheckoutModal";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    calls: "50/mo",
    features: ["Prompt optimization", "Basic dashboard", "1 surface"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 19,
    calls: "200/mo",
    features: ["+ Workflow generator", "All 4 surfaces", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    calls: "1,000/mo",
    features: ["+ Context memory", "Priority support", "Full dashboard"],
  },
  {
    id: "agency",
    name: "Agency",
    price: 99,
    calls: "Unlimited",
    features: ["+ Team workspace", "Shared memory", "Dedicated support"],
  },
];

const INR_PRICES: Record<string, number> = {
  starter: 1599,
  pro: 3999,
  agency: 7999,
};

interface Invoice {
  id: string;
  plan: string;
  amount_usd: number;
  amount_inr: number;
  status: string;
  created_at: string;
  billing_period_start: string;
  billing_period_end: string;
}

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    plan: string;
    priceUsd: number;
    priceInr: number;
  }>({ open: false, plan: "", priceUsd: 0, priceInr: 0 });

  // Load Razorpay script properly
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else if (typeof window !== "undefined" && window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, []);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const { data } = await supabase
        .from("users")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (data) {
        setCurrentPlan(data.plan);
      }

      // Fetch invoices (also triggers self-heal if plan is mismatched)
      try {
        const res = await fetch("/api/invoices");
        if (res.ok) {
          const invoiceData = await res.json();
          setInvoices(invoiceData.invoices ?? []);
          setNextBillingDate(invoiceData.nextBillingDate);

          // Re-fetch plan in case it was self-healed
          if (invoiceData.invoices?.length > 0) {
            const { data: refreshed } = await supabase
              .from("users")
              .select("plan")
              .eq("id", user.id)
              .single();
            if (refreshed && refreshed.plan !== data?.plan) {
              setCurrentPlan(refreshed.plan);
            }
          }
        }
      } catch {
        // Silent fail
      }
      setInvoicesLoading(false);
    }
    fetchUser();
  }, []);

  async function handlePlanChange(planId: string) {
    if (planId === "free" || planId === currentPlan) return;
    setLoading(planId);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          userId,
          email: userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Something went wrong.");
        setLoading(null);
        return;
      }

      if (data.provider === "demo") {
        setModal({
          open: true,
          plan: data.plan,
          priceUsd: data.priceUsd,
          priceInr: data.priceInr,
        });
        setLoading(null);
        return;
      }

      if (data.provider === "dodo") {
        window.location.href = data.checkoutUrl;
      } else if (data.provider === "razorpay") {
        // Wait for Razorpay script to load if not ready
        if (!window.Razorpay) {
          await new Promise<void>((resolve) => {
            const check = setInterval(() => {
              if (window.Razorpay) { clearInterval(check); resolve(); }
            }, 200);
            setTimeout(() => { clearInterval(check); resolve(); }, 5000);
          });
        }

        if (!window.Razorpay) {
          alert("Payment gateway failed to load. Please refresh and try again.");
          setLoading(null);
          return;
        }

        const selectedPlan = planId;
        const selectedPrice = plans.find((p) => p.id === planId)?.price ?? 0;
        const options: Record<string, unknown> = {
          key: data.razorpayKeyId,
          subscription_id: data.subscriptionId,
          name: "SEER",
          description: `${data.planName} Plan — Monthly`,
          prefill: { email: userEmail },
          handler: async function (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) {
            try {
              const verifyRes = await fetch("/api/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: selectedPlan,
                }),
              });
              if (verifyRes.ok) {
                window.location.href = `/payment/success?plan=${selectedPlan}&price=${selectedPrice}`;
              } else {
                alert("Payment verification failed. Please contact support.");
                setLoading(null);
              }
            } catch {
              alert("Payment verification error. Please contact support.");
              setLoading(null);
            }
          },
          modal: {
            ondismiss: () => setLoading(null),
          },
          theme: { color: "#D97757" },
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", function (response: Record<string, unknown>) {
            const err = response.error as Record<string, string> | undefined;
            alert(`Payment failed: ${err?.description ?? "Unknown error"}`);
            setLoading(null);
          });
          rzp.open();
        } catch (e) {
          alert(`Could not open payment gateway: ${e}`);
          setLoading(null);
        }
        return; // Don't run finally block
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setLoading(null);
  }

  function handleDownloadInvoice(invoiceId: string) {
    window.open(`/api/invoices/${invoiceId}`, "_blank");
  }

  const currentPlanConfig = plans.find((p) => p.id === currentPlan);
  const currentPrice = currentPlanConfig?.price ?? 0;

  const nextBillingStr = nextBillingDate
    ? new Date(nextBillingDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your subscription and payment method.
        </p>
      </div>

      {/* Current plan + Next billing */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ivory rounded-2xl border border-sand/60 p-4 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">
              Current Plan
            </p>
            <p className="mt-1 font-display text-xl sm:text-2xl text-charcoal capitalize">
              {currentPlan} {currentPrice > 0 ? `— $${currentPrice}/month` : "— Free"}
            </p>
            {currentPrice > 0 && nextBillingStr && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Calendar size={13} className="text-terracotta" />
                <p className="text-xs sm:text-sm text-muted">
                  Next billing: <span className="font-medium text-charcoal">{nextBillingStr}</span>
                </p>
              </div>
            )}
            {currentPrice === 0 && (
              <p className="text-xs sm:text-sm text-muted mt-1">No active subscription</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Plan comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {plans.map((plan, i) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col ${
                isCurrent
                  ? "bg-charcoal text-white border-2 border-terracotta"
                  : "bg-ivory border border-sand/60"
              }`}
            >
              {isCurrent && (
                <span className="text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase text-terracotta-light mb-1 sm:mb-2">
                  Current Plan
                </span>
              )}
              <h3
                className={`font-display text-base sm:text-xl ${isCurrent ? "text-white" : "text-charcoal"}`}
              >
                {plan.name}
              </h3>
              <div className="mt-1 sm:mt-2 flex items-baseline gap-1">
                <span
                  className={`font-display text-2xl sm:text-3xl ${isCurrent ? "text-white" : "text-charcoal"}`}
                >
                  ${plan.price}
                </span>
                <span
                  className={`text-[10px] sm:text-xs ${isCurrent ? "text-white/50" : "text-muted"}`}
                >
                  /mo
                </span>
              </div>
              <span
                className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium ${isCurrent ? "text-terracotta-light" : "text-terracotta"}`}
              >
                {plan.calls} calls
              </span>

              <ul className="mt-3 sm:mt-4 flex-1 flex-col gap-1.5 sm:gap-2 hidden sm:flex">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      size={13}
                      className={`mt-0.5 flex-shrink-0 ${isCurrent ? "text-terracotta-light" : "text-terracotta"}`}
                    />
                    <span
                      className={`text-xs ${isCurrent ? "text-white/70" : "text-warm-brown-light"}`}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="mt-3 sm:mt-5 text-center py-2 sm:py-2.5 rounded-full bg-white/10 text-[10px] sm:text-xs font-medium text-white/60">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handlePlanChange(plan.id)}
                  disabled={loading !== null || plan.id === "free"}
                  className="mt-3 sm:mt-5 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-full bg-cream hover:bg-cream-dark border border-sand text-[10px] sm:text-xs font-semibold text-charcoal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.price > currentPrice ? "Upgrade" : "Downgrade"}
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-sand/40 flex items-center gap-2">
          <Receipt size={16} className="text-terracotta" />
          <h3 className="text-sm font-semibold text-charcoal">Invoices</h3>
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 sm:py-12 gap-2">
            <FileText size={28} className="text-muted/40" />
            <p className="text-sm text-muted">No invoices yet</p>
            <p className="text-xs text-muted/70">Invoices will appear here after your first payment.</p>
          </div>
        ) : (
          <div className="divide-y divide-sand/30">
            {invoices.map((invoice) => {
              const date = new Date(invoice.created_at);
              const monthYear = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
              const fullDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const plan = invoice.plan.charAt(0).toUpperCase() + invoice.plan.slice(1);

              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-cream-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-terracotta" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        {plan} Plan — {monthYear}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted">{fullDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-charcoal">${invoice.amount_usd.toFixed(2)}</p>
                      {invoice.amount_inr > 0 && (
                        <p className="text-[10px] text-muted">₹{invoice.amount_inr.toLocaleString()}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-charcoal sm:hidden">
                      ${invoice.amount_usd.toFixed(2)}
                    </span>
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-sage/15 text-accent-sage border border-accent-sage/20 uppercase">
                      {invoice.status}
                    </span>
                    <button
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-sand/60 flex items-center justify-center text-muted hover:text-terracotta hover:border-terracotta/30 transition-all"
                      title="Download invoice"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Cancel */}
      {currentPrice > 0 && (
        <div className="text-center pt-2 sm:pt-4">
          <button className="text-xs text-muted hover:text-red-500 transition-colors">
            Cancel subscription
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        open={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        plan={modal.plan}
        priceUsd={modal.priceUsd}
        priceInr={modal.priceInr}
      />
    </div>
  );
}
