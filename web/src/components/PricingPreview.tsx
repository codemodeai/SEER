"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    period: "forever",
    calls: "50 calls/mo",
    features: ["Prompt optimization", "Basic dashboard", "1 surface"],
    popular: false,
  },
  {
    name: "Starter",
    monthlyPrice: 19,
    annualPrice: 15,
    period: "/month",
    calls: "200 calls/mo",
    features: ["Workflows", "Founder's Space", "All 4 surfaces"],
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    annualPrice: 39,
    period: "/month",
    calls: "1,000 calls/mo",
    features: ["Context memory", "Founder's Space", "Priority support"],
    popular: true,
  },
  {
    name: "Agency",
    monthlyPrice: 59,
    annualPrice: 47,
    period: "/month",
    calls: "Unlimited",
    features: ["Team workspace", "Shared memory", "Activity tracking"],
    popular: false,
  },
];

export default function PricingPreview() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="py-28 md:py-36 relative bg-ivory grain">
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-10"
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

        {/* Billing Toggle */}
        <motion.div
          className="flex items-center justify-center gap-4 mb-12"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span
            className={`text-sm font-medium transition-colors ${
              !isAnnual ? "text-charcoal" : "text-muted"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isAnnual ? "bg-terracotta" : "bg-sand"
            }`}
            aria-label="Toggle annual billing"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              isAnnual ? "text-charcoal" : "text-muted"
            }`}
          >
            Annual
          </span>
          {isAnnual && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-1 px-2.5 py-0.5 rounded-full bg-accent-sage/15 text-accent-sage text-xs font-semibold"
            >
              Save ~20%
            </motion.span>
          )}
        </motion.div>

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
                  ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                </span>
                <span
                  className={`text-sm ${plan.popular ? "text-white/50" : "text-muted"}`}
                >
                  {plan.monthlyPrice === 0
                    ? plan.period
                    : isAnnual
                      ? "/mo, billed yearly"
                      : plan.period}
                </span>
              </div>

              {isAnnual && plan.monthlyPrice > 0 && (
                <div className="mt-1">
                  <span
                    className={`text-sm line-through ${plan.popular ? "text-white/30" : "text-muted/60"}`}
                  >
                    ${plan.monthlyPrice}/mo
                  </span>
                </div>
              )}

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
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <a
            href="/pricing"
            className="group inline-flex items-center gap-2 text-terracotta hover:text-terracotta-dark font-semibold transition-colors"
          >
            View full pricing details, tool comparison & FAQ
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </a>
          <p className="mt-4 text-sm text-muted">
            All plans include a 7-day money-back guarantee. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
