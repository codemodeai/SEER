"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight, CreditCard, Receipt, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import CheckoutModal from "@/components/CheckoutModal";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
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

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    plan: string;
    priceUsd: number;
    priceInr: number;
  }>({ open: false, plan: "", priceUsd: 0, priceInr: 0 });

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
        const selectedPlan = planId;
        const selectedPrice = plans.find((p) => p.id === planId)?.price ?? 0;
        const options = {
          key: data.razorpayKeyId,
          subscription_id: data.subscriptionId,
          name: "SEER",
          description: `${data.planName} Plan — Monthly`,
          handler: async function (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) {
            // Verify payment and update plan
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
            }
          },
          modal: { ondismiss: () => setLoading(null) },
          theme: { color: "#D97757" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const currentPlanConfig = plans.find((p) => p.id === currentPlan);
  const currentPrice = currentPlanConfig?.price ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your subscription and payment method.
        </p>
      </div>

      {/* Current plan */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ivory rounded-2xl border border-sand/60 p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">
              Current Plan
            </p>
            <p className="mt-1 font-display text-2xl text-charcoal capitalize">
              {currentPlan} {currentPrice > 0 ? `— $${currentPrice}/month` : "— Free"}
            </p>
            {currentPrice > 0 && (
              <p className="text-sm text-muted mt-1">
                Subscription active
              </p>
            )}
          </div>
          {currentPrice > 0 && (
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-warm-brown-light hover:text-charcoal transition-all">
                <Receipt size={15} />
                Invoices
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-warm-brown-light hover:text-charcoal transition-all">
                <CreditCard size={15} />
                Update card
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Plan comparison */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan, i) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl p-5 flex flex-col ${
                isCurrent
                  ? "bg-charcoal text-white border-2 border-terracotta"
                  : "bg-ivory border border-sand/60"
              }`}
            >
              {isCurrent && (
                <span className="text-[10px] font-semibold tracking-widest uppercase text-terracotta-light mb-2">
                  Current Plan
                </span>
              )}
              <h3
                className={`font-display text-xl ${isCurrent ? "text-white" : "text-charcoal"}`}
              >
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span
                  className={`font-display text-3xl ${isCurrent ? "text-white" : "text-charcoal"}`}
                >
                  ${plan.price}
                </span>
                <span
                  className={`text-xs ${isCurrent ? "text-white/50" : "text-muted"}`}
                >
                  /mo
                </span>
              </div>
              <span
                className={`mt-2 text-xs font-medium ${isCurrent ? "text-terracotta-light" : "text-terracotta"}`}
              >
                {plan.calls} calls
              </span>

              <ul className="mt-4 flex-1 flex flex-col gap-2">
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
                <div className="mt-5 text-center py-2.5 rounded-full bg-white/10 text-xs font-medium text-white/60">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handlePlanChange(plan.id)}
                  disabled={loading !== null || plan.id === "free"}
                  className="mt-5 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-cream hover:bg-cream-dark border border-sand text-xs font-semibold text-charcoal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Cancel */}
      {currentPrice > 0 && (
        <div className="text-center pt-4">
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
