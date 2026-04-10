"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Star,
  Loader2,
  ArrowRight,
  Zap,
  Brain,
  Shield,
  Users,
  HelpCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase-browser";

/* ───── Plan data ───── */

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    tagline: "Try SEER with basic optimization",
    calls: "50 calls/mo",
    icon: Zap,
    popular: false,
    cta: "Start free",
    highlights: [
      "Prompt optimization (seer run, seer optimize)",
      "Session continue & recall",
      "Session read & memory init",
      "Basic dashboard",
      "1 surface (Terminal)",
      "Auto-log & auto-suggest",
      "Input/output security",
    ],
    limitations: [
      "No workflow generator",
      "No context memory search",
      "No Founder's Space",
      "No team features",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 19,
    period: "/month",
    tagline: "Workflows & Founder's Space for serious projects",
    calls: "200 calls/mo",
    icon: Zap,
    popular: false,
    cta: "Get Starter",
    highlights: [
      "Everything in Free",
      "Workflow generator (seer workflow)",
      "Founder's Space (+$1/mo addon)",
      "Credential vault (seer record credentials)",
      "Full dashboard with analytics",
      "All 4 surfaces (Terminal, Chat, IDE, API)",
      "Email support",
    ],
    limitations: [
      "No context memory search",
      "No team features",
      "Founder's Space is $1/mo addon",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    period: "/month",
    tagline: "Full power — memory, workflows, everything",
    calls: "1,000 calls/mo",
    icon: Brain,
    popular: true,
    cta: "Get Pro",
    highlights: [
      "Everything in Starter",
      "Context memory search (seer memory)",
      "Memory context injection into prompts",
      "Re-open task detection",
      "Founder's Space included (no addon fee)",
      "Credential vault included",
      "Adaptive workflow tracking",
      "Priority support",
    ],
    limitations: ["No team features", "Single user only"],
  },
  {
    id: "agency",
    name: "Agency",
    price: 59,
    period: "/month",
    tagline: "Team portal with shared memory & activity tracking",
    calls: "Unlimited calls",
    icon: Users,
    popular: false,
    cta: "Setup your agency",
    highlights: [
      "Everything in Pro",
      "Unlimited calls",
      "Team workspace (1–5 members included)",
      "Shared project memory across team",
      "Founder's Space + team vault",
      "Real-time activity tracking",
      "Team conflict detection",
      "Activity heartbeat monitoring",
      "Scale: +$50 per 5 extra members",
      "Dedicated support",
    ],
    limitations: [],
  },
];

/* ───── Tools comparison ───── */

