"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Star, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    description: "Try SEER with basic optimization",
    calls: "50 calls/mo",
    features: [
      "Prompt optimization",
      "Basic dashboard",
      "1 surface (Terminal)",
    ],
    cta: "Start free",
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: 19,
    period: "/month",
    description: "Add workflows for serious projects",
    calls: "200 calls/mo",
    features: [
      "Prompt optimization",
      "Workflow generator",
      "Full dashboard",
      "All 4 surfaces",
      "Email support",
    ],
    cta: "Get Starter",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    period: "/month",
    description: "Full power — memory, workflows, everything",
    calls: "1,000 calls/mo",
    features: [
      "Prompt optimization",
      "Workflow generator",
      "Context memory",
      "Full dashboard",
      "All 4 surfaces",
      "Priority support",
    ],
    cta: "Get Pro",
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 59,
    period: "/month",
    description: "Team portal with shared memory & activity",
    calls: "Unlimited calls",
    features: [
      "Everything in Pro",
      "Team workspace (1–5 members)",
      "Shared project memory",
      "Real-time activity tracking",
      "Scale: +$50 per 5 extra members",
    ],
    cta: "Setup your agency",
    popular: false,
  },
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    fetchUser();
  }, []);

  function handleCheckout(planId: string) {
    if (planId === "free") {
      window.location.href = "/signup?plan=free";
      return;
    }
    if (planId === "agency") {
      window.location.href = userId ? "/agency/setup" : "/signup?plan=agency";
      return;
    }
    if (!userId) {
      window.location.href = `/signup?plan=${planId}`;
      return;
    }
    setLoading(planId);
    window.location.href = `/payment/checkout?plan=${planId}`;
  }

  return (
    <section id="pricing" className="py-28 md:py-36 relative bg-ivory grain">
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
            Simple Pricing
          </span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]">
            Save more than you spend
          </h2>
          <p className="mt-5 text-warm-brown-light text-lg leading-relaxed">
            Each failed Claude Code prompt costs ~$1.00–1.50 in API calls. SEER
            eliminates retries — paying for itself in the first week.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.popular
                  ? "bg-charcoal text-white border-2 border-terracotta shadow-xl shadow-terracotta/10 scale-[1.03] lg:scale-105"
                  : "bg-white border border-sand/80"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-terracotta text-white text-xs font-semibold shadow-md">
                    <Star size={11} fill="currentColor" />
                    Most Popular
                  </span>
                </div>
              )}

              <h3
                className={`font-display text-xl ${plan.popular ? "text-white" : "text-charcoal"}`}
              >
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`font-display text-4xl md:text-5xl tracking-tight ${plan.popular ? "text-white" : "text-charcoal"}`}
                >
                  ${plan.price}
                </span>
                <span
                  className={`text-sm ${plan.popular ? "text-white/50" : "text-muted"}`}
                >
                  {plan.period}
                </span>
              </div>

              <p
                className={`mt-2 text-sm ${plan.popular ? "text-white/60" : "text-warm-brown-light"}`}
              >
                {plan.description}
              </p>

              <div
                className={`mt-5 inline-flex self-start px-3 py-1 rounded-lg text-xs font-semibold ${
                  plan.popular
                    ? "bg-terracotta/20 text-terracotta-light"
                    : "bg-terracotta/8 text-terracotta"
                }`}
              >
                {plan.calls}
              </div>

              <ul className="mt-6 flex-1 flex flex-col gap-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <Check
                      size={15}
                      className={`mt-0.5 flex-shrink-0 ${plan.popular ? "text-terracotta-light" : "text-terracotta"}`}
                    />
                    <span
                      className={`text-sm ${plan.popular ? "text-white/75" : "text-warm-brown-light"}`}
                    >
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={`mt-8 flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.popular
                    ? "bg-terracotta hover:bg-terracotta-dark text-white shadow-lg shadow-terracotta/30"
                    : "bg-cream hover:bg-cream-dark text-charcoal border border-sand"
                }`}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  plan.cta
                )}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mt-12 text-center text-sm text-muted"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          All plans include a 7-day money-back guarantee. Cancel anytime.
          <br />
          Your Claude Code API costs are separate and unaffected by SEER.
        </motion.p>
      </div>
    </section>
  );
}