const toolComparison = [
  { tool: "seer run", desc: "Compress & optimize any prompt", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer optimize", desc: "Model-specific optimization", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer status", desc: "Plan, usage & version info", free: true, starter: true, pro: true, agency: true, cost: "Free" },
  { tool: "seer tools", desc: "Show tools & features list", free: true, starter: true, pro: true, agency: true, cost: "Free" },
  { tool: "seer continue", desc: "Resume from last session", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer recall", desc: "Natural language recall", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer session read", desc: "Capture session to memory", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer memory run", desc: "Initialize project memory", free: true, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer workflow", desc: "Break goal into 3-7 steps", free: false, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer space", desc: "Founder's Space manager", free: false, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer record credentials", desc: "Scan & save credentials", free: false, starter: true, pro: true, agency: true, cost: "1 call" },
  { tool: "seer memory", desc: "Semantic memory search", free: false, starter: false, pro: true, agency: true, cost: "1 call" },
];

/* ───── Features comparison ───── */

const featureComparison = [
  { feature: "Auto-log", desc: "Auto-update session log on every command", free: true, starter: true, pro: true, agency: true },
  { feature: "Auto-suggest", desc: "3-5 contextual next-step suggestions", free: true, starter: true, pro: true, agency: true },
  { feature: "Smart nudge", desc: "Suggests session read for important work", free: true, starter: true, pro: true, agency: true },
  { feature: "Input/output security", desc: "Sanitization & injection detection", free: true, starter: true, pro: true, agency: true },
  { feature: "Deviation detection", desc: "Detects when you go off-plan", free: true, starter: true, pro: true, agency: true },
  { feature: "Credential auto-detect", desc: "Detects API keys in messages", free: true, starter: true, pro: true, agency: true },
  { feature: "Re-open detection", desc: "Detect completed task references", free: false, starter: false, pro: true, agency: true },
  { feature: "Memory context injection", desc: "Inject project memory into prompts", free: false, starter: false, pro: true, agency: true },
  { feature: "Adaptive workflow tracking", desc: "Track deviations + smart suggestions", free: false, starter: false, pro: true, agency: true },
  { feature: "Shared project memory", desc: "Team-wide memory across members", free: false, starter: false, pro: false, agency: true },
  { feature: "Activity heartbeat", desc: "Real-time team activity monitoring", free: false, starter: false, pro: false, agency: true },
  { feature: "Team conflict detection", desc: "Warn when 2 members touch same feature", free: false, starter: false, pro: false, agency: true },
];

/* ───── FAQ ───── */

const faqs = [
  {
    q: "What counts as a 'call'?",
    a: "Each seer command that uses Haiku AI (prompt optimization, workflow generation, memory search) counts as 1 call. Free commands like 'seer status' and 'seer tools' don't count. Session continue, recall, and session read each cost 1 call.",
  },
  {
    q: "What are my Claude Code API costs?",
    a: "SEER's pricing is separate from your Anthropic API usage. Claude Code's own API costs are billed directly by Anthropic. SEER actually saves you money by reducing failed prompts — each retry costs ~$1.00–1.50 in API calls.",
  },
  {
    q: "What is Founder's Space?",
    a: "Founder's Space is an encrypted vault for your project credentials, tasks, notes, and documents. It uses AES-256-GCM encryption. On Starter, it's a $1/mo addon. On Pro and Agency, it's included free.",
  },
  {
    q: "How does the Agency team workspace work?",
    a: "Agency includes 1–5 team members with shared project memory, real-time activity tracking, and conflict detection. When two members work on the same feature, SEER warns them automatically. Need more members? Add +$50 per 5 extra seats.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrade takes effect immediately with prorated billing. Downgrade takes effect at the end of your current billing cycle. You keep access to all features until then.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes — all paid plans include a 7-day money-back guarantee. If SEER isn't saving you time and money, we'll refund you fully.",
  },
  {
    q: "How does SEER work with Claude Code?",
    a: "SEER is an MCP (Model Context Protocol) server. You connect it to Claude Code via the MCP configuration. Once connected, just prefix any prompt with 'seer' and it intercepts, optimizes, and structures your prompt before Claude processes it.",
  },
  {
    q: "What models does SEER use?",
    a: "SEER uses Claude Haiku 4.5 for fast, cost-efficient prompt optimization (~$0.001 per call). Your Claude Code instance continues using whatever model you've configured (Opus, Sonnet, etc.).",
  },
];

/* ───── Component ───── */

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    <>
      <Navbar />
      <main className="bg-cream">
        {/* ─── Hero ─── */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-20 text-center px-6 grain relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 left-[10%] w-[400px] h-[400px] rounded-full bg-terracotta/5 blur-3xl" />
            <div className="absolute bottom-10 right-[15%] w-[300px] h-[300px] rounded-full bg-accent-gold/8 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto">
            <motion.span
              className="text-xs font-semibold tracking-widest uppercase text-terracotta"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Pricing
            </motion.span>
            <motion.h1
              className="mt-4 font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-charcoal leading-[1.05]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Save more than you spend
            </motion.h1>
            <motion.p
              className="mt-5 text-warm-brown-light text-lg leading-relaxed max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Each failed Claude Code prompt costs ~$1.00–1.50 in API calls.
              SEER eliminates retries — paying for itself in the first week.
            </motion.p>
          </div>
        </section>

        {/* ─── Plan Cards ─── */}
        <section className="pb-20 px-6">
          <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
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
                  {plan.tagline}
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

                {/* Included */}
                <ul className="mt-6 flex-1 flex flex-col gap-2">
                  {plan.highlights.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check
                        size={14}
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

                {/* Not included */}
                {plan.limitations.length > 0 && (
                  <ul className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                    {plan.limitations.map((lim) => (
                      <li key={lim} className="flex items-start gap-2.5">
                        <X
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${plan.popular ? "text-white/25" : "text-muted/50"}`}
                        />
                        <span
                          className={`text-sm ${plan.popular ? "text-white/35" : "text-muted"}`}
                        >
                          {lim}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

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
                    <>
                      {plan.cta}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted max-w-xl mx-auto">
            All plans include a 7-day money-back guarantee. Cancel anytime.
            <br />
            Your Claude Code API costs are separate and unaffected by SEER.
          </p>
        </section>

        {/* ─── Tools Comparison Table ─── */}
        <section className="py-20 px-6 bg-ivory grain">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
                Tool Access
              </span>
              <h2 className="mt-3 font-display text-3xl md:text-4xl text-charcoal">
                12 tools, one MCP server
              </h2>
              <p className="mt-3 text-warm-brown-light text-base max-w-xl mx-auto">
                Every tool is available through a single <code className="text-sm bg-sand/40 px-1.5 py-0.5 rounded">seer</code> prefix in Claude Code.
              </p>
            </motion.div>

            <div className="overflow-x-auto rounded-2xl border border-sand/60 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand/60">
                    <th className="text-left py-4 px-5 font-semibold text-charcoal">Tool</th>
                    <th className="text-left py-4 px-4 font-semibold text-charcoal hidden md:table-cell">Description</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Free</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Starter</th>
                    <th className="text-center py-4 px-3 font-semibold text-terracotta">Pro</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Agency</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal hidden sm:table-cell">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {toolComparison.map((row, i) => (
                    <tr
                      key={row.tool}
                      className={`border-b border-sand/30 ${i % 2 === 0 ? "bg-cream/30" : ""}`}
                    >
                      <td className="py-3 px-5 font-mono text-xs text-charcoal font-medium">
                        {row.tool}
                      </td>
                      <td className="py-3 px-4 text-warm-brown-light hidden md:table-cell">
                        {row.desc}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.free ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.starter ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center bg-terracotta/5">
                        {row.pro ? (
                          <Check size={16} className="inline text-terracotta" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.agency ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-muted text-xs hidden sm:table-cell">
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Features Comparison Table ─── */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
                Features
              </span>
              <h2 className="mt-3 font-display text-3xl md:text-4xl text-charcoal">
                Built-in intelligence at every level
              </h2>
              <p className="mt-3 text-warm-brown-light text-base max-w-xl mx-auto">
                Automatic features that work behind the scenes — no extra commands needed.
              </p>
            </motion.div>

            <div className="overflow-x-auto rounded-2xl border border-sand/60 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand/60">
                    <th className="text-left py-4 px-5 font-semibold text-charcoal">Feature</th>
                    <th className="text-left py-4 px-4 font-semibold text-charcoal hidden md:table-cell">Description</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Free</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Starter</th>
                    <th className="text-center py-4 px-3 font-semibold text-terracotta">Pro</th>
                    <th className="text-center py-4 px-3 font-semibold text-charcoal">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-sand/30 ${i % 2 === 0 ? "bg-cream/30" : ""}`}
                    >
                      <td className="py-3 px-5 font-medium text-charcoal">
                        {row.feature}
                      </td>
                      <td className="py-3 px-4 text-warm-brown-light hidden md:table-cell">
                        {row.desc}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.free ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.starter ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center bg-terracotta/5">
                        {row.pro ? (
                          <Check size={16} className="inline text-terracotta" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.agency ? (
                          <Check size={16} className="inline text-accent-sage" />
                        ) : (
                          <X size={16} className="inline text-muted/40" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Cost Breakdown ─── */}
        <section className="py-20 px-6 bg-ivory grain">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-semibold tracking-widest uppercase text-terracotta">
                ROI Calculator
              </span>
              <h2 className="mt-3 font-display text-3xl md:text-4xl text-charcoal">
                How SEER pays for itself
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Shield,
                  title: "Without SEER",
                  items: [
                    "~3 retries per complex prompt",
                    "~$1.00–1.50 per failed attempt",
                    "~$90–225/mo wasted on retries",
                    "Lost context between sessions",
                    "Manual workflow planning",
                  ],
                  accent: false,
                },
                {
                  icon: Zap,
                  title: "With SEER Pro",
                  items: [
                    "First-try success rate >85%",
                    "~$0.001 per SEER optimization",
                    "$49/mo flat — saves $40–175/mo",
                    "Persistent project memory",
                    "Auto-generated workflows",
                  ],
                  accent: true,
                },
                {
                  icon: Users,
                  title: "With SEER Agency",
                  items: [
                    "Multiply savings across team",
                    "Unlimited calls — no metering",
                    "Eliminate duplicate work",
                    "Shared memory = shared context",
                    "$59/mo for up to 5 developers",
                  ],
                  accent: false,
                },
              ].map((col) => (
                <motion.div
                  key={col.title}
                  className={`rounded-2xl p-7 ${
                    col.accent
                      ? "bg-charcoal text-white border-2 border-terracotta"
                      : "bg-white border border-sand/60"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <col.icon
                    size={24}
                    className={col.accent ? "text-terracotta-light" : "text-terracotta"}
                  />
                  <h3
                    className={`mt-4 font-display text-xl ${col.accent ? "text-white" : "text-charcoal"}`}
                  >
                    {col.title}
                  </h3>
                  <ul className="mt-5 space-y-2.5">
                    {col.items.map((item) => (
                      <li
                        key={item}
                        className={`text-sm flex items-start gap-2 ${
                          col.accent ? "text-white/70" : "text-warm-brown-light"
                        }`}
                      >
                        <span className={col.accent ? "text-terracotta-light" : "text-terracotta"}>
                          •
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <HelpCircle size={20} className="inline text-terracotta mb-2" />
              <h2 className="mt-2 font-display text-3xl md:text-4xl text-charcoal">
                Frequently asked questions
              </h2>
            </motion.div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  className="rounded-xl border border-sand/60 bg-white overflow-hidden"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-cream/50 transition-colors"
                  >
                    <span className="font-medium text-charcoal text-sm">
                      {faq.q}
                    </span>
                    <span
                      className={`text-muted transition-transform ${openFaq === i ? "rotate-45" : ""}`}
                    >
                      +
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 text-sm text-warm-brown-light leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Bottom CTA ─── */}
        <section className="py-20 px-6 bg-charcoal grain text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl text-white">
              Start optimizing today
            </h2>
            <p className="mt-4 text-white/60 text-lg">
              50 free calls. No credit card required. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/signup"
                className="group flex items-center gap-2 px-7 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-full transition-all shadow-lg shadow-terracotta/20"
              >
                Start free — 50 calls/mo
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </a>
              <a
                href="/docs"
                className="px-7 py-3.5 text-white/70 hover:text-white font-semibold rounded-full border border-white/15 hover:border-white/30 transition-all"
              >
                Read the docs
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
